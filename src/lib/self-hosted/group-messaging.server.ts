import type { Pool, PoolClient } from "pg";
import type {
  GroupConversation,
  GroupInbox,
  GroupMessage,
  GroupThread,
} from "@/lib/group-messaging";
import { requiredText, requiredUuid } from "./app.server";
import { ApiError } from "./http.server";
import { getDatabasePool } from "./database.server";
import { messageCursor } from "./messaging.server";
type Database = Pick<Pool | PoolClient, "query">;
const blockCheck = `SELECT 1 FROM group_participants gp JOIN direct_message_blocks b
  ON (b.blocker_id=$1::uuid AND b.blocked_id=gp.user_id) OR (b.blocked_id=$1::uuid AND b.blocker_id=gp.user_id)
  WHERE gp.conversation_id=$2::uuid`;
export async function getGroupUnread(userId: string, database: Database = getDatabasePool()) {
  const result = await database.query<{ unread: number }>(
    `SELECT count(*)::int AS unread FROM group_participants gp
    JOIN group_messages m ON m.conversation_id=gp.conversation_id
    WHERE gp.user_id=$1 AND m.sender_id<>$1 AND m.id>gp.read_through`,
    [userId],
  );
  return result.rows[0].unread;
}
export async function getGroupInbox(
  userId: string,
  offset = 0,
  database: Database = getDatabasePool(),
): Promise<GroupInbox> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new ApiError(400, "INVALID_REQUEST");
  const rows = await database.query<GroupConversation>(
    `SELECT c.id,c.title,c.updated_at,
    (SELECT count(*)::int FROM group_participants p WHERE p.conversation_id=c.id) AS participant_count,
    (SELECT count(*)::int FROM group_messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.id>gp.read_through) AS unread
    FROM group_conversations c JOIN group_participants gp ON gp.conversation_id=c.id AND gp.user_id=$1
    ORDER BY c.updated_at DESC,c.id LIMIT 51 OFFSET $2`,
    [userId, offset],
  );
  return { groups: rows.rows.slice(0, 50), hasMore: rows.rows.length > 50 };
}
export async function getGroupThread(
  userId: string,
  id: string,
  before: string | null,
  database: Database = getDatabasePool(),
): Promise<GroupThread> {
  requiredUuid(id);
  const cursor = messageCursor(before);
  // Use a single SQL snapshot: revoking membership cannot leak the next read.
  const result = await database.query<{
    conversation: GroupThread["conversation"];
    participants: GroupThread["participants"];
    messages: GroupMessage[];
    can_send: boolean;
  }>(
    `SELECT jsonb_build_object('id',c.id,'title',c.title) AS conversation,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,
      'blocked_by_me',EXISTS(SELECT 1 FROM direct_message_blocks b WHERE b.blocker_id=$1 AND b.blocked_id=p.id)) ORDER BY lower(coalesce(p.display_name,p.username)),p.id),'[]')
     FROM group_participants members JOIN profiles p ON p.id=members.user_id WHERE members.conversation_id=c.id) AS participants,
    (SELECT coalesce(jsonb_agg(to_jsonb(batch)-'sort_id' ORDER BY batch.sort_id DESC),'[]') FROM
      (SELECT m.id::text,m.id AS sort_id,m.sender_id,coalesce(p.display_name,p.username) AS sender_name,m.body,m.created_at
       FROM group_messages m JOIN profiles p ON p.id=m.sender_id WHERE m.conversation_id=c.id
       AND ($3::bigint IS NULL OR m.id<$3::bigint) ORDER BY m.id DESC LIMIT 51) batch) AS messages,
    NOT EXISTS(${blockCheck}) AND (SELECT count(*) FROM group_participants WHERE conversation_id=c.id)>1 AS can_send
    FROM group_conversations c JOIN group_participants access ON access.conversation_id=c.id AND access.user_id=$1
    WHERE c.id=$2`,
    [userId, id, cursor],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "NOT_FOUND");
  return {
    conversation: row.conversation,
    participants: row.participants,
    messages: row.messages.slice(0, 50).reverse(),
    hasMore: row.messages.length > 50,
    canSend: row.can_send,
  };
}
export async function groupMessagingAction(
  userId: string,
  body: Record<string, unknown>,
  pool: Pool = getDatabasePool(),
) {
  const action = requiredText(body.action, 40),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "dm-user:" + userId,
    ]);
    let id: string;
    if (action === "group-message-create") {
      const circleId = requiredUuid(body.circleId),
        title = requiredText(body.title, 80),
        nonce = requiredUuid(body.nonce);
      if (!Array.isArray(body.participantIds) || body.participantIds.length > 50)
        throw new ApiError(400, "INVALID_REQUEST");
      const participants = [
        ...new Set([
          userId,
          ...body.participantIds.map((value) => requiredUuid(value).toLowerCase()),
        ]),
      ];
      if (participants.length < 2 || participants.length > 50)
        throw new ApiError(400, "INVALID_REQUEST");
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM group_conversations WHERE created_by=$1 AND client_nonce=$2",
        [userId, nonce],
      );
      if (existing.rows[0]) {
        const access = await client.query(
          "SELECT 1 FROM group_participants WHERE conversation_id=$1 AND user_id=$2",
          [existing.rows[0].id, userId],
        );
        if (!access.rowCount) throw new ApiError(404, "NOT_FOUND");
        await client.query("COMMIT");
        return { conversationId: existing.rows[0].id };
      }
      const members = await client.query(
        `SELECT cm.user_id FROM circle_members cm JOIN "user" u ON u.id=cm.user_id AND u."emailVerified"=true
        WHERE cm.circle_id=$1 AND cm.user_id=ANY($2::uuid[]) ORDER BY cm.user_id FOR KEY SHARE OF cm`,
        [circleId, participants],
      );
      if (members.rowCount !== participants.length) throw new ApiError(403, "NOT_MEMBER");
      const blocked = await client.query(
        "SELECT 1 FROM direct_message_blocks WHERE blocker_id=ANY($1::uuid[]) AND blocked_id=ANY($1::uuid[]) LIMIT 1",
        [participants],
      );
      if (blocked.rowCount) throw new ApiError(403, "FORBIDDEN");
      const quota = await client.query<{ count: number }>(
        `SELECT (
        (SELECT count(*) FROM group_conversations WHERE created_by=$1 AND created_at>now()-interval '1 day')+
        (SELECT count(*) FROM direct_conversations WHERE initiated_by=$1 AND created_at>now()-interval '1 day'))::int AS count`,
        [userId],
      );
      if (quota.rows[0].count >= 10) throw new ApiError(429, "RATE_LIMITED");
      const created = await client.query<{ id: string }>(
        "INSERT INTO group_conversations(circle_id,created_by,client_nonce,title) VALUES($1,$2,$3,$4) RETURNING id",
        [circleId, userId, nonce, title],
      );
      id = created.rows[0].id;
      await client.query(
        "INSERT INTO group_participants(conversation_id,circle_id,user_id) SELECT $1,$2,member FROM unnest($3::uuid[]) AS member",
        [id, circleId, participants],
      );
    } else {
      id = requiredUuid(body.conversationId);
      // Serialize reads/writes/leave against circle-member removal via the FK row lock.
      const access = await client.query(
        "SELECT 1 FROM group_participants WHERE conversation_id=$1 AND user_id=$2 FOR UPDATE",
        [id, userId],
      );
      if (!access.rowCount) throw new ApiError(404, "NOT_FOUND");
      if (action === "group-message-send") {
        const text = requiredText(body.text, 2000),
          nonce = requiredUuid(body.nonce);
        // Pair locks match direct-message block mutations, preserving block guarantees.
        const participants = await client.query<{ user_id: string }>(
          "SELECT user_id FROM group_participants WHERE conversation_id=$1 ORDER BY user_id",
          [id],
        );
        if (participants.rows.length < 2) throw new ApiError(403, "FORBIDDEN");
        for (const person of participants.rows) {
          if (person.user_id === userId) continue;
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
            "dm-pair:" + [userId, person.user_id].sort().join(":"),
          ]);
        }
        if ((await client.query(blockCheck, [userId, id])).rowCount)
          throw new ApiError(403, "FORBIDDEN");
        const duplicate = await client.query<{ conversation_id: string }>(
          "SELECT conversation_id FROM group_messages WHERE sender_id=$1 AND client_nonce=$2",
          [userId, nonce],
        );
        if (duplicate.rows[0] && duplicate.rows[0].conversation_id !== id)
          throw new ApiError(409, "CONFLICT");
        if (!duplicate.rowCount) {
          const quota = await client.query<{ count: number }>(
            `SELECT ((SELECT count(*) FROM direct_messages WHERE sender_id=$1 AND created_at>now()-interval '1 minute')+
            (SELECT count(*) FROM group_messages WHERE sender_id=$1 AND created_at>now()-interval '1 minute'))::int AS count`,
            [userId],
          );
          if (quota.rows[0].count >= 20) throw new ApiError(429, "RATE_LIMITED");
          await client.query(
            "INSERT INTO group_messages(conversation_id,sender_id,client_nonce,body) VALUES($1,$2,$3,$4)",
            [id, userId, nonce, text],
          );
          await client.query("UPDATE group_conversations SET updated_at=now() WHERE id=$1", [id]);
        }
      } else if (action === "group-message-read") {
        const last = messageCursor(body.lastId);
        if (!last) throw new ApiError(400, "INVALID_REQUEST");
        await client.query(
          `UPDATE group_participants p SET read_through=greatest(read_through,$3::bigint)
          WHERE conversation_id=$1 AND user_id=$2 AND EXISTS(SELECT 1 FROM group_messages WHERE id=$3::bigint AND conversation_id=$1)`,
          [id, userId, last],
        );
      } else if (action === "group-message-leave") {
        await client.query(
          "DELETE FROM group_participants WHERE conversation_id=$1 AND user_id=$2",
          [id, userId],
        );
      } else if (action === "group-message-report") {
        const messageId = messageCursor(body.messageId),
          reason = requiredText(body.reason, 500);
        if (!messageId) throw new ApiError(400, "INVALID_REQUEST");
        const report = await client.query(
          `INSERT INTO group_message_reports(reporter_id,message_id,reason)
          SELECT $1,id,$4 FROM group_messages WHERE id=$2::bigint AND conversation_id=$3 AND sender_id<>$1
          ON CONFLICT(reporter_id,message_id) DO UPDATE SET reason=excluded.reason RETURNING id`,
          [userId, messageId, id, reason],
        );
        if (!report.rowCount) throw new ApiError(404, "NOT_FOUND");
      } else throw new ApiError(400, "INVALID_REQUEST");
    }
    await client.query("COMMIT");
    return { conversationId: id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
