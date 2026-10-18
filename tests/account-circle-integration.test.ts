import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  getProfilePage,
  listProfileDirectory,
  setGiftReservation,
} from "../src/lib/self-hosted/profiles.server";
import { getCircleMember, getCircleDetail, getOffers } from "../src/lib/self-hosted/app.server";
import { runAppAction } from "../src/lib/self-hosted/actions.server";
import { getGiftImageUrls, readUpload } from "../src/lib/self-hosted/files.server";

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
    for (const name of [
      "0001_better_auth.sql",
      "0002_gift_plan.sql",
      "0003_private_lists.sql",
      "0004_private_lists_default.sql",
      "0005_release_events.sql",
      "0007_profile_birthdays.sql",
    ]) {
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

  it("keeps a personal list invisible on a public profile, including to approved contacts", async () => {
    const personal = randomUUID(),
      visible = randomUUID();
    await database.query("UPDATE profiles SET visibility = 'public' WHERE id = $1", [owner]);
    await database.query(
      "INSERT INTO lists (id, owner_id, title, visibility) VALUES ($1, $2, 'Secret personal list', 'private'), ($3, $2, 'Public list', 'public')",
      [personal, owner, visible],
    );
    await database.query(
      "INSERT INTO profile_access_requests (requester_id, owner_id, status) VALUES ($1, $2, 'accepted')",
      [outsider, owner],
    );
    try {
      for (const viewer of [null, outsider, member, peer]) {
        const page = await getProfilePage("owner", viewer, null, database);
        if ("error" in page) throw new Error(page.error);
        expect(page.lists.map((row) => row.id)).toContain(visible);
        expect(JSON.stringify(page)).not.toContain("Secret personal list");
        expect(Object.keys(page)).toEqual(["profile", "lists"]);
      }
      const own = await getProfilePage("owner", owner, null, database);
      if ("error" in own) throw new Error(own.error);
      expect(own.lists.map((row) => row.id)).toContain(personal);
    } finally {
      await database.query("DELETE FROM lists WHERE id = ANY($1::uuid[])", [[personal, visible]]);
      await database.query(
        "DELETE FROM profile_access_requests WHERE requester_id=$1 AND owner_id=$2",
        [outsider, owner],
      );
      await database.query("UPDATE profiles SET visibility = 'private' WHERE id = $1", [owner]);
    }
  });

  it("keeps private profiles locked and never exposes the circles of a public person", async () => {
    await database.query("UPDATE profiles SET visibility='public' WHERE id=$1", [owner]);
    try {
      const directory = await listProfileDirectory(
        outsider,
        { query: "", limit: 50, offset: 0 },
        database,
      );
      expect(directory.profiles.map((row) => row.id)).toContain(owner);
      for (const id of [member, peer]) {
        const card = directory.profiles.find((row) => row.id === id);
        expect(card).toMatchObject({
          can_view: false,
          bio: null,
          birthday: null,
          avatar_url: null,
        });
        expect(card).not.toHaveProperty("circles");
        expect(card).not.toHaveProperty("contacts");
      }
      expect(await getProfilePage("member", outsider, null, database)).toEqual({
        error: "PROFILE_PRIVATE",
      });
      await expect(getCircleDetail(outsider, circle, database)).rejects.toMatchObject({
        status: 403,
      });
      const exact = await listProfileDirectory(
        outsider,
        { query: "member", limit: 50, offset: 0 },
        database,
      );
      expect(exact.profiles[0]).toMatchObject({ id: member, can_view: false, bio: null });
    } finally {
      await database.query("UPDATE profiles SET visibility='private' WHERE id=$1", [owner]);
    }
  });

  it("revokes circle, image, reservation and old share access when a list becomes personal", async () => {
    const privateGift = randomUUID();
    const saved = (await runAppAction(owner, {
      action: "save-list",
      title: "Privacy transition",
      visibility: "circles",
      circleIds: [circle],
    })) as { id: string };
    const share = (await runAppAction(owner, { action: "create-share", listIds: [saved.id] })) as {
      id: string;
      token: string;
    };
    const imagePath = owner + "/" + randomUUID() + ".jpg";
    try {
      await database.query(
        "INSERT INTO gifts (id,owner_id,list_id,title,image_path,category) VALUES ($1,$2,$3,'Secret gift',$4,'culture')",
        [privateGift, owner, saved.id, imagePath],
      );
      expect(await getGiftImageUrls([privateGift], outsider, share.token)).toHaveProperty(
        privateGift,
      );
      await setGiftReservation(outsider, privateGift, "reserved", share.token, database);
      await runAppAction(owner, {
        action: "save-list",
        id: saved.id,
        title: "Privacy transition",
        visibility: "private",
        circleIds: [],
      });
      expect(
        (await getCircleMember(member, circle, owner, database)).lists.map((row) => row.id),
      ).not.toContain(saved.id);
      for (const viewer of [null, member, outsider]) {
        expect(await getGiftImageUrls([privateGift], viewer, share.token)).toEqual({});
        await expect(readUpload("gifts", imagePath, viewer, share.token)).rejects.toMatchObject({
          status: 404,
        });
      }
      await expect(
        setGiftReservation(outsider, privateGift, "purchased", share.token, database),
      ).rejects.toMatchObject({ status: 403 });
      const offers = await getOffers(outsider, database);
      expect(offers.map((row) => row.gift_id)).not.toContain(privateGift);
      const selections = await database.query(
        "SELECT 1 FROM profile_share_link_lists WHERE list_id=$1",
        [saved.id],
      );
      expect(selections.rows).toEqual([]);
      const page = await getProfilePage("owner", outsider, share.token, database);
      expect(page).toEqual({ error: "PROFILE_PRIVATE" });
      expect(await getGiftImageUrls([privateGift], owner, null)).toHaveProperty(privateGift);
      await expect(
        runAppAction(owner, { action: "create-share", listIds: [saved.id] }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await database.query("DELETE FROM lists WHERE id=$1", [saved.id]);
      await database.query("DELETE FROM profile_share_links WHERE id=$1", [share.id]);
    }
  });

  it("finds private accounts by display-name fragments while keeping their content locked", async () => {
    await database.query(
      "UPDATE profiles SET display_name=$2, bio='Private bio', birthday='04-22', avatar_url='https://example.com/private.jpg' WHERE id=$1",
      [member, "Céline Chauvin"],
    );
    await database.query("UPDATE profiles SET display_name=$2 WHERE id=$1", [peer, "Alex Bayon"]);
    try {
      for (const [term, id] of [
        ["chauvin", member],
        ["CHAU", member],
        ["bayon", peer],
      ]) {
        const found = await listProfileDirectory(
          outsider,
          { query: term, limit: 50, offset: 0 },
          database,
        );
        expect(found.profiles.find((row) => row.id === id)).toMatchObject({
          can_view: false,
          bio: null,
          birthday: null,
          avatar_url: null,
        });
      }
      expect(
        (await listProfileDirectory(outsider, { query: "%%", limit: 50, offset: 0 }, database))
          .profiles,
      ).toEqual([]);
      expect(await getProfilePage("member", outsider, null, database)).toEqual({
        error: "PROFILE_PRIVATE",
      });
    } finally {
      await database.query(
        "UPDATE profiles SET display_name=NULL, bio=NULL, birthday=NULL, avatar_url=NULL WHERE id=ANY($1::uuid[])",
        [[member, peer]],
      );
    }
  });

  it("does not let profile approval bypass a circle list's own access settings", async () => {
    await database.query(
      "INSERT INTO profile_access_requests (requester_id,owner_id,status) VALUES ($1,$2,'accepted')",
      [outsider, member],
    );
    try {
      const page = await getProfilePage("member", outsider, null, database);
      if ("error" in page) throw new Error(page.error);
      expect(page.lists).toEqual([]);
      await expect(
        setGiftReservation(outsider, gift, "reserved", null, database),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await database.query(
        "DELETE FROM profile_access_requests WHERE requester_id=$1 AND owner_id=$2",
        [outsider, member],
      );
    }
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

  it.each([
    ["0006_reconnect_for_guide_v2.sql", "guide-v2-2026-10-18"],
    ["0008_reconnect_after_directory_update.sql", "directory-update-reconnect-2026-10-18"],
  ])("%s revokes sessions once and preserves later logins", async (migration, releaseKey) => {
    const signedIn = await post("sign-in/email", {
      email: "member@example.com",
      password: "Test-password-42!",
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers
      .getSetCookie()
      .map((line) => line.split(";")[0])
      .join("; ");
    const headers = new Headers({ cookie });
    expect(
      (await auth.api.getSession({ headers, query: { disableCookieCache: true } }))?.user.id,
    ).toBe(member);
    const resetSql = await readFile(
      new URL("../selfhost/migrations/" + migration, import.meta.url),
      "utf8",
    );
    await database.query(resetSql);
    expect(await auth.api.getSession({ headers, query: { disableCookieCache: true } })).toBeNull();
    const event = await database.query(
      "SELECT revoked_sessions FROM app_release_events WHERE release_key=$1",
      [releaseKey],
    );
    expect(event.rows[0].revoked_sessions).toBeGreaterThanOrEqual(1);
    const later = await post("sign-in/email", {
      email: "member@example.com",
      password: "Test-password-42!",
    });
    expect(later.status).toBe(200);
    const freshHeaders = new Headers({
      cookie: later.headers
        .getSetCookie()
        .map((line) => line.split(";")[0])
        .join("; "),
    });
    expect(
      (await auth.api.getSession({ headers: freshHeaders, query: { disableCookieCache: true } }))
        ?.user.id,
    ).toBe(member);
    await database.query(resetSql);
    expect(
      (await auth.api.getSession({ headers: freshHeaders, query: { disableCookieCache: true } }))
        ?.user.id,
    ).toBe(member);
    expect(
      (
        await database.query(
          "SELECT count(*)::int AS total FROM app_release_events WHERE release_key=$1",
          [releaseKey],
        )
      ).rows[0].total,
    ).toBe(1);
  });

  it("stores signup birthdays, allows edits and protects private-profile birthday data", async () => {
    const created = await post("sign-up/email", {
      name: "Birthday profile",
      email: "birthday@example.com",
      password: "Birthday-Test-42!",
      birthday: "02-29",
    });
    expect(created.status).toBe(200);
    const account = await database.query('SELECT id FROM "user" WHERE email=$1', [
      "birthday@example.com",
    ]);
    const id = account.rows[0].id as string;
    await database.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [id]);
    expect(
      (await database.query("SELECT birthday FROM profiles WHERE id=$1", [id])).rows[0].birthday,
    ).toBe("02-29");
    const data = {
      action: "save-profile",
      displayName: "Birthday profile",
      username: "birthday-profile",
      bio: "Hello",
      visibility: "private",
      emailSearchable: false,
      birthday: "04-22",
    };
    await runAppAction(id, data);
    expect(
      (await database.query('SELECT birthday FROM "user" WHERE id=$1', [id])).rows[0].birthday,
    ).toBe("04-22");
    const directory = await listProfileDirectory(
      outsider,
      { query: "birthday-profile", limit: 50, offset: 0 },
      database,
    );
    expect(directory.profiles[0]).toMatchObject({ id, can_view: false, birthday: null });
    // Even a deliberately public list does not expose the private profile's birthday.
    await database.query(
      "INSERT INTO lists(owner_id,title,visibility) VALUES($1,'Public ideas','public')",
      [id],
    );
    const limited = await getProfilePage("birthday-profile", null, null, database);
    if ("error" in limited) throw new Error(limited.error);
    expect(limited.profile.birthday).toBeNull();
    await runAppAction(id, { ...data, visibility: "public" });
    const visible = await getProfilePage("birthday-profile", null, null, database);
    if ("error" in visible) throw new Error(visible.error);
    expect(visible.profile.birthday).toBe("04-22");
    await expect(runAppAction(id, { ...data, birthday: "04-31" })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      database.query("UPDATE profiles SET birthday='04-31' WHERE id=$1", [id]),
    ).rejects.toMatchObject({ code: "23514" });
  });

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
