import { describe, expect, it } from "vitest";

import { ApiError, assertSameOrigin, readJsonObject } from "../src/lib/self-hosted/http.server";

describe("self-hosted API request protections", () => {
  it("accepts only the configured application origin for mutations", () => {
    const allowed = new Request("https://gift-plan.yeti-lab.fr/api/v1/community", {
      headers: { origin: "https://gift-plan.yeti-lab.fr" },
    });
    expect(() => assertSameOrigin(allowed, "https://gift-plan.yeti-lab.fr")).not.toThrow();

    const foreign = new Request("https://gift-plan.yeti-lab.fr/api/v1/community", {
      headers: { origin: "https://example.org" },
    });
    expect(() => assertSameOrigin(foreign, "https://gift-plan.yeti-lab.fr")).toThrow(ApiError);
  });

  it("rejects oversized JSON before parsing it", async () => {
    const request = new Request("https://gift-plan.yeti-lab.fr/api/v1/community", {
      method: "POST",
      headers: { "content-length": "20000", "content-type": "application/json" },
      body: "{}",
    });
    await expect(readJsonObject(request)).rejects.toMatchObject({
      status: 413,
      code: "INVALID_REQUEST",
    });
  });
});
