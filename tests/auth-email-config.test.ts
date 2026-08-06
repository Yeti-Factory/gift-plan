import { describe, expect, it } from "vitest";

import { getAuthEmailConfigStatus } from "@/lib/auth-email-config";

describe("auth email deployment configuration", () => {
  it("is ready with Resend and the native Supabase hook secret", () => {
    expect(
      getAuthEmailConfigStatus({
        RESEND_API_KEY_GIFT_PLAN: "resend-key",
        SEND_EMAIL_HOOK_SECRET: "v1,whsec_secret",
      }),
    ).toEqual({
      ready: true,
      providerConfigured: true,
      webhookVerificationConfigured: true,
      supabaseWebhookConfigured: true,
      lovableWebhookConfigured: false,
    });
  });

  it("fails readiness when the email provider key is missing", () => {
    expect(getAuthEmailConfigStatus({ SEND_EMAIL_HOOK_SECRET: "v1,whsec_secret" })).toEqual({
      ready: false,
      providerConfigured: false,
      webhookVerificationConfigured: true,
      supabaseWebhookConfigured: true,
      lovableWebhookConfigured: false,
    });
  });

  it("fails readiness when webhook verification is not configured", () => {
    expect(getAuthEmailConfigStatus({ RESEND_API_KEY_GIFT_PLAN: "resend-key" })).toEqual({
      ready: false,
      providerConfigured: true,
      webhookVerificationConfigured: false,
      supabaseWebhookConfigured: false,
      lovableWebhookConfigured: false,
    });
  });

  it("keeps the documented Lovable compatibility fallback", () => {
    expect(
      getAuthEmailConfigStatus({
        RESEND_API_KEY: "resend-key",
        AUTH_EMAIL_WEBHOOK_SECRET: "rotation-key",
      }).ready,
    ).toBe(true);
  });
});
