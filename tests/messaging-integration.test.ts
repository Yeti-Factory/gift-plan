import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getAccountData } from "../src/lib/self-hosted/app.server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getGroupInbox,
  getGroupThread,
  getGroupUnread,
  groupMessagingAction,
} from "../src/lib/self-hosted/group-messaging.server";
import { getCircleDetail } from "../src/lib/self-hosted/app.server";
import {
  getMessageInbox,
  getMessageThread,
  getMessageRecipient,
  getMessageReports,
  messagingAction,
  resolveMessageReport,
} from "../src/lib/self-hosted/messaging.server";

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL private messaging", () => {
  let database: Pool, schema: string;
  const a = randomUUID(),
    b = randomUUID(),
    c = randomUUID(),
    d = randomUUID(),
    unverified = randomUUID(),
    circle = randomUUID();
  const act = (user: string, action: string, input: Record<string, unknown> = {}) =>
    messagingAction(user, { action, ...input }, database);
  const start = (user: string, recipientId: string, text = "Bonjour", nonce = randomUUID()) =>
    act(user, "message-start", { recipientId, text, nonce });
  const send = (user: string, conversationId: string, text = "Suite", nonce = randomUUID()) =>
    act(user, "message-send", { conversationId, text, nonce });
  beforeAll(async () => {
    schema = "messages_" + randomUUID().replaceAll("-", "");
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    // Share only the extension; each suite keeps its own disposable schema.
    await admin.query("BEGIN");
    await admin.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('gift-plan-test-extensions',0))",
    );
    await admin.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public");
    await admin.query("COMMIT");
    await admin.query('CREATE SCHEMA "' + schema + '"');
    await admin.end();
    database = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: "-c search_path=" + schema + ",public",
    });
    for (const file of [
      "0001_better_auth.sql",
      "0002_gift_plan.sql",
      "0003_private_lists.sql",
      "0004_private_lists_default.sql",
      "0005_release_events.sql",
      "0007_profile_birthdays.sql",
      "0009_private_messaging.sql",
      "0010_circle_conversations.sql",
    ])
      await database.query(
        await readFile(new URL("../selfhost/migrations/" + file, import.meta.url), "utf8"),
      );
    for (const [id, name] of [
      [a, "alice"],
      [b, "bruno"],
      [c, "celine"],
      [d, "david"],
      [unverified, "unverified"],
    ])
      await database.query(
        'INSERT INTO "user"(id,name,email,"emailVerified",username) VALUES($1,$2,$3,$4,$2)',
        [id, name, name + "@example.com", id !== unverified],
      );
    await database.query(
      "INSERT INTO circles(id,name,invite_code,created_by) VALUES($1,'Family','MSGTEST1',$2)",
      [circle, a],
    );
    await database.query("INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)", [
      circle,
      b,
    ]);
    await database.query("INSERT INTO app_admins(user_id) VALUES($1)", [a]);
  }, 30000);
  beforeEach(async () => {
    await database.query(
      "TRUNCATE direct_messages,direct_conversations,direct_message_blocks,direct_message_reports,group_conversations,group_participants,group_messages,group_message_reports CASCADE",
    );
  });
  afterAll(async () => {
    if (database) {
      await database.query('DROP SCHEMA "' + schema + '" CASCADE');
      await database.end();
    }
  });

  it("opens one direct conversation between circle peers and rejects outsiders on every read/write path", async () => {
    const { conversationId } = await start(a, b);
    expect((await getMessageThread(b, conversationId!, null, database)).conversation.status).toBe(
      "accepted",
    );
    await send(b, conversationId!);
    expect((await getMessageInbox(d, database)).conversations).toEqual([]);
    await expect(getMessageThread(d, conversationId!, null, database)).rejects.toMatchObject({
      status: 404,
    });
    for (const action of [
      "message-send",
      "message-read",
      "message-accept",
      "message-decline",
      "message-report",
    ])
      await expect(
        act(d, action, {
          conversationId,
          text: "Intrusion",
          nonce: randomUUID(),
          lastId: "1",
          messageId: "1",
          reason: "No",
        }),
      ).rejects.toMatchObject({ status: 404 });
    const recipient = await getMessageRecipient(c, b, database);
    expect(Object.keys(recipient).sort()).toEqual([
      "conversation_id",
      "display_name",
      "id",
      "username",
    ]);
    expect(recipient.conversation_id).toBeNull();
    expect((await getMessageRecipient(a, b, database)).conversation_id).toBe(conversationId);
  });
  it("limits non-circle requests to one message and lets only the recipient accept or decline", async () => {
    const { conversationId } = await start(a, c);
    expect((await getMessageThread(c, conversationId!, null, database)).conversation.status).toBe(
      "pending",
    );
    await expect(send(a, conversationId!)).rejects.toMatchObject({ status: 403 });
    await expect(send(c, conversationId!)).rejects.toMatchObject({ status: 403 });
    await expect(act(a, "message-accept", { conversationId })).rejects.toMatchObject({
      status: 403,
    });
    await act(c, "message-accept", { conversationId });
    await send(c, conversationId!);
    const declined = await start(b, d);
    await act(d, "message-decline", declined);
    await expect(start(b, d)).rejects.toMatchObject({ status: 403 });
    await expect(send(d, declined.conversationId!)).rejects.toMatchObject({ status: 403 });
  });
  it("enforces blocks in both directions while preserving history and independent blocks", async () => {
    const { conversationId } = await start(a, b);
    await act(b, "message-block", { recipientId: a });
    await expect(send(a, conversationId!)).rejects.toMatchObject({ status: 403 });
    await expect(send(b, conversationId!)).rejects.toMatchObject({ status: 403 });
    expect((await getMessageThread(a, conversationId!, null, database)).messages).toHaveLength(1);
    expect((await getMessageInbox(b, database)).unread).toBe(0);
    await act(a, "message-block", { recipientId: b });
    await act(b, "message-unblock", { recipientId: a });
    await expect(send(a, conversationId!)).rejects.toMatchObject({ status: 403 });
    await act(a, "message-unblock", { recipientId: b });
    await send(a, conversationId!);
    await act(c, "message-block", { recipientId: d });
    await expect(start(d, c)).rejects.toMatchObject({ status: 403 });
  });
  it("deduplicates simultaneous retries and serializes rate limits", async () => {
    const nonce = randomUUID();
    const results = await Promise.all([
      start(a, b, "Orange !", nonce),
      start(a, b, "Orange !", nonce),
    ]);
    expect(results[0].conversationId).toBe(results[1].conversationId);
    const id = results[0].conversationId!;
    expect((await getMessageThread(b, id, null, database)).messages).toHaveLength(1);
    for (let i = 0; i < 19; i++) await send(a, id);
    await expect(send(a, id)).rejects.toMatchObject({ status: 429 });
    await start(a, b, "Orange !", nonce); // A retry remains safe after reaching the quota.
    expect((await getMessageThread(b, id, null, database)).messages).toHaveLength(20);
  });
  it("advances unread markers only through messages actually displayed in this conversation", async () => {
    const { conversationId } = await start(a, b);
    const first = (await getMessageThread(b, conversationId!, null, database)).messages[0];
    await send(a, conversationId!);
    await act(b, "message-read", { conversationId, lastId: first.id });
    expect((await getMessageInbox(b, database)).unread).toBe(1);
    const other = await start(c, d);
    const foreign = (await getMessageThread(d, other.conversationId!, null, database)).messages[0];
    await act(b, "message-read", { conversationId, lastId: foreign.id });
    expect((await getMessageInbox(b, database)).unread).toBe(1);
    const latest = (await getMessageThread(b, conversationId!, null, database)).messages.at(-1)!;
    await act(b, "message-read", { conversationId, lastId: latest.id });
    await act(b, "message-read", { conversationId, lastId: first.id });
    expect((await getMessageInbox(b, database)).unread).toBe(0);
  });
  it("paginates history without leaking a different conversation and rejects invalid inputs", async () => {
    const { conversationId } = await start(a, b);
    for (let i = 0; i < 55; i++)
      await database.query(
        "INSERT INTO direct_messages(conversation_id,sender_id,client_nonce,body) VALUES($1,$2,$3,$4)",
        [conversationId, a, randomUUID(), "Message " + i],
      );
    const latest = await getMessageThread(b, conversationId!, null, database);
    expect(latest.messages).toHaveLength(50);
    expect(latest.hasMore).toBe(true);
    const older = await getMessageThread(b, conversationId!, latest.messages[0].id, database);
    expect(older.messages).toHaveLength(6);
    expect(older.hasMore).toBe(false);
    expect(new Set([...older.messages, ...latest.messages].map((m) => m.id)).size).toBe(56);
    for (const before of ["0", "-1", "garbage", "9223372036854775808"])
      await expect(getMessageThread(b, conversationId!, before, database)).rejects.toMatchObject({
        status: 400,
      });
    for (const text of [" ", "x".repeat(2001)])
      await expect(send(b, conversationId!, text)).rejects.toMatchObject({ status: 400 });
    await expect(start(a, a)).rejects.toMatchObject({ status: 400 });
    await expect(start(a, unverified)).rejects.toMatchObject({ status: 404 });
  });
  it("limits new contacts and rolls back invalid first messages", async () => {
    const ids = Array.from({ length: 11 }, () => randomUUID());
    try {
      await database.query(
        `INSERT INTO "user"(id,name,email,"emailVerified",username)
        SELECT id,'Contact',id::text||'@example.com',true,'contact-'||left(replace(id::text,'-',''),30) FROM unnest($1::uuid[]) AS id`,
        [ids],
      );
      await expect(start(a, ids[0], " ")).rejects.toMatchObject({ status: 400 });
      expect((await getMessageInbox(a, database)).conversations).toHaveLength(0);
      for (const id of ids.slice(0, 10)) await start(a, id);
      await expect(start(a, ids[10])).rejects.toMatchObject({ status: 429 });
      expect((await getMessageInbox(a, database)).conversations).toHaveLength(10);
    } finally {
      await database.query('DELETE FROM "user" WHERE id=ANY($1::uuid[])', [ids]);
    }
  });

  it("paginates the inbox and removes conversations, reports and blocks with a deleted account", async () => {
    const ids = Array.from({ length: 101 }, () => randomUUID());
    try {
      await database.query(
        `INSERT INTO "user"(id,name,email,"emailVerified",username)
        SELECT id,'Contact',id::text||'@example.com',true,'contact-'||left(replace(id::text,'-',''),30) FROM unnest($1::uuid[]) AS id`,
        [ids],
      );
      await database.query(
        `INSERT INTO direct_conversations(user_low,user_high,initiated_by,status)
        SELECT least($1::uuid,id),greatest($1::uuid,id),$1,'accepted' FROM unnest($2::uuid[]) AS id`,
        [a, ids],
      );
      const first = await getMessageInbox(a, database),
        next = await getMessageInbox(a, database, 100);
      expect(first.conversations).toHaveLength(100);
      expect(first.hasMore).toBe(true);
      expect(next.conversations).toHaveLength(1);
      expect(next.hasMore).toBe(false);
      expect(
        new Set([...first.conversations, ...next.conversations].map((row) => row.id)).size,
      ).toBe(101);
      const recipient = await getMessageRecipient(a, next.conversations[0].other_id, database);
      expect(recipient.conversation_id).toBe(next.conversations[0].id);
      const target = ids[0],
        person = await getMessageRecipient(a, target, database);
      await send(a, person.conversation_id, "À supprimer");
      const message = (await getMessageThread(target, person.conversation_id, null, database))
        .messages[0];
      await act(target, "message-report", {
        conversationId: person.conversation_id,
        messageId: message.id,
        reason: "Test",
      });
      await act(target, "message-block", { recipientId: a });
      await database.query('DELETE FROM "user" WHERE id=$1', [target]);
      expect(
        (
          await database.query("SELECT 1 FROM direct_messages WHERE conversation_id=$1", [
            person.conversation_id,
          ])
        ).rowCount,
      ).toBe(0);
      expect(await getMessageReports(a, database)).toEqual([]);
      expect(
        (await database.query("SELECT 1 FROM direct_message_blocks WHERE blocker_id=$1", [target]))
          .rowCount,
      ).toBe(0);
    } finally {
      await database.query('DELETE FROM "user" WHERE id=ANY($1::uuid[])', [ids]);
    }
  });

  it("exposes only explicitly reported incoming messages to admins and protects moderation", async () => {
    const { conversationId } = await start(a, b, "Texte signalé");
    await send(a, conversationId!, "Autre message privé");
    const first = (await getMessageThread(b, conversationId!, null, database)).messages[0];
    await act(b, "message-report", { conversationId, messageId: first.id, reason: "Harcèlement" });
    await expect(
      act(a, "message-report", { conversationId, messageId: first.id, reason: "Own" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(getMessageReports(b, database)).rejects.toMatchObject({ status: 403 });
    const reports = await getMessageReports(a, database);
    expect(reports).toHaveLength(1);
    expect(reports[0].body).toBe("Texte signalé");
    expect(JSON.stringify(reports)).not.toContain("Autre message privé");
    const exported = await getAccountData(b, database);
    expect(exported.messages.map((row) => row.body)).toEqual([
      "Texte signalé",
      "Autre message privé",
    ]);
    expect(exported.message_reports).toHaveLength(1);
    const stranger = await getAccountData(d, database);
    expect(stranger.messages).toEqual([]);
    expect(stranger.message_reports).toEqual([]);
    await expect(resolveMessageReport(b, reports[0].id, database)).rejects.toMatchObject({
      status: 403,
    });
    await resolveMessageReport(a, reports[0].id, database);
    expect(await getMessageReports(a, database)).toEqual([]);
  });

  describe("circle conversations with excluded members", () => {
    const group = (user: string, action: string, input: Record<string, unknown>) =>
      groupMessagingAction(user, { action, ...input }, database);
    const create = (participants = [a, b], nonce = randomUUID()) =>
      group(a, "group-message-create", {
        circleId: circle,
        title: "Surprise secrète",
        participantIds: participants,
        nonce,
      });
    const post = (user: string, conversationId: string, text = "Orange !", nonce = randomUUID()) =>
      group(user, "group-message-send", { conversationId, text, nonce });
    beforeEach(async () => {
      await database.query(
        "INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING",
        [circle, c, d],
      );
    });
    afterEach(async () => {
      await database.query(
        "DELETE FROM circle_members WHERE circle_id=$1 AND user_id=ANY($2::uuid[])",
        [circle, [c, d]],
      );
    });
    it("excludes circle members from discovery, messages, exports, counts and every mutation", async () => {
      const { conversationId } = await create();
      const thread = await getGroupThread(b, conversationId, null, database);
      expect(thread.participants.map((p) => p.id).sort()).toEqual([a, b].sort());
      expect(thread.messages).toEqual([]);
      await post(a, conversationId);
      expect((await getGroupInbox(b, 0, database)).groups[0]).toMatchObject({
        id: conversationId,
        unread: 1,
      });
      expect(await getGroupUnread(c, database)).toBe(0);
      expect((await getGroupInbox(c, 0, database)).groups).toEqual([]);
      await expect(getGroupThread(c, conversationId, null, database)).rejects.toMatchObject({
        status: 404,
      });
      for (const action of [
        "group-message-send",
        "group-message-read",
        "group-message-report",
        "group-message-leave",
      ])
        await expect(
          group(c, action, {
            conversationId,
            text: "Intrusion",
            nonce: randomUUID(),
            lastId: "1",
            messageId: "1",
            reason: "Test",
          }),
        ).rejects.toMatchObject({ status: 404 });
      expect((await getAccountData(c, database)).group_messages).toEqual([]);
      expect(JSON.stringify(await getCircleDetail(c, circle, database))).not.toContain(
        "Surprise secrète",
      );
    });
    it("validates circle membership and immutable selections, including retry idempotency", async () => {
      await expect(create([a])).rejects.toMatchObject({ status: 400 });
      await expect(create([a, unverified])).rejects.toMatchObject({ status: 403 });
      await expect(
        group(unverified, "group-message-create", {
          circleId: circle,
          title: "Test",
          participantIds: [a, b],
          nonce: randomUUID(),
        }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(create(Array.from({ length: 51 }, () => randomUUID()))).rejects.toMatchObject({
        status: 400,
      });
      const nonce = randomUUID();
      const [first, retry] = await Promise.all([create([a, b], nonce), create([a, b], nonce)]);
      expect(first.conversationId).toBe(retry.conversationId);
      await create([a, b, c, d], nonce);
      expect(
        (await getGroupThread(a, first.conversationId, null, database)).participants,
      ).toHaveLength(2);
      await expect(
        group(a, "group-message-add", {
          conversationId: first.conversationId,
          participantIds: [c],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
    it("never grants access on later circle joins and permanently revokes access on departure", async () => {
      await database.query("DELETE FROM circle_members WHERE circle_id=$1 AND user_id=$2", [
        circle,
        d,
      ]);
      const { conversationId } = await create();
      await database.query("INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)", [
        circle,
        d,
      ]);
      await expect(getGroupThread(d, conversationId, null, database)).rejects.toMatchObject({
        status: 404,
      });
      await database.query("DELETE FROM circle_members WHERE circle_id=$1 AND user_id=$2", [
        circle,
        b,
      ]);
      await expect(getGroupThread(b, conversationId, null, database)).rejects.toMatchObject({
        status: 404,
      });
      await database.query("INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)", [
        circle,
        b,
      ]);
      await expect(getGroupThread(b, conversationId, null, database)).rejects.toMatchObject({
        status: 404,
      });
      expect((await getGroupInbox(b, 0, database)).groups).toEqual([]);
    });
    it("honors bilateral blocks inside a group and lets participants leave permanently", async () => {
      const { conversationId } = await create([a, b, c]);
      await act(b, "message-block", { recipientId: a });
      expect((await getGroupThread(a, conversationId, null, database)).canSend).toBe(false);
      await expect(post(a, conversationId)).rejects.toMatchObject({ status: 403 });
      await expect(post(b, conversationId)).rejects.toMatchObject({ status: 403 });
      await post(c, conversationId);
      await act(b, "message-unblock", { recipientId: a });
      await post(a, conversationId);
      await group(b, "group-message-leave", { conversationId });
      await expect(getGroupThread(b, conversationId, null, database)).rejects.toMatchObject({
        status: 404,
      });
      await post(a, conversationId);
      expect(
        (await getGroupThread(a, conversationId, null, database)).participants.map((p) => p.id),
      ).not.toContain(b);
    });
    it("shares send quotas with direct messages and safely deduplicates retries", async () => {
      const { conversationId } = await create(),
        nonce = randomUUID();
      await Promise.all([
        post(a, conversationId, "Test", nonce),
        post(a, conversationId, "Test", nonce),
      ]);
      expect((await getGroupThread(b, conversationId, null, database)).messages).toHaveLength(1);
      const direct = await start(a, b);
      for (let i = 0; i < 18; i++) await post(a, conversationId);
      await expect(post(a, conversationId)).rejects.toMatchObject({ status: 429 });
      await expect(send(a, direct.conversationId!)).rejects.toMatchObject({ status: 429 });
      await post(a, conversationId, "Test", nonce);
    });
    it("paginates history and advances only valid read markers", async () => {
      const { conversationId } = await create();
      for (let i = 0; i < 56; i++)
        await database.query(
          "INSERT INTO group_messages(conversation_id,sender_id,client_nonce,body,created_at) VALUES($1,$2,$3,$4,now()-interval '1 hour')",
          [conversationId, a, randomUUID(), "Message " + i],
        );
      const latest = await getGroupThread(b, conversationId, null, database);
      expect(latest.messages).toHaveLength(50);
      expect(latest.hasMore).toBe(true);
      const old = await getGroupThread(b, conversationId, latest.messages[0].id, database);
      expect(old.messages).toHaveLength(6);
      expect(old.hasMore).toBe(false);
      expect(new Set([...old.messages, ...latest.messages].map((m) => m.id)).size).toBe(56);
      await group(b, "group-message-read", { conversationId, lastId: old.messages[0].id });
      expect(await getGroupUnread(b, database)).toBe(55);
      const other = await create([a, c]);
      await post(a, other.conversationId);
      const foreign = (await getGroupThread(c, other.conversationId, null, database)).messages[0];
      await group(b, "group-message-read", { conversationId, lastId: foreign.id });
      expect(await getGroupUnread(b, database)).toBe(55);
      await group(b, "group-message-read", { conversationId, lastId: latest.messages.at(-1)!.id });
      expect(await getGroupUnread(b, database)).toBe(0);
      await expect(getGroupThread(b, conversationId, "invalid", database)).rejects.toMatchObject({
        status: 400,
      });
    });
    it("moderates only reported group messages and exports only participant-visible history", async () => {
      const { conversationId } = await create();
      await post(a, conversationId, "Message signalé");
      await post(a, conversationId, "Autre message privé");
      const message = (await getGroupThread(b, conversationId, null, database)).messages[0];
      await group(b, "group-message-report", {
        conversationId,
        messageId: message.id,
        reason: "Test",
      });
      await expect(
        group(c, "group-message-report", { conversationId, messageId: message.id, reason: "Test" }),
      ).rejects.toMatchObject({ status: 404 });
      const reports = await getMessageReports(a, database);
      expect(reports).toHaveLength(1);
      expect(reports[0].body).toBe("Message signalé");
      expect(JSON.stringify(reports)).not.toContain("Autre message privé");
      expect((await getAccountData(b, database)).group_messages).toHaveLength(2);
      expect((await getAccountData(c, database)).group_messages).toEqual([]);
      await expect(resolveMessageReport(b, reports[0].id, database)).rejects.toMatchObject({
        status: 403,
      });
      await resolveMessageReport(a, reports[0].id, database);
      expect(await getMessageReports(a, database)).toEqual([]);
    });
    it("preserves others' messages on account deletion and deletes history with its circle", async () => {
      const user = randomUUID(),
        temporaryCircle = randomUUID();
      try {
        await database.query(
          "INSERT INTO \"user\"(id,name,email,\"emailVerified\",username) VALUES($1,'Temporary',$2,true,'temporary-group-user')",
          [user, user + "@example.com"],
        );
        await database.query("INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)", [
          circle,
          user,
        ]);
        const created = await group(user, "group-message-create", {
          circleId: circle,
          title: "Surprise",
          participantIds: [user, a, b],
          nonce: randomUUID(),
        });
        await post(user, created.conversationId, "À effacer");
        await post(b, created.conversationId, "À garder");
        await database.query('DELETE FROM "user" WHERE id=$1', [user]);
        const remaining = await getGroupThread(b, created.conversationId, null, database);
        expect(remaining.messages.map((m) => m.body)).toEqual(["À garder"]);
        expect(remaining.participants).toHaveLength(2);
        await database.query(
          "INSERT INTO circles(id,name,invite_code,created_by) VALUES($1,'Temp','GROUPTMP',$2)",
          [temporaryCircle, a],
        );
        await database.query("INSERT INTO circle_members(circle_id,user_id) VALUES($1,$2)", [
          temporaryCircle,
          b,
        ]);
        const other = await group(a, "group-message-create", {
          circleId: temporaryCircle,
          title: "Temp",
          participantIds: [a, b],
          nonce: randomUUID(),
        });
        await post(a, other.conversationId);
        await database.query("DELETE FROM circles WHERE id=$1", [temporaryCircle]);
        await expect(getGroupThread(b, other.conversationId, null, database)).rejects.toMatchObject(
          { status: 404 },
        );
        expect(
          (
            await database.query("SELECT 1 FROM group_messages WHERE conversation_id=$1", [
              other.conversationId,
            ])
          ).rowCount,
        ).toBe(0);
      } finally {
        await database.query('DELETE FROM "user" WHERE id=$1', [user]);
        await database.query("DELETE FROM circles WHERE id=$1", [temporaryCircle]);
      }
    });
  });
});
