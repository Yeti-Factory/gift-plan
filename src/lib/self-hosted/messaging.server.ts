import type { Pool, PoolClient } from "pg";
import type { Conversation, DirectMessage, MessageInbox, MessageThread } from "@/lib/messaging";
import { getDatabasePool } from "./database.server";
import { ApiError } from "./http.server";
import { requiredText, requiredUuid } from "./app.server";

type Database = Pick<Pool | PoolClient, "query">;
export async function getMessageRecipient(
  userId: string,
  recipientId: string,
  database: Database = getDatabasePool(),
) {
  requiredUuid(recipientId);
  if (userId === recipientId) throw new ApiError(400, "INVALID_REQUEST");
  const result = await database.query(
    `SELECT p.id,p.username,p.display_name,c.id AS conversation_id FROM profiles p
    JOIN "user" u ON u.id=p.id AND u."emailVerified"=true
    LEFT JOIN direct_conversations c ON (c.user_low=$1 AND c.user_high=p.id) OR (c.user_high=$1 AND c.user_low=p.id)
    WHERE p.id=$2`,
    [userId, recipientId],
  );
  if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
  return result.rows[0];
}
const conversationSelect = `SELECT c.id,c.initiated_by,c.status,c.updated_at,
  p.id AS other_id,p.username,p.display_name,
  EXISTS(SELECT 1 FROM direct_message_blocks b WHERE
    (b.blocker_id=c.user_low AND b.blocked_id=c.user_high) OR
    (b.blocker_id=c.user_high AND b.blocked_id=c.user_low)) AS blocked,
  EXISTS(SELECT 1 FROM direct_message_blocks b WHERE b.blocker_id=$1::uuid AND b.blocked_id=p.id) AS blocked_by_me,
  (SELECT count(*)::int FROM direct_messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1::uuid
    AND m.id>CASE WHEN c.user_low=$1::uuid THEN c.read_low ELSE c.read_high END) AS unread
  FROM direct_conversations c JOIN profiles p ON p.id=CASE WHEN c.user_low=$1::uuid THEN c.user_high ELSE c.user_low END
  WHERE $1::uuid IN(c.user_low,c.user_high)`;

export async function getMessageInbox(
  userId: string,
  database: Database = getDatabasePool(),
  offset = 0,
): Promise<MessageInbox> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new ApiError(400, "INVALID_REQUEST");
  const rows = await database.query<Conversation>(
    conversationSelect + " ORDER BY c.updated_at DESC,c.id LIMIT 101 OFFSET $2",
    [userId, offset],
  );
  const count = await database.query<{ unread: number }>(
    `SELECT count(*)::int AS unread FROM direct_messages m
    JOIN direct_conversations c ON c.id=m.conversation_id
    WHERE $1::uuid IN(c.user_low,c.user_high) AND c.status<>'declined' AND m.sender_id<>$1::uuid
    AND m.id>CASE WHEN c.user_low=$1::uuid THEN c.read_low ELSE c.read_high END
    AND NOT EXISTS(SELECT 1 FROM direct_message_blocks b WHERE
      (b.blocker_id=c.user_low AND b.blocked_id=c.user_high) OR (b.blocker_id=c.user_high AND b.blocked_id=c.user_low))`,
    [userId],
  );
  return {
    conversations: rows.rows.slice(0, 100),
    unread: count.rows[0].unread,
    userId,
    hasMore: rows.rows.length > 100,
  };
}

export function messageCursor(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  )
    throw new ApiError(400, "INVALID_REQUEST");
  return value;
}

export async function getMessageThread(
  userId: string,
  conversationId: string,
  before: string | null,
  database: Database = getDatabasePool(),
): Promise<MessageThread> {
  requiredUuid(conversationId);
  const cursor = messageCursor(before);
  const result = await database.query<Conversation>(conversationSelect + " AND c.id=$2::uuid", [
    userId,
    conversationId,
  ]);
  if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND");
  const messages = await database.query<DirectMessage>(
    `SELECT id::text,sender_id,body,created_at FROM direct_messages
    WHERE conversation_id=$1::uuid AND ($2::bigint IS NULL OR id<$2::bigint) ORDER BY id DESC LIMIT 51`,
    [conversationId, cursor],
  );
  return {
    conversation: result.rows[0],
    messages: messages.rows.slice(0, 50).reverse(),
    hasMore: messages.rows.length > 50,
  };
}

export async function messagingAction(
  userId: string,
  body: Record<string, unknown>,
  pool: Pool = getDatabasePool(),
) {
  const action = requiredText(body.action, 40);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize each sender's rate checks and each pair's permission changes.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "dm-user:" + userId,
    ]);
    let otherId: string;
    let conversationId: string | null = null;
    if (action === "message-start" || action === "message-block" || action === "message-unblock")
      otherId = requiredUuid(body.recipientId).toLowerCase();
    else {
      conversationId = requiredUuid(body.conversationId);
      const found = await client.query<{ other_id: string }>(
        `SELECT CASE WHEN user_low=$1::uuid THEN user_high ELSE user_low END AS other_id
        FROM direct_conversations WHERE id=$2::uuid AND $1::uuid IN(user_low,user_high)`,
        [userId, conversationId],
      );
      if (!found.rows[0]) throw new ApiError(404, "NOT_FOUND");
      otherId = found.rows[0].other_id;
    }
    if (otherId === userId) throw new ApiError(400, "INVALID_REQUEST");
    const pair = [userId, otherId].sort();
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "dm-pair:" + pair.join(":"),
    ]);
    const verified = await client.query(
      `SELECT 1 FROM "user" WHERE id=ANY($1::uuid[]) AND "emailVerified"=true`,
      [[userId, otherId]],
    );
    if (verified.rowCount !== 2) throw new ApiError(404, "NOT_FOUND");
    if (action === "message-block" || action === "message-unblock") {
      if (action === "message-block")
        await client.query(
          "INSERT INTO direct_message_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [userId, otherId],
        );
      else
        await client.query(
          "DELETE FROM direct_message_blocks WHERE blocker_id=$1 AND blocked_id=$2",
          [userId, otherId],
        );
    } else {
      const blocked = await client.query(
        "SELECT 1 FROM direct_message_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)",
        [userId, otherId],
      );
      if (action === "message-start") {
        if (blocked.rowCount) throw new ApiError(403, "FORBIDDEN");
        const existing = await client.query<{ id: string }>(
          "SELECT id FROM direct_conversations WHERE user_low=$1 AND user_high=$2",
          pair,
        );
        if (existing.rows[0]) conversationId = existing.rows[0].id;
        else {
          const quota = await client.query<{ count: number }>(
            "SELECT ((SELECT count(*) FROM direct_conversations WHERE initiated_by=$1 AND created_at>now()-interval '1 day')+(SELECT count(*) FROM group_conversations WHERE created_by=$1 AND created_at>now()-interval '1 day'))::int AS count",
            [userId],
          );
          if (quota.rows[0].count >= 10) throw new ApiError(429, "RATE_LIMITED");
          const created = await client.query<{ id: string }>(
            `INSERT INTO direct_conversations(user_low,user_high,initiated_by,status)
            VALUES($1,$2,$3,CASE WHEN EXISTS(SELECT 1 FROM circle_members a JOIN circle_members b ON a.circle_id=b.circle_id
              WHERE a.user_id=$3 AND b.user_id=$4) THEN 'accepted' ELSE 'pending' END) RETURNING id`,
            [...pair, userId, otherId],
          );
          conversationId = created.rows[0].id;
        }
      }
      const record = await client.query<{ status: string; initiated_by: string }>(
        "SELECT status,initiated_by FROM direct_conversations WHERE id=$1 FOR UPDATE",
        [conversationId],
      );
      const conversation = record.rows[0];
      if (action === "message-start" || action === "message-send") {
        if (blocked.rowCount || conversation.status === "declined")
          throw new ApiError(403, "FORBIDDEN");
        const text = requiredText(body.text, 2000),
          nonce = requiredUuid(body.nonce);
        const duplicate = await client.query<{ conversation_id: string }>(
          "SELECT conversation_id FROM direct_messages WHERE sender_id=$1 AND client_nonce=$2",
          [userId, nonce],
        );
        if (duplicate.rows[0] && duplicate.rows[0].conversation_id !== conversationId)
          throw new ApiError(409, "CONFLICT");
        if (!duplicate.rowCount) {
          if (conversation.status === "pending") {
            const prior = await client.query(
              "SELECT 1 FROM direct_messages WHERE conversation_id=$1 LIMIT 1",
              [conversationId],
            );
            if (conversation.initiated_by !== userId || prior.rowCount)
              throw new ApiError(403, "FORBIDDEN");
          }
          const quota = await client.query<{ count: number }>(
            "SELECT ((SELECT count(*) FROM direct_messages WHERE sender_id=$1 AND created_at>now()-interval '1 minute')+(SELECT count(*) FROM group_messages WHERE sender_id=$1 AND created_at>now()-interval '1 minute'))::int AS count",
            [userId],
          );
          if (quota.rows[0].count >= 20) throw new ApiError(429, "RATE_LIMITED");
          await client.query(
            "INSERT INTO direct_messages(conversation_id,sender_id,client_nonce,body) VALUES($1,$2,$3,$4)",
            [conversationId, userId, nonce, text],
          );
          await client.query("UPDATE direct_conversations SET updated_at=now() WHERE id=$1", [
            conversationId,
          ]);
        }
      } else if (action === "message-accept" || action === "message-decline") {
        if (
          blocked.rowCount ||
          conversation.initiated_by === userId ||
          conversation.status !== "pending"
        )
          throw new ApiError(403, "FORBIDDEN");
        await client.query(
          "UPDATE direct_conversations SET status=$2,updated_at=now() WHERE id=$1",
          [conversationId, action === "message-accept" ? "accepted" : "declined"],
        );
      } else if (action === "message-read") {
        const lastId = messageCursor(body.lastId);
        if (!lastId) throw new ApiError(400, "INVALID_REQUEST");
        await client.query(
          `UPDATE direct_conversations c SET
          read_low=CASE WHEN user_low=$2::uuid THEN greatest(read_low,$3::bigint) ELSE read_low END,
          read_high=CASE WHEN user_high=$2::uuid THEN greatest(read_high,$3::bigint) ELSE read_high END
          WHERE c.id=$1 AND EXISTS(SELECT 1 FROM direct_messages m WHERE m.id=$3::bigint AND m.conversation_id=c.id)`,
          [conversationId, userId, lastId],
        );
      } else if (action === "message-report") {
        const id = messageCursor(body.messageId),
          reason = requiredText(body.reason, 500);
        if (!id) throw new ApiError(400, "INVALID_REQUEST");
        const report = await client.query(
          `INSERT INTO direct_message_reports(reporter_id,message_id,reason)
          SELECT $1,m.id,$4 FROM direct_messages m WHERE m.id=$2::bigint AND m.conversation_id=$3 AND m.sender_id<>$1
          ON CONFLICT(reporter_id,message_id) DO UPDATE SET reason=excluded.reason RETURNING id`,
          [userId, id, conversationId, reason],
        );
        if (!report.rowCount) throw new ApiError(404, "NOT_FOUND");
      } else throw new ApiError(400, "INVALID_REQUEST");
    }
    await client.query("COMMIT");
    return { conversationId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMessageReports(userId: string, database: Database = getDatabasePool()) {
  const admin = await database.query("SELECT 1 FROM app_admins WHERE user_id=$1", [userId]);
  if (!admin.rowCount) throw new ApiError(403, "NOT_ADMIN");
  const result =
    await database.query(`SELECT * FROM (SELECT r.id,r.reason,r.created_at,m.body,p.username AS sender,
    reporter.username AS reporter FROM direct_message_reports r JOIN direct_messages m ON m.id=r.message_id
    JOIN profiles p ON p.id=m.sender_id JOIN profiles reporter ON reporter.id=r.reporter_id
    WHERE r.resolved_at IS NULL
    UNION ALL SELECT r.id,r.reason,r.created_at,m.body,p.username AS sender,reporter.username AS reporter
    FROM group_message_reports r JOIN group_messages m ON m.id=r.message_id
    JOIN profiles p ON p.id=m.sender_id JOIN profiles reporter ON reporter.id=r.reporter_id
    WHERE r.resolved_at IS NULL) reports ORDER BY created_at DESC LIMIT 100`);
  return result.rows;
}
export async function resolveMessageReport(
  userId: string,
  reportId: string,
  database: Database = getDatabasePool(),
) {
  requiredUuid(reportId);
  const result = await database.query(
    `WITH direct AS (UPDATE direct_message_reports SET resolved_at=now() WHERE id=$2
    AND EXISTS(SELECT 1 FROM app_admins WHERE user_id=$1) RETURNING id),
    groups AS (UPDATE group_message_reports SET resolved_at=now() WHERE id=$2
    AND EXISTS(SELECT 1 FROM app_admins WHERE user_id=$1) RETURNING id)
    SELECT id FROM direct UNION ALL SELECT id FROM groups`,
    [userId, reportId],
  );
  if (!result.rowCount) throw new ApiError(403, "FORBIDDEN");
}
