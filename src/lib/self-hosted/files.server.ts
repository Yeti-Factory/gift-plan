import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getSelfHostedConfig } from "./config";
import { getDatabasePool } from "./database.server";
import { ApiError } from "./http.server";

const MAX_BYTES = 5 * 1024 * 1024;
const PATH_PATTERN = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp|gif)$/i;

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function sniff(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return "gif";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "webp";
  return null;
}

function diskPath(bucket: "avatars" | "gifts", objectPath: string) {
  if (!PATH_PATTERN.test(objectPath)) throw new ApiError(404, "NOT_FOUND");
  const root = path.resolve(getSelfHostedConfig().uploadDir, bucket);
  const file = path.resolve(root, ...objectPath.split("/"));
  if (!file.startsWith(`${root}${path.sep}`)) throw new ApiError(403, "FORBIDDEN");
  return file;
}

export async function saveUpload(userId: string, kind: unknown, file: unknown) {
  if ((kind !== "avatar" && kind !== "gift") || !(file instanceof File)) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  if (file.size === 0 || file.size > MAX_BYTES) throw new ApiError(400, "INVALID_REQUEST");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = sniff(bytes);
  if (!extension || (kind === "avatar" && extension === "gif")) {
    throw new ApiError(400, "INVALID_REQUEST");
  }
  const objectPath = `${userId}/${randomUUID()}.${extension}`;
  const bucket = kind === "avatar" ? "avatars" : "gifts";
  const target = diskPath(bucket, objectPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  const url = `/api/v1/files/${bucket}/${objectPath}`;
  return { path: objectPath, url };
}

async function canReadGift(pathValue: string, viewerId: string | null, shareToken: string | null) {
  const result = await getDatabasePool().query<{ allowed: boolean }>(
    `SELECT (
       g.owner_id = $2::uuid OR l.visibility = 'public'
       OR ($2::uuid IS NOT NULL AND EXISTS (
         SELECT 1 FROM profile_access_requests ar WHERE ar.owner_id = g.owner_id
           AND ar.requester_id = $2::uuid AND ar.status = 'accepted'
       ))
       OR ($2::uuid IS NOT NULL AND EXISTS (
         SELECT 1 FROM list_circle_access lca JOIN circle_members cm ON cm.circle_id = lca.circle_id
          WHERE lca.list_id = l.id AND cm.user_id = $2::uuid
       ))
       OR ($3::uuid IS NOT NULL AND EXISTS (
         SELECT 1 FROM profile_share_links s
         JOIN profile_share_link_lists sl ON sl.share_link_id = s.id
          WHERE s.token = $3::uuid AND s.owner_id = g.owner_id AND sl.list_id = l.id
            AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > now())
       ))
     ) AS allowed FROM gifts g JOIN lists l ON l.id = g.list_id WHERE g.image_path = $1 LIMIT 1`,
    [pathValue, viewerId, shareToken],
  );
  return result.rows[0]?.allowed ?? false;
}

export async function readUpload(
  bucket: string,
  objectPath: string,
  viewerId: string | null,
  shareToken: string | null,
) {
  if (bucket !== "avatars" && bucket !== "gifts") throw new ApiError(404, "NOT_FOUND");
  if (bucket === "gifts" && !(await canReadGift(objectPath, viewerId, shareToken))) {
    throw new ApiError(404, "NOT_FOUND");
  }
  const file = await readFile(diskPath(bucket, objectPath)).catch(() => null);
  if (!file) throw new ApiError(404, "NOT_FOUND");
  const extension = objectPath.slice(objectPath.lastIndexOf(".") + 1).toLowerCase();
  return new Response(file, {
    headers: {
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "cache-control":
        bucket === "avatars" ? "public, max-age=31536000, immutable" : "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function getGiftImageUrls(
  giftIds: string[],
  viewerId: string | null,
  shareToken: string | null,
) {
  if (giftIds.length === 0) return {};
  const result = await getDatabasePool().query<{ id: string; image_path: string }>(
    `SELECT g.id, g.image_path FROM gifts g JOIN lists l ON l.id = g.list_id
      WHERE g.id = ANY($1::uuid[]) AND g.image_path IS NOT NULL AND (
        g.owner_id = $2::uuid OR l.visibility = 'public'
        OR ($2::uuid IS NOT NULL AND EXISTS (
          SELECT 1 FROM profile_access_requests ar WHERE ar.owner_id = g.owner_id
            AND ar.requester_id = $2::uuid AND ar.status = 'accepted'
        ))
        OR ($2::uuid IS NOT NULL AND EXISTS (
          SELECT 1 FROM list_circle_access lca JOIN circle_members cm ON cm.circle_id = lca.circle_id
           WHERE lca.list_id = l.id AND cm.user_id = $2::uuid
        ))
        OR ($3::uuid IS NOT NULL AND EXISTS (
          SELECT 1 FROM profile_share_links s
          JOIN profile_share_link_lists sl ON sl.share_link_id = s.id
           WHERE s.token = $3::uuid AND s.owner_id = g.owner_id AND sl.list_id = l.id
             AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > now())
        ))
      )`,
    [giftIds, viewerId, shareToken],
  );
  return Object.fromEntries(
    result.rows.map((row) => [
      row.id,
      `/api/v1/files/gifts/${row.image_path}${shareToken ? `?share=${shareToken}` : ""}`,
    ]),
  );
}

export async function purgeQueuedUploads(limit = 100) {
  const database = getDatabasePool();
  const pending = await database.query<{
    id: string;
    bucket: string;
    object_path: string;
    attempt_count: number;
  }>(
    `SELECT id, bucket, object_path, attempt_count
       FROM storage_deletions_queue
      WHERE processed_at IS NULL AND next_attempt_at <= now() AND attempt_count < 10
      ORDER BY next_attempt_at LIMIT $1`,
    [Math.max(1, Math.min(limit, 500))],
  );
  let deleted = 0;
  let failed = 0;
  for (const row of pending.rows) {
    try {
      const bucket =
        row.bucket === "profile-avatars"
          ? "avatars"
          : row.bucket === "gift-images"
            ? "gifts"
            : null;
      if (!bucket) throw new Error("Unknown storage bucket");
      await unlink(diskPath(bucket, row.object_path)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      await database.query(
        "UPDATE storage_deletions_queue SET processed_at = now(), last_error = NULL WHERE id = $1::uuid",
        [row.id],
      );
      deleted += 1;
    } catch (error) {
      failed += 1;
      await database.query(
        `UPDATE storage_deletions_queue
            SET attempt_count = attempt_count + 1,
                last_error = $2,
                next_attempt_at = now() + make_interval(mins => LEAST(60, power(2, attempt_count + 1)::int))
          WHERE id = $1::uuid`,
        [row.id, (error instanceof Error ? error.message : String(error)).slice(0, 500)],
      );
    }
  }
  return { ok: true, deleted, failed, considered: pending.rows.length };
}
