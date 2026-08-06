import type { Pool, PoolClient } from "pg";

import type {
  DirectoryProfile,
  ProfileAccessCommand,
  ProfileAccessInbox,
  ProfileDirectoryResult,
} from "./profile-api";
import type { ProfilePageData, ProfilePageResult } from "@/lib/profile-page";
import { ApiError } from "./http.server";
import { getDatabasePool } from "./database.server";

type Queryable = Pick<Pool | PoolClient, "query">;

export async function listProfileDirectory(
  viewerId: string,
  input: { query: string; limit: number; offset: number },
  database: Queryable = getDatabasePool(),
): Promise<ProfileDirectoryResult> {
  const result = await database.query<{
    profiles: DirectoryProfile[];
    total_count: number;
  }>(
    `WITH candidates AS (
       SELECT
         p.id, p.username, p.display_name, p.avatar_url, p.visibility,
         CASE WHEN access.can_view THEN p.bio ELSE NULL END AS bio,
         access.can_view,
         p.id = $1::uuid AS is_self,
         outgoing.id AS outgoing_request_id,
         outgoing.status AS outgoing_status,
         incoming.id AS incoming_request_id,
         incoming.status AS incoming_status,
         lower(coalesce(nullif(btrim(p.display_name), ''), p.username)) AS sort_name
       FROM profiles p
       JOIN "user" account ON account.id = p.id AND account."emailVerified" = true
       CROSS JOIN LATERAL (
         SELECT (
           p.visibility = 'public'
           OR p.id = $1::uuid
           OR EXISTS (
             SELECT 1 FROM profile_access_requests ar
             WHERE ar.owner_id = p.id AND ar.requester_id = $1::uuid AND ar.status = 'accepted'
           )
           OR EXISTS (
             SELECT 1 FROM circles c
             JOIN circle_members cm ON cm.circle_id = c.id
             WHERE c.created_by = p.id AND cm.user_id = $1::uuid
           )
         ) AS can_view
       ) access
       LEFT JOIN profile_access_requests outgoing
         ON outgoing.requester_id = $1::uuid AND outgoing.owner_id = p.id
       LEFT JOIN profile_access_requests incoming
         ON incoming.requester_id = p.id AND incoming.owner_id = $1::uuid
       WHERE $2 = ''
          OR lower(p.username) LIKE '%' || lower($2) || '%'
          OR lower(coalesce(p.display_name, '')) LIKE '%' || lower($2) || '%'
     ), page AS (
       SELECT * FROM candidates
       ORDER BY sort_name, lower(username), id
       LIMIT $3 OFFSET $4
     )
     SELECT
       coalesce(jsonb_agg(to_jsonb(page) - 'sort_name') FILTER (WHERE page.id IS NOT NULL), '[]') AS profiles,
       (SELECT count(*)::int FROM candidates) AS total_count
     FROM page`,
    [viewerId, input.query, input.limit, input.offset],
  );

  return {
    profiles: result.rows[0]?.profiles ?? [],
    total: result.rows[0]?.total_count ?? 0,
  };
}

function isoDate(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

export async function listProfileAccessInbox(
  ownerId: string,
  database: Queryable = getDatabasePool(),
): Promise<ProfileAccessInbox> {
  const result = await database.query<{
    request_id: string;
    requester_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    status: "pending" | "accepted";
    created_at: string | Date;
    responded_at: string | Date | null;
  }>(
    `SELECT ar.id AS request_id, ar.requester_id, p.username, p.display_name, p.avatar_url,
            ar.status, ar.created_at, ar.responded_at
       FROM profile_access_requests ar
       JOIN profiles p ON p.id = ar.requester_id
      WHERE ar.owner_id = $1::uuid AND ar.status IN ('pending', 'accepted')
      ORDER BY CASE ar.status WHEN 'pending' THEN 0 ELSE 1 END, ar.created_at DESC`,
    [ownerId],
  );

  return {
    pending: result.rows
      .filter((row) => row.status === "pending")
      .map(({ status: _status, ...row }) => ({
        ...row,
        created_at: isoDate(row.created_at) ?? undefined,
        responded_at: isoDate(row.responded_at),
      })),
    granted: result.rows
      .filter((row) => row.status === "accepted")
      .map(({ status: _status, ...row }) => ({
        ...row,
        created_at: isoDate(row.created_at) ?? undefined,
        responded_at: isoDate(row.responded_at),
      })),
  };
}

export async function applyProfileAccessCommand(
  actorId: string,
  command: ProfileAccessCommand,
  database: Pool = getDatabasePool(),
) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    if (command.action === "request") {
      if (command.profileId === actorId) throw new ApiError(400, "INVALID_REQUEST");
      const target = await client.query<{
        visibility: "public" | "private";
        access_status: "pending" | "accepted" | "declined" | null;
      }>(
        `SELECT p.visibility, ar.status AS access_status
           FROM profiles p
           LEFT JOIN profile_access_requests ar
             ON ar.owner_id = p.id AND ar.requester_id = $2::uuid
          WHERE p.id = $1::uuid FOR UPDATE OF p`,
        [command.profileId, actorId],
      );
      if (!target.rows[0]) throw new ApiError(404, "NOT_FOUND");
      if (target.rows[0].access_status === "accepted") {
        await client.query("COMMIT");
        return;
      }
      if (target.rows[0].visibility === "public") throw new ApiError(409, "CONFLICT");
      await client.query(
        `INSERT INTO profile_access_requests (requester_id, owner_id, status, responded_at)
         VALUES ($1::uuid, $2::uuid, 'pending', NULL)
         ON CONFLICT (requester_id, owner_id)
         DO UPDATE SET status = 'pending', created_at = now(), responded_at = NULL, updated_at = now()`,
        [actorId, command.profileId],
      );
    } else if (command.action === "cancel") {
      await client.query(
        "DELETE FROM profile_access_requests WHERE requester_id = $1::uuid AND owner_id = $2::uuid",
        [actorId, command.profileId],
      );
    } else if (command.action === "respond") {
      const updated = await client.query(
        `UPDATE profile_access_requests
            SET status = $3::profile_access_status, responded_at = now(), updated_at = now()
          WHERE id = $1::uuid AND owner_id = $2::uuid AND status = 'pending'
          RETURNING id`,
        [command.requestId, actorId, command.accept ? "accepted" : "declined"],
      );
      if (updated.rowCount !== 1) throw new ApiError(404, "NOT_FOUND");
    } else {
      const updated = await client.query(
        `DELETE FROM profile_access_requests
          WHERE requester_id = $1::uuid AND owner_id = $2::uuid
          RETURNING id`,
        [command.requesterId, actorId],
      );
      if (updated.rowCount !== 1) throw new ApiError(404, "NOT_FOUND");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function profileVisibility(
  ownerId: string,
  viewerId: string | null,
  shareToken: string | null,
  database: Queryable,
) {
  const result = await database.query<{ can_view: boolean }>(
    `SELECT (
       p.visibility = 'public'
       OR p.id = $2::uuid
       OR ($2::uuid IS NOT NULL AND EXISTS (
         SELECT 1 FROM profile_access_requests ar
         WHERE ar.owner_id = p.id AND ar.requester_id = $2::uuid AND ar.status = 'accepted'
       ))
       OR ($2::uuid IS NOT NULL AND EXISTS (
         SELECT 1 FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
         WHERE c.created_by = p.id AND cm.user_id = $2::uuid
       ))
       OR ($3::uuid IS NOT NULL AND EXISTS (
         SELECT 1 FROM profile_share_links share
         WHERE share.owner_id = p.id AND share.token = $3::uuid
           AND share.revoked_at IS NULL AND (share.expires_at IS NULL OR share.expires_at > now())
       ))
     ) AS can_view
     FROM profiles p WHERE p.id = $1::uuid`,
    [ownerId, viewerId, shareToken],
  );
  return result.rows[0]?.can_view ?? false;
}

export async function getProfilePage(
  username: string,
  viewerId: string | null,
  shareToken: string | null,
  database: Queryable = getDatabasePool(),
): Promise<ProfilePageResult> {
  const profileResult = await database.query<ProfilePageData["profile"]>(
    `SELECT id, username, display_name, avatar_url, bio, visibility,
            id = $2::uuid AS is_owner
       FROM profiles WHERE lower(username) = lower($1)`,
    [username, viewerId],
  );
  const profile = profileResult.rows[0];
  if (!profile) return { error: "PROFILE_NOT_FOUND" };
  const canViewProfile = await profileVisibility(profile.id, viewerId, shareToken, database);
  if (!canViewProfile) {
    const publicList = await database.query(
      "SELECT 1 FROM lists WHERE owner_id = $1::uuid AND visibility = 'public' LIMIT 1",
      [profile.id],
    );
    if (!publicList.rows[0]) return { error: "PROFILE_PRIVATE" };
    profile.bio = null;
  }

  const listsResult = await database.query<{
    id: string;
    title: string;
    occasion: string | null;
    event_date: string | null;
    visibility: "public" | "circles";
  }>(
    `SELECT DISTINCT l.id, l.title, l.occasion, l.event_date, l.visibility
       FROM lists l
      WHERE l.owner_id = $1::uuid
        AND (
          l.owner_id = $2::uuid
          OR l.visibility = 'public'
          OR ($2::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM profile_access_requests ar
            WHERE ar.owner_id = l.owner_id AND ar.requester_id = $2::uuid AND ar.status = 'accepted'
          ))
          OR ($2::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM list_circle_access la JOIN circle_members cm ON cm.circle_id = la.circle_id
            WHERE la.list_id = l.id AND cm.user_id = $2::uuid
          ))
          OR ($3::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM profile_share_links share
            JOIN profile_share_link_lists selection ON selection.share_link_id = share.id
            WHERE share.owner_id = l.owner_id AND share.token = $3::uuid
              AND selection.list_id = l.id AND share.revoked_at IS NULL
              AND (share.expires_at IS NULL OR share.expires_at > now())
          ))
        )
      ORDER BY l.created_at DESC, l.id`,
    [profile.id, viewerId, shareToken],
  );
  const listIds = listsResult.rows.map((list) => list.id);
  if (listIds.length === 0) return { profile, lists: [] };

  const giftsResult = await database.query<{
    id: string;
    list_id: string;
    category: ProfilePageData["lists"][number]["gifts"][number]["category"];
    title: string;
    description: string | null;
    url: string | null;
    image_url: string | null;
    image_path: string | null;
    price: string | number | null;
    currency: string;
    priority: ProfilePageData["lists"][number]["gifts"][number]["priority"];
    reservation_status: "reserved" | "purchased" | null;
    reservation_buyer_id: string | null;
  }>(
    `SELECT g.id, g.list_id, g.category, g.title, g.description, g.url, g.image_url,
            g.image_path, g.price, g.currency, g.priority,
            CASE WHEN g.owner_id = $2::uuid THEN NULL ELSE r.status END AS reservation_status,
            CASE WHEN g.owner_id = $2::uuid THEN NULL ELSE r.buyer_id END AS reservation_buyer_id
       FROM gifts g LEFT JOIN reservations r ON r.gift_id = g.id
      WHERE g.list_id = ANY($1::uuid[])
      ORDER BY g.created_at DESC, g.id`,
    [listIds, viewerId],
  );

  return {
    profile,
    lists: listsResult.rows.map((list) => ({
      ...list,
      gifts: giftsResult.rows
        .filter((gift) => gift.list_id === list.id)
        .map(({ list_id: _listId, reservation_status, reservation_buyer_id, price, ...gift }) => ({
          ...gift,
          price: price === null ? null : Number(price),
          reservation: reservation_status
            ? { status: reservation_status, reserved_by_me: reservation_buyer_id === viewerId }
            : null,
        })),
    })),
  };
}

export async function setGiftReservation(
  viewerId: string,
  giftId: string,
  status: "reserved" | "purchased" | null,
  shareToken: string | null = null,
  database: Pool = getDatabasePool(),
) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const giftResult = await client.query<{ owner_id: string; list_id: string }>(
      "SELECT owner_id, list_id FROM gifts WHERE id = $1::uuid FOR UPDATE",
      [giftId],
    );
    const gift = giftResult.rows[0];
    if (!gift) throw new ApiError(404, "NOT_FOUND");
    if (gift.owner_id === viewerId) throw new ApiError(403, "FORBIDDEN");

    const visible = await client.query<{ visible: boolean }>(
      `SELECT (
         l.visibility = 'public'
         OR EXISTS (
           SELECT 1 FROM profile_access_requests ar
           WHERE ar.owner_id = l.owner_id AND ar.requester_id = $2::uuid AND ar.status = 'accepted'
         )
         OR EXISTS (
           SELECT 1 FROM list_circle_access la JOIN circle_members cm ON cm.circle_id = la.circle_id
           WHERE la.list_id = l.id AND cm.user_id = $2::uuid
         )
         OR ($3::uuid IS NOT NULL AND EXISTS (
           SELECT 1 FROM profile_share_links s
           JOIN profile_share_link_lists sl ON sl.share_link_id = s.id
           WHERE s.token = $3::uuid AND s.owner_id = l.owner_id AND sl.list_id = l.id
             AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > now())
         )
       ) AS visible FROM lists l WHERE l.id = $1::uuid`,
      [gift.list_id, viewerId, shareToken],
    );
    if (!visible.rows[0]?.visible) throw new ApiError(403, "FORBIDDEN");

    if (status === null) {
      await client.query(
        "DELETE FROM reservations WHERE gift_id = $1::uuid AND buyer_id = $2::uuid",
        [giftId, viewerId],
      );
    } else {
      const existing = await client.query<{ buyer_id: string }>(
        "SELECT buyer_id FROM reservations WHERE gift_id = $1::uuid FOR UPDATE",
        [giftId],
      );
      if (existing.rows[0] && existing.rows[0].buyer_id !== viewerId) {
        throw new ApiError(409, "ALREADY_RESERVED");
      }
      await client.query(
        `INSERT INTO reservations (gift_id, buyer_id, status)
         VALUES ($1::uuid, $2::uuid, $3::reservation_status)
         ON CONFLICT (gift_id) DO UPDATE SET status = EXCLUDED.status
         WHERE reservations.buyer_id = EXCLUDED.buyer_id`,
        [giftId, viewerId, status],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
