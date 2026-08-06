import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

import { ApiError } from "./http.server";
import { getDatabasePool } from "./database.server";
import { optionalText, optionalUuid, requiredText, requiredUuid } from "./app.server";
import { setGiftReservation } from "./profiles.server";
import { purgeQueuedUploads } from "./files.server";

const CATEGORIES = new Set([
  "culture",
  "tech_geek",
  "informatique",
  "beaute_bien_etre",
  "mode",
  "sport",
  "maison_deco",
  "jeux_loisirs",
  "gastronomie",
  "voyages_experiences",
  "enfants",
  "musique",
  "loisirs",
  "autre",
]);
const PRIORITIES = new Set(["indispensable", "j_adorerais", "me_plairait"]);

function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new ApiError(400, "INVALID_REQUEST");
  return value;
}

function uuidArray(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) throw new ApiError(400, "INVALID_REQUEST");
  return [...new Set(value.map(requiredUuid))];
}

function enumValue(value: unknown, allowed: Set<string>) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  return value;
}

function safeStoredPath(value: unknown, userId: string) {
  const path = optionalText(value, 500);
  if (path && (!path.startsWith(`${userId}/`) || path.includes("..") || path.startsWith("/"))) {
    throw new ApiError(403, "FORBIDDEN");
  }
  return path;
}

async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requireAdmin(client: PoolClient, circleId: string, userId: string) {
  const result = await client.query<{ created_by: string }>(
    `SELECT c.created_by FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
      WHERE c.id = $1::uuid AND cm.user_id = $2::uuid AND cm.role = 'admin' FOR UPDATE OF c`,
    [circleId, userId],
  );
  if (!result.rows[0]) throw new ApiError(403, "NOT_ADMIN");
  return result.rows[0];
}

async function validateListCircles(client: PoolClient, userId: string, circleIds: string[]) {
  if (circleIds.length === 0) return;
  const result = await client.query<{ id: string }>(
    `SELECT c.id FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
      WHERE cm.user_id = $1::uuid AND c.id = ANY($2::uuid[])`,
    [userId, circleIds],
  );
  if (result.rowCount !== circleIds.length) throw new ApiError(403, "FORBIDDEN");
}

async function saveList(userId: string, body: Record<string, unknown>) {
  const id = optionalUuid(body.id);
  const title = requiredText(body.title, 160);
  const occasion = optionalText(body.occasion, 160);
  const visibility = enumValue(body.visibility, new Set(["public", "circles"]));
  const circleIds = uuidArray(body.circleIds ?? []);
  if (visibility === "circles" && circleIds.length === 0) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  return transaction(async (client) => {
    await validateListCircles(client, userId, circleIds);
    const result = id
      ? await client.query<{ id: string }>(
          `UPDATE lists SET title = $3, occasion = $4, visibility = $5::list_visibility,
                  circle_id = $6::uuid
            WHERE id = $1::uuid AND owner_id = $2::uuid RETURNING id`,
          [id, userId, title, occasion, visibility, visibility === "circles" ? circleIds[0] : null],
        )
      : await client.query<{ id: string }>(
          `INSERT INTO lists (owner_id, title, occasion, visibility, circle_id)
           VALUES ($1::uuid, $2, $3, $4::list_visibility, $5::uuid) RETURNING id`,
          [userId, title, occasion, visibility, visibility === "circles" ? circleIds[0] : null],
        );
    if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
    const listId = result.rows[0].id;
    await client.query("DELETE FROM list_circle_access WHERE list_id = $1::uuid", [listId]);
    if (visibility === "circles") {
      await client.query(
        `INSERT INTO list_circle_access (list_id, circle_id)
         SELECT $1::uuid, unnest($2::uuid[])`,
        [listId, circleIds],
      );
    }
    return { id: listId };
  });
}

async function saveGift(userId: string, body: Record<string, unknown>) {
  const id = optionalUuid(body.id);
  const listId = requiredUuid(body.listId);
  const title = requiredText(body.title, 200);
  const description = optionalText(body.description, 4_000);
  const url = optionalText(body.url, 2_048);
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      throw new ApiError(400, "INVALID_REQUEST");
    }
  }
  const imageUrl = optionalText(body.imageUrl, 2_048);
  const imagePath = safeStoredPath(body.imagePath, userId);
  const category = enumValue(body.category, CATEGORIES);
  const priority = enumValue(body.priority, PRIORITIES);
  const price = body.price === null || body.price === "" ? null : Number(body.price);
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 99_999_999)) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  const result = id
    ? await getDatabasePool().query<{ id: string }>(
        `UPDATE gifts g SET title = $4, description = $5, url = $6, image_url = $7,
                image_path = $8, price = $9, currency = 'EUR', priority = $10::gift_priority,
                category = $11::gift_category
          FROM lists l WHERE g.id = $1::uuid AND g.list_id = $2::uuid
            AND g.list_id = l.id AND l.owner_id = $3::uuid RETURNING g.id`,
        [
          id,
          listId,
          userId,
          title,
          description,
          url,
          imageUrl,
          imagePath,
          price,
          priority,
          category,
        ],
      )
    : await getDatabasePool().query<{ id: string }>(
        `INSERT INTO gifts (list_id, owner_id, title, description, url, image_url, image_path,
                            price, currency, priority, category)
         SELECT l.id, $2::uuid, $3, $4, $5, $6, $7, $8, 'EUR', $9::gift_priority,
                $10::gift_category FROM lists l
          WHERE l.id = $1::uuid AND l.owner_id = $2::uuid RETURNING id`,
        [listId, userId, title, description, url, imageUrl, imagePath, price, priority, category],
      );
  if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
  return result.rows[0];
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function createCircle(userId: string, body: Record<string, unknown>) {
  const name = requiredText(body.name, 100);
  return transaction(async (client) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const result = await client.query(
          `INSERT INTO circles (name, invite_code, created_by)
           VALUES ($1, $2, $3::uuid) RETURNING id, name, created_at`,
          [name, inviteCode(), userId],
        );
        return result.rows[0];
      } catch (error) {
        if ((error as { code?: string }).code !== "23505" || attempt === 5) throw error;
      }
    }
    throw new ApiError(409, "CONFLICT");
  });
}

async function joinCircle(userId: string, body: Record<string, unknown>) {
  const code = requiredText(body.code, 32).toUpperCase();
  return transaction(async (client) => {
    await client.query("DELETE FROM join_attempts WHERE attempted_at < now() - interval '1 hour'");
    const attempts = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM join_attempts
        WHERE user_id = $1::uuid AND attempted_at > now() - interval '10 minutes'`,
      [userId],
    );
    if ((attempts.rows[0]?.count ?? 0) >= 5) return { ok: false, error: "RATE_LIMITED" };
    await client.query("INSERT INTO join_attempts (user_id) VALUES ($1::uuid)", [userId]);
    const circle = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM circles WHERE invite_code = $1
        AND invite_code_revoked_at IS NULL AND invite_code_expires_at > now()`,
      [code],
    );
    if (!circle.rows[0]) return { ok: false, error: "CODE_INVALID" };
    const banned = await client.query(
      "SELECT 1 FROM circle_bans WHERE circle_id = $1::uuid AND user_id = $2::uuid",
      [circle.rows[0].id, userId],
    );
    if (banned.rows[0]) return { ok: false, error: "BANNED" };
    await client.query(
      `INSERT INTO circle_members (circle_id, user_id, role)
       VALUES ($1::uuid, $2::uuid, 'member') ON CONFLICT DO NOTHING`,
      [circle.rows[0].id, userId],
    );
    return { ok: true, circle_id: circle.rows[0].id, circle_name: circle.rows[0].name };
  });
}

async function regenerateCircleCode(userId: string, body: Record<string, unknown>) {
  const circleId = requiredUuid(body.circleId);
  return transaction(async (client) => {
    await requireAdmin(client, circleId, userId);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = inviteCode();
      try {
        await client.query(
          `UPDATE circles SET invite_code = $2, invite_code_created_at = now(),
                  invite_code_expires_at = now() + interval '30 days', invite_code_revoked_at = NULL
            WHERE id = $1::uuid`,
          [circleId, code],
        );
        return { code };
      } catch (error) {
        if ((error as { code?: string }).code !== "23505" || attempt === 5) throw error;
      }
    }
    throw new ApiError(409, "CONFLICT");
  });
}

async function circleMemberAction(
  userId: string,
  body: Record<string, unknown>,
  kind: "role" | "remove",
) {
  const circleId = requiredUuid(body.circleId);
  const memberId = requiredUuid(body.userId);
  return transaction(async (client) => {
    const circle = await requireAdmin(client, circleId, userId);
    if (circle.created_by === memberId) throw new ApiError(403, "FORBIDDEN_CREATOR");
    const actor = await client.query<{ display_name: string | null }>(
      "SELECT display_name FROM profiles WHERE id = $1::uuid",
      [userId],
    );
    const target = await client.query<{ display_name: string | null }>(
      "SELECT display_name FROM profiles WHERE id = $1::uuid",
      [memberId],
    );
    if (!target.rows[0]) throw new ApiError(404, "NOT_FOUND");
    if (kind === "role") {
      const role = enumValue(body.role, new Set(["admin", "member"]));
      const updated = await client.query(
        `UPDATE circle_members SET role = $3::circle_role
          WHERE circle_id = $1::uuid AND user_id = $2::uuid RETURNING user_id`,
        [circleId, memberId, role],
      );
      if (!updated.rows[0]) throw new ApiError(404, "NOT_FOUND");
      await client.query(
        `INSERT INTO circle_activity (circle_id, action, actor_id, actor_name, target_id, target_name)
         VALUES ($1::uuid, $2, $3::uuid, $4, $5::uuid, $6)`,
        [
          circleId,
          role === "admin" ? "role_promoted" : "role_demoted",
          userId,
          actor.rows[0]?.display_name,
          memberId,
          target.rows[0].display_name,
        ],
      );
    } else {
      const removed = await client.query(
        `DELETE FROM circle_members WHERE circle_id = $1::uuid AND user_id = $2::uuid
         RETURNING user_id`,
        [circleId, memberId],
      );
      if (!removed.rows[0]) throw new ApiError(404, "NOT_FOUND");
      await client.query(
        "INSERT INTO circle_bans (circle_id, user_id, banned_by) VALUES ($1::uuid, $2::uuid, $3::uuid) ON CONFLICT DO NOTHING",
        [circleId, memberId, userId],
      );
      await client.query(
        `INSERT INTO circle_activity (circle_id, action, actor_id, actor_name, target_id, target_name)
         VALUES ($1::uuid, 'member_removed', $2::uuid, $3, $4::uuid, $5)`,
        [circleId, userId, actor.rows[0]?.display_name, memberId, target.rows[0].display_name],
      );
    }
  });
}

async function leaveCircle(userId: string, body: Record<string, unknown>) {
  const circleId = requiredUuid(body.circleId);
  return transaction(async (client) => {
    const membership = await client.query<{ created_by: string; name: string }>(
      `SELECT c.created_by, c.name FROM circles c JOIN circle_members cm ON cm.circle_id = c.id
        WHERE c.id = $1::uuid AND cm.user_id = $2::uuid FOR UPDATE OF c`,
      [circleId, userId],
    );
    if (!membership.rows[0]) throw new ApiError(403, "NOT_MEMBER");
    if (membership.rows[0].created_by !== userId) {
      await client.query(
        "DELETE FROM circle_members WHERE circle_id = $1::uuid AND user_id = $2::uuid",
        [circleId, userId],
      );
      return { circle_deleted: false };
    }
    const successor = await client.query<{ user_id: string; display_name: string | null }>(
      `SELECT cm.user_id, p.display_name FROM circle_members cm JOIN profiles p ON p.id = cm.user_id
        WHERE cm.circle_id = $1::uuid AND cm.user_id <> $2::uuid
        ORDER BY CASE cm.role WHEN 'admin' THEN 0 ELSE 1 END, cm.joined_at LIMIT 1`,
      [circleId, userId],
    );
    if (!successor.rows[0]) {
      await client.query("DELETE FROM circles WHERE id = $1::uuid", [circleId]);
      return { circle_deleted: true };
    }
    await client.query("UPDATE circles SET created_by = $2::uuid WHERE id = $1::uuid", [
      circleId,
      successor.rows[0].user_id,
    ]);
    await client.query(
      "UPDATE circle_members SET role = 'admin' WHERE circle_id = $1::uuid AND user_id = $2::uuid",
      [circleId, successor.rows[0].user_id],
    );
    await client.query(
      "DELETE FROM circle_members WHERE circle_id = $1::uuid AND user_id = $2::uuid",
      [circleId, userId],
    );
    return {
      circle_deleted: false,
      new_owner_id: successor.rows[0].user_id,
      new_owner_name: successor.rows[0].display_name,
    };
  });
}

async function saveProfile(userId: string, body: Record<string, unknown>) {
  const displayName = requiredText(body.displayName, 60);
  const username = requiredText(body.username, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(username)) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  const bio = optionalText(body.bio, 1_000);
  const visibility = enumValue(body.visibility, new Set(["public", "private"]));
  const emailSearchable = boolean(body.emailSearchable);
  try {
    const result = await getDatabasePool().query(
      `UPDATE profiles SET display_name = $2, username = $3, bio = $4,
              visibility = $5::profile_visibility, email_searchable = $6
        WHERE id = $1::uuid RETURNING *`,
      [userId, displayName, username, bio, visibility, emailSearchable],
    );
    await getDatabasePool().query(
      'UPDATE "user" SET name = $2, "updatedAt" = now() WHERE id = $1::uuid',
      [userId, displayName],
    );
    return result.rows[0];
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new ApiError(409, "CONFLICT");
    throw error;
  }
}

async function createShare(userId: string, body: Record<string, unknown>) {
  const listIds = uuidArray(body.listIds);
  if (listIds.length === 0) throw new ApiError(400, "INVALID_REQUEST");
  const label = optionalText(body.label, 100);
  return transaction(async (client) => {
    const owned = await client.query(
      "SELECT id FROM lists WHERE owner_id = $1::uuid AND id = ANY($2::uuid[])",
      [userId, listIds],
    );
    if (owned.rowCount !== listIds.length) throw new ApiError(403, "FORBIDDEN");
    const link = await client.query<{ id: string; token: string }>(
      "INSERT INTO profile_share_links (owner_id, label) VALUES ($1::uuid, $2) RETURNING id, token",
      [userId, label],
    );
    await client.query(
      `INSERT INTO profile_share_link_lists (share_link_id, list_id)
       SELECT $1::uuid, unnest($2::uuid[])`,
      [link.rows[0].id, listIds],
    );
    return link.rows[0];
  });
}

async function updateMaintenance(userId: string, body: Record<string, unknown>) {
  const admin = await getDatabasePool().query("SELECT 1 FROM app_admins WHERE user_id = $1::uuid", [
    userId,
  ]);
  if (!admin.rows[0]) throw new ApiError(403, "FORBIDDEN");
  const enabled = boolean(body.enabled);
  const message = requiredText(body.message, 500);
  const result = await getDatabasePool().query(
    `UPDATE app_settings SET maintenance_mode = $2, maintenance_message = $3,
            updated_at = now(), updated_by = $1::uuid WHERE id = true
      RETURNING maintenance_mode AS maintenance, maintenance_message AS message`,
    [userId, enabled, message],
  );
  return { ...result.rows[0], is_superadmin: true };
}

export async function runAppAction(
  userId: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  switch (body.action) {
    case "save-list":
      return saveList(userId, body);
    case "delete-list": {
      const result = await getDatabasePool().query(
        "DELETE FROM lists WHERE id = $1::uuid AND owner_id = $2::uuid RETURNING id",
        [requiredUuid(body.id), userId],
      );
      if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
      await purgeQueuedUploads().catch(() => undefined);
      return result.rows[0];
    }
    case "save-gift": {
      const result = await saveGift(userId, body);
      await purgeQueuedUploads().catch(() => undefined);
      return result;
    }
    case "delete-gift": {
      const result = await getDatabasePool().query(
        "DELETE FROM gifts WHERE id = $1::uuid AND owner_id = $2::uuid RETURNING id",
        [requiredUuid(body.id), userId],
      );
      if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
      await purgeQueuedUploads().catch(() => undefined);
      return result.rows[0];
    }
    case "create-circle":
      return createCircle(userId, body);
    case "join-circle":
      return joinCircle(userId, body);
    case "regenerate-circle-code":
      return regenerateCircleCode(userId, body);
    case "set-circle-role":
      return circleMemberAction(userId, body, "role");
    case "remove-circle-member":
      return circleMemberAction(userId, body, "remove");
    case "leave-circle":
      return leaveCircle(userId, body);
    case "reserve":
      return setGiftReservation(
        userId,
        requiredUuid(body.giftId),
        body.status === null
          ? null
          : (enumValue(body.status, new Set(["reserved", "purchased"])) as
              | "reserved"
              | "purchased"),
        optionalUuid(body.shareToken),
      );
    case "cancel-reservation": {
      const result = await getDatabasePool().query(
        "DELETE FROM reservations WHERE id = $1::uuid AND buyer_id = $2::uuid RETURNING id",
        [requiredUuid(body.id), userId],
      );
      if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
      return result.rows[0];
    }
    case "save-profile":
      return saveProfile(userId, body);
    case "save-avatar": {
      const path = safeStoredPath(body.path, userId);
      const url = optionalText(body.url, 1_000);
      await getDatabasePool().query(
        "UPDATE profiles SET avatar_path = $2, avatar_url = $3 WHERE id = $1::uuid",
        [userId, path, url],
      );
      await getDatabasePool().query(
        'UPDATE "user" SET image = $2, "updatedAt" = now() WHERE id = $1::uuid',
        [userId, url],
      );
      await purgeQueuedUploads().catch(() => undefined);
      return { path, url };
    }
    case "discard-upload": {
      const path = safeStoredPath(body.path, userId);
      const kind = enumValue(body.kind, new Set(["avatar", "gift"]));
      if (!path) return;
      const referenced = await getDatabasePool().query(
        kind === "avatar"
          ? "SELECT 1 FROM profiles WHERE avatar_path = $1 LIMIT 1"
          : "SELECT 1 FROM gifts WHERE image_path = $1 LIMIT 1",
        [path],
      );
      if (!referenced.rows[0]) {
        await getDatabasePool().query(
          `INSERT INTO storage_deletions_queue (bucket, object_path, reason)
           VALUES ($1, $2, 'uncommitted_upload')`,
          [kind === "avatar" ? "profile-avatars" : "gift-images", path],
        );
        await purgeQueuedUploads().catch(() => undefined);
      }
      return;
    }
    case "create-share":
      return createShare(userId, body);
    case "revoke-share": {
      const result = await getDatabasePool().query(
        "UPDATE profile_share_links SET revoked_at = now() WHERE id = $1::uuid AND owner_id = $2::uuid RETURNING id",
        [requiredUuid(body.id), userId],
      );
      if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
      return result.rows[0];
    }
    case "onboarding": {
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 1 || version > 1_000) {
        throw new ApiError(400, "INVALID_REQUEST");
      }
      await getDatabasePool().query(
        `UPDATE profiles SET onboarding_version = $2,
                onboarding_completed_at = coalesce(onboarding_completed_at, now())
          WHERE id = $1::uuid`,
        [userId, version],
      );
      return;
    }
    case "set-display-name": {
      const name = requiredText(body.displayName, 60);
      await transaction(async (client) => {
        await client.query("UPDATE profiles SET display_name = $2 WHERE id = $1::uuid", [
          userId,
          name,
        ]);
        await client.query('UPDATE "user" SET name = $2, "updatedAt" = now() WHERE id = $1::uuid', [
          userId,
          name,
        ]);
      });
      return;
    }
    case "maintenance":
      return updateMaintenance(userId, body);
    default:
      throw new ApiError(400, "INVALID_REQUEST");
  }
}
