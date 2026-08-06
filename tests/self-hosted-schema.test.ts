import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authSql = readFileSync(resolve("selfhost/migrations/0001_better_auth.sql"), "utf8");
const appSql = readFileSync(resolve("selfhost/migrations/0002_gift_plan.sql"), "utf8");
const compose = readFileSync(resolve("docker-compose.yml"), "utf8");
const migrationImage = readFileSync(resolve("selfhost/Dockerfile.migrate"), "utf8");

describe("self-hosted PostgreSQL schema", () => {
  it("contains every Better Auth table", () => {
    for (const table of ["user", "session", "account", "verification"]) {
      expect(authSql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it("contains every application table", () => {
    for (const table of [
      "profiles",
      "circles",
      "circle_members",
      "lists",
      "gifts",
      "reservations",
      "profile_access_requests",
      "profile_share_links",
    ]) {
      expect(appSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("keeps every supported gift category", () => {
    for (const category of ["culture", "musique", "loisirs", "autre"]) {
      expect(appSql).toContain(`'${category}'`);
    }
  });

  it("does not depend on Supabase roles or auth functions", () => {
    expect(appSql).not.toMatch(/auth\.uid|service_role|\banon\b|\bauthenticated\b/);
  });

  it("embeds migrations in the image so Coolify can run them", () => {
    expect(compose).toContain("dockerfile: selfhost/Dockerfile.migrate");
    expect(compose).not.toContain("./selfhost/migrations:/migrations");
    expect(migrationImage).toContain("COPY selfhost/migrations /migrations");
  });
});
