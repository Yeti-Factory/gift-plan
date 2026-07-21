import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721190000_add_gift_categories.sql"),
  "utf8",
);

describe("gift category extension migration", () => {
  it("adds music and leisure without rewriting historical categories", () => {
    expect(migration).toContain("ALTER TYPE public.gift_category");
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'musique'");
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'loisirs'");
    expect(migration).not.toContain("UPDATE public.gifts");
  });
});
