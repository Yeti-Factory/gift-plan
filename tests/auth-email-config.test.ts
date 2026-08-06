import { describe, expect, it } from "vitest";

import { getAuthEmailConfigStatus } from "@/lib/auth-email-config";

describe("auth email deployment configuration", () => {
  it("is ready with a Resend key and Lovable signing key", () => {
    expect(
      getAuthEmailConfigStatus({
        RESEND_API_KEY_GIFT_PLAN: "resend-key",
        LOVABLE_API_KEY: "lovable-key",
      }),
    ).toEqual({
      ready: true,
      providerConfigured: true,
      webhookVerificationConfigured: true,
    });
  });

  it("fails readiness when the email provider key is missing", () => {
    expect(getAuthEmailConfigStatus({ LOVABLE_API_KEY: "lovable-key" })).toEqual({
      ready: false,
      providerConfigured: false,
      webhookVerificationConfigured: true,
    });
  });

  it("fails readiness when webhook verification is not configured", () => {
    expect(getAuthEmailConfigStatus({ RESEND_API_KEY_GIFT_PLAN: "resend-key" })).toEqual({
      ready: false,
      providerConfigured: true,
      webhookVerificationConfigured: false,
    });
  });

  it("accepts the documented rotation secret as a verification fallback", () => {
    expect(
      getAuthEmailConfigStatus({
        RESEND_API_KEY: "resend-key",
        AUTH_EMAIL_WEBHOOK_SECRET: "rotation-key",
      }).ready,
    ).toBe(true);
  });
});
