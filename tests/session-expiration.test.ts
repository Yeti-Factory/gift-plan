// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiQuery } from "../src/lib/self-hosted/api-client";

afterEach(() => vi.unstubAllGlobals());
describe("expired sessions", () => {
  it("notifies the private app when a protected request requires reconnection", async () => {
    const expired = vi.fn();
    window.addEventListener("gp-session-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "AUTH_REQUIRED" }, { status: 401 })),
    );
    try {
      await expect(apiQuery("session")).rejects.toMatchObject({ status: 401 });
      expect(expired).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("gp-session-expired", expired);
    }
  });
  it("does not force sign-in when a valid session lacks a specific permission", async () => {
    const expired = vi.fn();
    window.addEventListener("gp-session-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "FORBIDDEN" }, { status: 403 })),
    );
    try {
      await expect(apiQuery("circle")).rejects.toMatchObject({ status: 403 });
      expect(expired).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("gp-session-expired", expired);
    }
  });
});
