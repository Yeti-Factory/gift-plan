import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720203000_profile_access_connections.sql"),
  "utf8",
);

describe("profile access migration contract", () => {
  it("creates directional, revocable requests between distinct profiles", () => {
    expect(migration).toContain(
      "profile_access_status AS ENUM ('pending', 'accepted', 'declined')",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.profile_access_requests");
    expect(migration).toContain("CHECK (requester_id <> owner_id)");
    expect(migration).toContain("UNIQUE (requester_id, owner_id)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.revoke_profile_access");
  });

  it("grants accepted requesters access to the profile and all owner lists", () => {
    expect(migration).toMatch(/access_request\.owner_id = p\.id[\s\S]*status = 'accepted'/);
    expect(migration).toMatch(/access_request\.owner_id = l\.owner_id[\s\S]*status = 'accepted'/);
    expect(migration).toContain("public.profile_is_visible(p.id, viewer, NULL) AS can_view");
  });

  it("exposes an authenticated alphabetical directory without private bios", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.list_profile_directory");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_pending_profile_access_count",
    );
    expect(migration).toContain("IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'");
    expect(migration).toContain("WHEN public.profile_is_visible(p.id, viewer, NULL) THEN p.bio");
    expect(migration).toContain("ORDER BY sort_name, lower(username), id");
  });

  it("keeps mutations behind authenticated RPCs", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.profile_access_requests FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.request_profile_access");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.respond_profile_access");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.request_profile_access(uuid)");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.request_profile_access(uuid)\n  TO authenticated",
    );
  });
});
