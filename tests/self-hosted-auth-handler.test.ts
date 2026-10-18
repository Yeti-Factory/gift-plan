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
  it("rejects missing and impossible birthdays before creating any account", async () => {
    for (const birthday of [undefined, "04-31", "2000-04-22"]) {
      const response = await handleAuthRequest(
        new Request("https://gift-plan.example.com/api/auth/sign-up/email", {
          method: "POST",
          body: JSON.stringify({ email: "new@example.com", birthday }),
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "INVALID_BIRTHDAY" });
    }
    expect(handler).not.toHaveBeenCalled();
  });
  it("preserves a valid birthday in the body passed to account creation", async () => {
    handler.mockImplementation(async (request: Request) => Response.json(await request.json()));
    const response = await handleAuthRequest(
      new Request("https://gift-plan.example.com/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({ birthday: "02-29" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ birthday: "02-29" });
  });
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
