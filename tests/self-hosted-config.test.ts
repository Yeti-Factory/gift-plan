import { describe, expect, it } from "vitest";

import { getSelfHostedConfig, getSelfHostedReadiness } from "../src/lib/self-hosted/config";

const completeEnvironment = {
  NODE_ENV: "production",
  APP_URL: "https://gift-plan.yeti-lab.fr",
  BETTER_AUTH_SECRET: "a".repeat(48),
  DATABASE_URL: "postgresql://gift_plan:secret@postgres:5432/gift_plan",
  RESEND_API_KEY_GIFT_PLAN: "re_test",
  UPLOAD_DIR: "/data/uploads",
};

describe("self-hosted configuration", () => {
  it("is ready when all required services are configured", () => {
    const status = getSelfHostedReadiness(completeEnvironment);
    expect(status.ready).toBe(true);
    expect(status.missing).toEqual([]);
  });

  it("never exposes secret values in its readiness result", () => {
    const status = getSelfHostedReadiness(completeEnvironment);
    expect(JSON.stringify(status)).not.toContain("re_test");
    expect(JSON.stringify(status)).not.toContain("postgresql://");
  });

  it("rejects incomplete or insecure production configuration", () => {
    const status = getSelfHostedReadiness({
      NODE_ENV: "production",
      APP_URL: "http://gift-plan.yeti-lab.fr",
      BETTER_AUTH_SECRET: "too-short",
    });
    expect(status.ready).toBe(false);
    expect(status.missing).toContain("APP_URL (URL HTTPS publique)");
    expect(status.missing).toContain("BETTER_AUTH_SECRET (32 caractères minimum)");
    expect(() => getSelfHostedConfig({ NODE_ENV: "production" })).toThrow(
      "Configuration autonome incomplète",
    );
  });

  it("requires both Google OAuth credentials when either is present", () => {
    const status = getSelfHostedReadiness({
      ...completeEnvironment,
      GOOGLE_CLIENT_ID: "client-id",
    });
    expect(status.ready).toBe(false);
    expect(status.checks.google).toBe(false);
  });
});
