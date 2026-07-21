import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260721101500_fix_list_creation_returning.sql"),
  "utf8",
);

describe("list creation policy migration", () => {
  it("lets an owner read a newly inserted row before using the visibility helper", () => {
    expect(migration).toContain("DROP POLICY IF EXISTS lists_select_profile_access");
    expect(migration).toContain("CREATE POLICY lists_select_profile_access ON public.lists");
    expect(migration).toContain("owner_id = auth.uid()");
    expect(migration).toContain("OR public.list_is_visible(id, auth.uid(), NULL)");
  });
});
