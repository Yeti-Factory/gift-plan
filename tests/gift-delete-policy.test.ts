import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721090000_fix_gift_deletion.sql"),
  "utf8",
);

describe("gift deletion policy migration", () => {
  it("allows the gift and list owner to delete without a legacy circle", () => {
    expect(migration).toContain("DROP POLICY IF EXISTS gifts_delete_own");
    expect(migration).toContain("CREATE POLICY gifts_delete_own ON public.gifts");
    expect(migration.match(/owner_id = auth\.uid\(\)/g)).toHaveLength(2);
    expect(migration).not.toContain("is_circle_member");
  });
});
