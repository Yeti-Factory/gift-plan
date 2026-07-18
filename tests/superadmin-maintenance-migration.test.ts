import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718190000_superadmin_maintenance.sql"),
  "utf8",
);

describe("superadmin maintenance migration contract", () => {
  it("keeps admin and settings tables private", () => {
    expect(migration).toContain("ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.app_admins FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated",
    );
  });

  it("only lets authenticated superadmins change maintenance", () => {
    expect(migration).toContain("IF NOT public.is_superadmin() THEN");
    expect(migration).toContain("RAISE EXCEPTION 'SUPERADMIN_REQUIRED'");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.set_maintenance_mode(boolean, text) TO authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.set_maintenance_mode(boolean, text) FROM PUBLIC, anon",
    );
  });

  it("bootstraps the existing Yovan profile without relying on mutable email", () => {
    expect(migration).toContain("WHERE lower(username) = 'profil-16134649a795'");
    expect(migration).toContain("ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role");
  });

  it("exposes only the public maintenance status", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_app_status()");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_app_status() TO anon, authenticated",
    );
  });
});
