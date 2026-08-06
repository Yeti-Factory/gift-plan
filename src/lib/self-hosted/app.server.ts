import type { Pool, PoolClient } from "pg";

import { ApiError } from "./http.server";
import { getDatabasePool } from "./database.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Database = Pick<Pool | PoolClient, "query">;

export function requiredUuid(value: unknown) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  return value;
}

export function optionalUuid(value: unknown) {
  return value === null || value === undefined || value === "" ? null : requiredUuid(value);
}

export function requiredText(value: unknown, max = 200) {
  if (typeof value !== "string") throw new ApiError(400, "INVALID_REQUEST");
  const text = value.trim();
  if (!text || text.length > max) throw new ApiError(400, "INVALID_REQUEST");
  return text;
}

export function optionalText(value: unknown, max = 2_000) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  return value.trim() || null;
}

async function circleMembership(database: Database, circleId: string, userId: string) {
  const result = await database.query<{ role: "admin" | "member"; created_by: string }>(
    `SELECT cm.role, c.created_by
       FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
      WHERE c.id = $1::uuid AND cm.user_id = $2::uuid`,
    [circleId, userId],
  );
  if (!result.rows[0]) throw new ApiError(403, "NOT_MEMBER");
  return result.rows[0];
}

export async function getAppStatus(userId: string | null, database: Database = getDatabasePool()) {
  const result = await database.query<{
    maintenance_mode: boolean;
    maintenance_message: string;
    is_superadmin: boolean;
  }>(
    `SELECT s.maintenance_mode, s.maintenance_message,
            ($1::uuid IS NOT NULL AND EXISTS (
              SELECT 1 FROM app_admins a WHERE a.user_id = $1::uuid
            )) AS is_superadmin
       FROM app_settings s WHERE s.id = true`,
    [userId],
  );
  const row = result.rows[0];
  return {
    maintenance: row?.maintenance_mode ?? false,
    message: row?.maintenance_message ?? "Gift-Plan revient dans quelques instants.",
    is_superadmin: row?.is_superadmin ?? false,
  };
}

export async function getSessionView(userId: string, database: Database = getDatabasePool()) {
  const result = await database.query(
    `SELECT u.id, u.name, u.email, u."emailVerified" AS email_verified, u.image,
            p.username, p.display_name, p.avatar_url, p.bio, p.visibility,
            p.email_searchable, p.onboarding_completed_at, p.onboarding_version,
            EXISTS (SELECT 1 FROM app_admins a WHERE a.user_id = u.id) AS is_superadmin,
            (SELECT count(*)::int FROM profile_access_requests ar
              WHERE ar.owner_id = u.id AND ar.status = 'pending') AS pending_profile_access
       FROM "user" u JOIN profiles p ON p.id = u.id WHERE u.id = $1::uuid`,
    [userId],
  );
  if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
  return result.rows[0];
}

export async function searchPublicProfiles(query: string, database: Database = getDatabasePool()) {
  const term = query.trim().toLowerCase();
  if (term.length < 2 || term.length > 100) return [];
  const result = await database.query(
    `SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio
       FROM profiles p JOIN "user" u ON u.id = p.id AND u."emailVerified" = true
      WHERE p.visibility = 'public' AND (
        lower(p.username) LIKE '%' || $1 || '%'
        OR lower(coalesce(p.display_name, '')) LIKE '%' || $1 || '%'
        OR (p.email_searchable AND lower(u.email) = $1)
      )
      ORDER BY p.display_name NULLS LAST, p.username LIMIT 30`,
    [term],
  );
  return result.rows;
}

export async function getMyLists(userId: string, database: Database = getDatabasePool()) {
  const [circles, lists, gifts] = await Promise.all([
    database.query(
      `SELECT c.id, c.name FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
        WHERE cm.user_id = $1::uuid ORDER BY lower(c.name), c.id`,
      [userId],
    ),
    database.query(
      `SELECT l.id, l.title, l.occasion, l.event_date, l.circle_id, l.visibility,
              coalesce(array_agg(lca.circle_id) FILTER (WHERE lca.circle_id IS NOT NULL), '{}') AS circle_ids
         FROM lists l LEFT JOIN list_circle_access lca ON lca.list_id = l.id
        WHERE l.owner_id = $1::uuid
        GROUP BY l.id ORDER BY l.created_at DESC`,
      [userId],
    ),
    database.query(
      `SELECT g.id, g.list_id, g.title, g.description, g.url, g.image_url, g.image_path,
              g.price::float8 AS price, g.currency, g.priority, g.category
         FROM gifts g WHERE g.owner_id = $1::uuid ORDER BY g.created_at DESC`,
      [userId],
    ),
  ]);
  return { circles: circles.rows, lists: lists.rows, gifts: gifts.rows, userId };
}

export async function getCircles(userId: string, database: Database = getDatabasePool()) {
  const result = await database.query(
    `SELECT c.id, c.name, c.created_at
       FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
      WHERE cm.user_id = $1::uuid ORDER BY c.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getCircleDetail(
  userId: string,
  circleId: string,
  database: Database = getDatabasePool(),
) {
  const membership = await circleMembership(database, circleId, userId);
  const [circle, members, activity] = await Promise.all([
    database.query(
      `SELECT id, name, created_by,
              CASE WHEN $2::boolean THEN invite_code ELSE NULL END AS invite_code
         FROM circles WHERE id = $1::uuid`,
      [circleId, membership.role === "admin"],
    ),
    database.query(
      `SELECT cm.user_id, cm.role,
              jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url,
                'username', p.username) AS profile,
              count(DISTINCT lca.list_id)::int AS "listCount"
         FROM circle_members cm JOIN profiles p ON p.id = cm.user_id
         LEFT JOIN lists l ON l.owner_id = cm.user_id
         LEFT JOIN list_circle_access lca ON lca.list_id = l.id AND lca.circle_id = cm.circle_id
        WHERE cm.circle_id = $1::uuid
        GROUP BY cm.user_id, cm.role, p.display_name, p.avatar_url, p.username, cm.joined_at
        ORDER BY CASE cm.role WHEN 'admin' THEN 0 ELSE 1 END, cm.joined_at`,
      [circleId],
    ),
    membership.role === "admin"
      ? database.query(
          `SELECT id, action, actor_name, target_name, created_at
             FROM circle_activity WHERE circle_id = $1::uuid
            ORDER BY created_at DESC LIMIT 50`,
          [circleId],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    circle: circle.rows[0],
    members: members.rows,
    activity: activity.rows,
    userId,
    isAdmin: membership.role === "admin",
  };
}

export async function getCircleMember(
  viewerId: string,
  circleId: string,
  memberId: string,
  database: Database = getDatabasePool(),
) {
  await circleMembership(database, circleId, viewerId);
  await circleMembership(database, circleId, memberId);
  const [profile, lists] = await Promise.all([
    database.query(
      `SELECT id, username, display_name, avatar_url FROM profiles WHERE id = $1::uuid`,
      [memberId],
    ),
    database.query(
      `SELECT l.id, l.title, l.occasion, l.event_date, l.visibility
         FROM lists l JOIN list_circle_access lca ON lca.list_id = l.id
        WHERE l.owner_id = $1::uuid AND lca.circle_id = $2::uuid
        ORDER BY l.created_at DESC`,
      [memberId, circleId],
    ),
  ]);
  const listIds = lists.rows.map((row) => row.id as string);
  const gifts =
    listIds.length === 0
      ? { rows: [] }
      : await database.query(
          `SELECT g.id, g.list_id, g.title, g.description, g.url, g.image_url, g.image_path,
                  g.price::float8 AS price, g.currency, g.priority, g.category,
                  r.id AS reservation_id, r.status AS reservation_status,
                  r.buyer_id, buyer.display_name AS buyer_name
             FROM gifts g LEFT JOIN reservations r ON r.gift_id = g.id
             LEFT JOIN profiles buyer ON buyer.id = r.buyer_id
            WHERE g.list_id = ANY($1::uuid[]) ORDER BY g.created_at DESC`,
          [listIds],
        );
  const giftRows = gifts.rows.map((row) =>
    viewerId === memberId
      ? {
          ...row,
          reservation_id: null,
          reservation_status: null,
          buyer_id: null,
          buyer_name: null,
        }
      : row,
  );
  return { profile: profile.rows[0], lists: lists.rows, gifts: giftRows, viewerId };
}

export async function getOffers(userId: string, database: Database = getDatabasePool()) {
  const result = await database.query(
    `SELECT r.id AS reservation_id, r.status, r.created_at, g.id AS gift_id, g.title,
            g.price::float8 AS price, g.currency, g.image_url, g.image_path, g.category,
            l.title AS list_title,
            p.display_name AS owner_name, p.username AS owner_username, p.avatar_url AS owner_avatar
       FROM reservations r JOIN gifts g ON g.id = r.gift_id
       JOIN lists l ON l.id = g.list_id JOIN profiles p ON p.id = g.owner_id
      WHERE r.buyer_id = $1::uuid ORDER BY r.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getMyProfile(userId: string, database: Database = getDatabasePool()) {
  const [profile, lists, shares] = await Promise.all([
    database.query(
      `SELECT id, username, display_name, avatar_url, avatar_path, bio, visibility,
              email_searchable, onboarding_completed_at, onboarding_version
         FROM profiles WHERE id = $1::uuid`,
      [userId],
    ),
    database.query(
      `SELECT id, title, visibility FROM lists WHERE owner_id = $1::uuid ORDER BY created_at DESC`,
      [userId],
    ),
    database.query(
      `SELECT s.id, s.token, s.label, s.created_at, s.expires_at, s.revoked_at,
              coalesce(array_agg(sl.list_id) FILTER (WHERE sl.list_id IS NOT NULL), '{}') AS list_ids
         FROM profile_share_links s
         LEFT JOIN profile_share_link_lists sl ON sl.share_link_id = s.id
        WHERE s.owner_id = $1::uuid GROUP BY s.id ORDER BY s.created_at DESC`,
      [userId],
    ),
  ]);
  return { profile: profile.rows[0], lists: lists.rows, shares: shares.rows };
}

export async function getAccountData(userId: string, database: Database = getDatabasePool()) {
  const [user, profile, memberships, lists, gifts, reservations] = await Promise.all([
    database.query(
      `SELECT id, name, email, "emailVerified" AS email_verified, image, "createdAt" AS created_at
         FROM "user" WHERE id = $1::uuid`,
      [userId],
    ),
    database.query("SELECT * FROM profiles WHERE id = $1::uuid", [userId]),
    database.query(
      `SELECT cm.circle_id, cm.role, cm.joined_at, c.name AS circle_name
         FROM circle_members cm JOIN circles c ON c.id = cm.circle_id
        WHERE cm.user_id = $1::uuid ORDER BY cm.joined_at`,
      [userId],
    ),
    database.query("SELECT * FROM lists WHERE owner_id = $1::uuid ORDER BY created_at", [userId]),
    database.query("SELECT * FROM gifts WHERE owner_id = $1::uuid ORDER BY created_at", [userId]),
    database.query("SELECT * FROM reservations WHERE buyer_id = $1::uuid ORDER BY created_at", [
      userId,
    ]),
  ]);
  return {
    user: user.rows[0],
    profile: profile.rows[0],
    memberships: memberships.rows,
    lists: lists.rows,
    gifts: gifts.rows,
    reservations: reservations.rows,
  };
}

export async function getAdminStatus(userId: string, database: Database = getDatabasePool()) {
  const admin = await database.query("SELECT 1 FROM app_admins WHERE user_id = $1::uuid", [userId]);
  if (!admin.rows[0]) throw new ApiError(403, "FORBIDDEN");
  return getAppStatus(userId, database);
}
