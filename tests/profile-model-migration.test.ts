import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718143000_profile_centric_model.sql"),
  "utf8",
);

describe("profile-centric migration contract", () => {
  it("supports public/private profiles and public/multi-circle lists", () => {
    expect(migration).toContain("profile_visibility AS ENUM ('public', 'private')");
    expect(migration).toContain("list_visibility AS ENUM ('public', 'circles')");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.list_circle_access");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_list_access");
  });

  it("supports revocable direct invitations scoped to selected lists", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.profile_share_links");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.profile_share_link_lists");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.revoke_profile_share_link");
    expect(migration).toContain("public.profile_share_is_valid(l.owner_id, _token, l.id)");
  });

  it("keeps reservation data hidden from the list owner", () => {
    expect(migration).toContain("'reservation', CASE WHEN p.id = viewer THEN NULL ELSE");
    expect(migration).toContain(
      "IF g.owner_id = viewer THEN RAISE EXCEPTION 'OWNER_CANNOT_RESERVE'",
    );
  });

  it("limits email discovery to public profiles with explicit opt-in", () => {
    expect(migration).toContain("WHERE p.visibility = 'public'");
    expect(migration).toContain("p.email_searchable AND lower(coalesce(u.email, '')) = q");
  });
});
