import { describe, expect, it } from "vitest";

import { normalizeSupabaseAuthEmailPayload } from "@/lib/supabase-auth-email";

const options = {
  appUrl: "https://gift-plan.yeti-lab.fr",
  supabaseUrl: "https://project.supabase.co",
  messageId: "msg_123",
};

describe("Supabase Send Email Hook payloads", () => {
  it("turns a signup payload into a Supabase confirmation link", () => {
    const events = normalizeSupabaseAuthEmailPayload(
      {
        user: { email: "lilas.raveau@gmail.com" },
        email_data: {
          email_action_type: "signup",
          token: "123456",
          token_hash: "signup-hash",
          redirect_to: "https://gift-plan.yeti-lab.fr/auth/callback",
          site_url: "https://gift-plan.yeti-lab.fr",
        },
      },
      options,
    );

    expect(events).toHaveLength(1);
    expect(events?.[0]?.data.email).toBe("lilas.raveau@gmail.com");
    const confirmationUrl = new URL(events?.[0]?.data.url ?? "");
    expect(confirmationUrl.origin).toBe("https://project.supabase.co");
    expect(confirmationUrl.pathname).toBe("/auth/v1/verify");
    expect(confirmationUrl.searchParams.get("token")).toBe("signup-hash");
    expect(confirmationUrl.searchParams.get("type")).toBe("signup");
    expect(confirmationUrl.searchParams.get("redirect_to")).toBe(
      "https://gift-plan.yeti-lab.fr/auth/callback",
    );
  });

  it("falls back to the app URL when redirect_to targets another origin", () => {
    const events = normalizeSupabaseAuthEmailPayload(
      {
        user: { email: "member@example.com" },
        email_data: {
          email_action_type: "recovery",
          token_hash: "recovery-hash",
          redirect_to: "https://evil.example/phishing",
        },
      },
      options,
    );

    const confirmationUrl = new URL(events?.[0]?.data.url ?? "");
    expect(confirmationUrl.searchParams.get("redirect_to")).toBe("https://gift-plan.yeti-lab.fr/");
  });

  it("creates both secure email-change messages with their matching hashes", () => {
    const events = normalizeSupabaseAuthEmailPayload(
      {
        user: { email: "old@example.com", new_email: "new@example.com" },
        email_data: {
          email_action_type: "email_change",
          token: "old-token",
          token_new: "new-token",
          token_hash: "new-address-hash",
          token_hash_new: "current-address-hash",
        },
      },
      options,
    );

    expect(events?.map((event) => event.data.email)).toEqual([
      "old@example.com",
      "new@example.com",
    ]);
    expect(new URL(events?.[0]?.data.url ?? "").searchParams.get("token")).toBe(
      "current-address-hash",
    );
    expect(new URL(events?.[1]?.data.url ?? "").searchParams.get("token")).toBe("new-address-hash");
  });

  it("rejects incomplete or unsupported payloads", () => {
    expect(
      normalizeSupabaseAuthEmailPayload(
        {
          user: { email: "member@example.com" },
          email_data: { email_action_type: "signup" },
        },
        options,
      ),
    ).toBeNull();
    expect(
      normalizeSupabaseAuthEmailPayload(
        {
          user: { email: "member@example.com" },
          email_data: { email_action_type: "unknown", token_hash: "hash" },
        },
        options,
      ),
    ).toBeNull();
  });
});
