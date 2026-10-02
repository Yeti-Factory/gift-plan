import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  getProfilePage,
  listProfileDirectory,
  setGiftReservation,
} from "../src/lib/self-hosted/profiles.server";
import { getCircleMember } from "../src/lib/self-hosted/app.server";

const mail = vi.hoisted(() => ({ reset: vi.fn(), verify: vi.fn() }));
vi.mock("../src/lib/self-hosted/email.server", () => ({
  sendPasswordResetEmail: mail.reset,
  sendVerificationEmail: mail.verify,
}));
vi.mock("better-auth/tanstack-start", () => ({
  tanstackStartCookies: () => ({ id: "test-cookies" }),
}));

// This suite only connects to an explicitly provided disposable test database.
describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL account and circle journeys", () => {
  const owner = randomUUID(),
    member = randomUUID(),
    peer = randomUUID(),
    outsider = randomUUID();
  const circle = randomUUID(),
    otherCircle = randomUUID(),
    list = randomUUID(),
    hiddenList = randomUUID(),
    gift = randomUUID();
  let database: Pool;
  let schema: string;
  let auth: Awaited<ReturnType<typeof import("../src/lib/self-hosted/auth.server").getAuth>>;
  const origin = "http://localhost:3000";

  beforeAll(async () => {
    schema = "test_" + randomUUID().replaceAll("-", "");
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.query('CREATE SCHEMA "' + schema + '"');
    await admin.end();
    database = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: "-c search_path=" + schema + ",public",
    });
    for (const name of ["0001_better_auth.sql", "0002_gift_plan.sql"]) {
      await database.query(
        await readFile(new URL("../selfhost/migrations/" + name, import.meta.url), "utf8"),
      );
    }
    for (const [id, name] of [
      [owner, "owner"],
      [member, "member"],
      [peer, "peer"],
      [outsider, "outsider"],
    ]) {
      await database.query(
        'INSERT INTO "user" (id, name, email, "emailVerified", username) VALUES ($1, $2, $3, true, $2)',
        [id, name, name + "@example.com"],
      );
    }
    await database.query(
      "INSERT INTO circles (id, name, invite_code, created_by) VALUES ($1, 'Family', 'FAMILY01', $2), ($3, 'Other', 'OTHER001', $2)",
      [circle, owner, otherCircle],
    );
    await database.query(
      "INSERT INTO circle_members (circle_id, user_id) VALUES ($1, $2), ($1, $3)",
      [circle, member, peer],
    );
    await database.query(
      "INSERT INTO lists (id, owner_id, title, visibility) VALUES ($1, $2, 'Shared', 'circles'), ($3, $2, 'Not shared', 'circles')",
      [list, member, hiddenList],
    );
    await database.query(
      "INSERT INTO list_circle_access (list_id, circle_id) VALUES ($1, $2), ($3, $4)",
      [list, circle, hiddenList, otherCircle],
    );
    await database.query(
      "INSERT INTO gifts (id, list_id, owner_id, title, category) VALUES ($1, $2, $3, 'Book', 'culture')",
      [gift, list, member],
    );
    globalThis.giftPlanDatabasePool = database;
    vi.stubEnv("APP_URL", origin);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-that-is-longer-than-thirty-two-characters");
    vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!);
    vi.stubEnv("RESEND_API_KEY_GIFT_PLAN", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("UPLOAD_DIR", "/tmp/gift-plan-test");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    auth = (await import("../src/lib/self-hosted/auth.server")).getAuth();
  }, 30000);

  afterAll(async () => {
    if (database) {
      await database.query('DROP SCHEMA "' + schema + '" CASCADE');
      await database.end();
    }
    globalThis.giftPlanDatabasePool = undefined;
    vi.unstubAllEnvs();
  });

  it("allows private profiles in both directions and between ordinary members", async () => {
    for (const [username, viewer] of [
      ["owner", member],
      ["member", owner],
      ["member", peer],
    ] as const) {
      const page = await getProfilePage(username, viewer, null, database);
      expect(page).not.toHaveProperty("error");
    }
    const directory = await listProfileDirectory(
      owner,
      { query: "member", limit: 50, offset: 0 },
      database,
    );
    expect(directory.profiles[0]?.can_view).toBe(true);
  });

  it("returns only lists shared with the viewer and executes the actual SQL ordering", async () => {
    const page = await getProfilePage("member", peer, null, database);
    if ("error" in page) throw new Error(page.error);
    expect(page.lists.map((row) => row.id)).toEqual([list]);
    expect(page.lists[0].gifts[0].id).toBe(gift);
    const inCircle = await getCircleMember(peer, circle, member, database);
    expect(inCircle.lists.map((row) => row.id)).toEqual([list]);
  });

  it("denies strangers and removes profile access after leaving the only shared circle", async () => {
    expect(await getProfilePage("member", outsider, null, database)).toEqual({
      error: "PROFILE_PRIVATE",
    });
    await database.query("DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2", [
      circle,
      peer,
    ]);
    try {
      expect(await getProfilePage("member", peer, null, database)).toEqual({
        error: "PROFILE_PRIVATE",
      });
    } finally {
      await database.query("INSERT INTO circle_members (circle_id, user_id) VALUES ($1, $2)", [
        circle,
        peer,
      ]);
    }
  });

  it("protects reservations and hides the surprise from the recipient", async () => {
    await expect(
      setGiftReservation(outsider, gift, "reserved", null, database),
    ).rejects.toMatchObject({ status: 403 });
    await setGiftReservation(peer, gift, "reserved", null, database);
    await expect(setGiftReservation(owner, gift, "reserved", null, database)).rejects.toMatchObject(
      { status: 409 },
    );
    const page = await getProfilePage("member", member, null, database);
    if ("error" in page) throw new Error(page.error);
    expect(page.lists.find((row) => row.id === list)?.gifts[0].reservation).toBeNull();
    await setGiftReservation(peer, gift, null, null, database);
  });

  async function post(endpoint: string, body: Record<string, unknown>) {
    return auth.handler(
      new Request(origin + "/api/auth/" + endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body),
      }),
    );
  }

  it("recovers an imported passwordless account and signs in with the new password", async () => {
    mail.reset.mockClear();
    const requested = await post("request-password-reset", {
      email: "member@example.com",
      redirectTo: origin + "/reset-password",
    });
    expect(requested.status).toBe(200);
    expect(mail.reset).toHaveBeenCalledOnce();
    const url = mail.reset.mock.calls[0][1] as string;
    const redirected = await auth.handler(new Request(url));
    const destination = new URL(redirected.headers.get("location")!);
    expect(destination.origin).toBe(origin);
    const token = destination.searchParams.get("token");
    expect(token).toBeTruthy();
    const reset = await post("reset-password", { token, newPassword: "Test-password-42!" });
    expect(reset.status).toBe(200);
    const reused = await post("reset-password", { token, newPassword: "Different-password-42!" });
    expect(reused.status).toBeGreaterThanOrEqual(400);
    const signin = await post("sign-in/email", {
      email: "member@example.com",
      password: "Test-password-42!",
    });
    expect(signin.status).toBe(200);
    expect(signin.headers.get("set-cookie")).toContain("gift-plan");
  }, 30000);

  it("does not reveal account existence when reset email delivery fails", async () => {
    mail.reset.mockClear();
    expect(
      (
        await post("request-password-reset", {
          email: "unknown@example.com",
          redirectTo: origin + "/reset-password",
        })
      ).status,
    ).toBe(200);
    expect(mail.reset).not.toHaveBeenCalled();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mail.reset.mockRejectedValueOnce(new Error("test delivery unavailable"));
    expect(
      (
        await post("request-password-reset", {
          email: "member@example.com",
          redirectTo: origin + "/reset-password",
        })
      ).status,
    ).toBe(200);
    expect(mail.reset).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
