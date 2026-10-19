// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAction, apiQuery } from "../src/lib/self-hosted/api-client";
import { MESSAGES_CHANGED_EVENT } from "../src/lib/message-notifications";

afterEach(() => vi.unstubAllGlobals());
describe("expired sessions", () => {
  it("refreshes message indicators only after a successful mutation", async () => {
    const changed = vi.fn();
    window.addEventListener(MESSAGES_CHANGED_EVENT, changed);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(Response.json({ error: "FORBIDDEN" }, { status: 403 })),
    );
    try {
      await apiAction("message-read", { conversationId: "conversation", lastId: "1" });
      expect(changed).toHaveBeenCalledOnce();
      await expect(apiAction("group-message-read")).rejects.toMatchObject({ status: 403 });
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(MESSAGES_CHANGED_EVENT, changed);
    }
  });
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
