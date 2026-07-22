import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authPage = readFileSync(resolve(process.cwd(), "src/routes/auth.tsx"), "utf8");
const webhook = readFileSync(
  resolve(process.cwd(), "src/routes/lovable/email/auth/webhook.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260722193000_hide_unconfirmed_profiles.sql"),
  "utf8",
);

describe("email confirmation flow", () => {
  it("lets an unconfirmed member request a fresh signup email", () => {
    expect(authPage).toContain("supabase.auth.resend");
    expect(authPage).toContain('type: "signup"');
    expect(authPage).toContain("Email de confirmation non reçu ?");
    expect(authPage).toContain("Vérifie aussi les spams");
  });

  it("allows signed signup emails while keeping recovery URL validation", () => {
    expect(webhook).toContain('return actionType !== "recovery" || isExpectedRecoveryUrl(url)');
    expect(webhook).not.toContain(
      'event.data.action_type !== "recovery" || !isExpectedRecoveryUrl(event.data.url)',
    );
  });

  it("excludes unconfirmed auth users from community and public discovery", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.list_profile_directory");
    expect(migration).toContain("account.confirmed_at IS NOT NULL");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.search_public_profiles");
    expect(migration).toContain("u.confirmed_at IS NOT NULL");
  });
});
