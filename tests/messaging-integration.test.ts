import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
      "TRUNCATE direct_messages,direct_conversations,direct_message_blocks,direct_message_reports CASCADE",
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
    await expect(resolveMessageReport(b, reports[0].id, database)).rejects.toMatchObject({
      status: 403,
    });
    await resolveMessageReport(a, reports[0].id, database);
    expect(await getMessageReports(a, database)).toEqual([]);
  });
});
