import type { Pool, PoolClient } from "pg";
import type { MessageNotificationsSnapshot } from "../message-notifications";
import { getDatabasePool } from "./database.server";

export async function getMessageNotifications(
  userId: string,
  database: Pick<Pool | PoolClient, "query"> = getDatabasePool(),
): Promise<MessageNotificationsSnapshot> {
  // One snapshot, scoped to conversations the current user can access. No message bodies.
  const result = await database.query<MessageNotificationsSnapshot>(
    `WITH direct_received AS (
      SELECT m.id,m.created_at,
        CASE WHEN c.user_low=$1::uuid THEN c.user_high ELSE c.user_low END AS recipient_id,
        m.id>CASE WHEN c.user_low=$1::uuid THEN c.read_low ELSE c.read_high END AS unread
      FROM direct_conversations c JOIN direct_messages m ON m.conversation_id=c.id
      WHERE $1::uuid IN(c.user_low,c.user_high) AND m.sender_id<>$1::uuid AND c.status<>'declined'
      AND NOT EXISTS(SELECT 1 FROM direct_message_blocks b WHERE
        (b.blocker_id=c.user_low AND b.blocked_id=c.user_high) OR
        (b.blocker_id=c.user_high AND b.blocked_id=c.user_low))
    ), group_received AS (
      SELECT m.id,m.created_at,m.conversation_id,m.id>gp.read_through AS unread
      FROM group_participants gp JOIN group_messages m ON m.conversation_id=gp.conversation_id
      WHERE gp.user_id=$1::uuid AND m.sender_id<>$1::uuid
    )
    SELECT ((SELECT count(*) FROM direct_received WHERE unread)+
            (SELECT count(*) FROM group_received WHERE unread))::int AS unread,
      (SELECT jsonb_build_object('id',id::text,'createdAt',created_at,'unread',unread,'recipientId',recipient_id)
       FROM direct_received ORDER BY id DESC LIMIT 1) AS direct,
      (SELECT jsonb_build_object('id',id::text,'createdAt',created_at,'unread',unread,'groupId',conversation_id)
       FROM group_received ORDER BY id DESC LIMIT 1) AS "group"`,
    [userId],
  );
  return result.rows[0];
}
