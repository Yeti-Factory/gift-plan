import { describe, expect, it } from "vitest";

import { normalizeValue, transformUser } from "../selfhost/scripts/import-lovable.mjs";

describe("legacy account import", () => {
  it("accepts the boolean produced by the user transformation", () => {
    const user = transformUser({
      id: "e4b68108-3575-4aa3-b8bf-3ba3b3ee0a5c",
      email: " Member@Example.com ",
      email_verified: "true",
    });
    expect(user.email).toBe("member@example.com");
    expect(normalizeValue("emailVerified", user.emailVerified)).toBe(true);
    expect(normalizeValue("emailVerified", false)).toBe(false);
  });

  it("does not assume ownership of an unverified legacy address", () => {
    const user = transformUser({
      id: "e4b68108-3575-4aa3-b8bf-3ba3b3ee0a5c",
      email: "member@example.com",
    });
    expect(user.emailVerified).toBe(false);
    expect(() => normalizeValue("emailVerified", "invalid")).toThrow();
  });
});
