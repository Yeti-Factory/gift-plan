import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721083000_gift_categories.sql"),
  "utf8",
);

describe("gift category migration contract", () => {
  it("adds a backward-compatible category to every gift", () => {
    expect(migration).toContain("CREATE TYPE public.gift_category AS ENUM");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS category public.gift_category NOT NULL DEFAULT 'autre'",
    );
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS gifts_category_idx");
  });

  it("exposes the category through both public gift RPCs", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_profile_page");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_public_list_page");
    expect(migration.match(/'category', g\.category/g)).toHaveLength(2);
  });

  it("preserves the existing function permission boundary", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_profile_page(text, uuid) TO anon, authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_public_list_page(uuid, uuid) TO anon, authenticated",
    );
  });
});
