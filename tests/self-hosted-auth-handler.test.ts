import { afterEach, describe, expect, it, vi } from "vitest";

const handler = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/self-hosted/auth.server", () => ({
  getAuth: () => ({ handler }),
}));
import { handleAuthRequest } from "../src/lib/self-hosted/auth-handler.server";

afterEach(() => {
  vi.unstubAllEnvs();
  handler.mockReset();
});

describe("authentication during an email configuration outage", () => {
  it("rejects reset requests uniformly before account lookup", async () => {
    vi.stubEnv("RESEND_API_KEY_GIFT_PLAN", "");
    vi.stubEnv("RESEND_API_KEY", "");
    for (const email of ["known@example.com", "unknown@example.com"]) {
      const response = await handleAuthRequest(
        new Request("https://gift-plan.example.com/api/auth/request-password-reset", {
          method: "POST",
          body: JSON.stringify({ email }),
        }),
      );
      expect(response.status).toBe(503);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("still delegates existing-account sign-in", async () => {
    vi.stubEnv("RESEND_API_KEY_GIFT_PLAN", "");
    vi.stubEnv("RESEND_API_KEY", "");
    handler.mockResolvedValue(new Response("ok"));
    const response = await handleAuthRequest(
      new Request("https://gift-plan.example.com/api/auth/sign-in/email", { method: "POST" }),
    );
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
