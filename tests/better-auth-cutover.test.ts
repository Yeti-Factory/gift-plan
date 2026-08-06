import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("self-hosted authentication cutover", () => {
  it("uses Better Auth with verified email and the eight-character policy", () => {
    const auth = source("src/lib/self-hosted/auth.server.ts");
    expect(auth).toContain("requireEmailVerification: true");
    expect(auth).toContain("minPasswordLength: 8");
    expect(auth).toContain("sendOnSignUp: true");
    expect(auth).toContain("sendVerificationEmail");
  });

  it("keeps account changes and deletion enabled on the autonomous backend", () => {
    const auth = source("src/lib/self-hosted/auth.server.ts");
    expect(auth).toContain("changeEmail: { enabled: true }");
    expect(auth).toContain("deleteUser:");
    expect(auth).toContain("beforeDelete:");
  });

  it("does not ship Supabase or Lovable runtime dependencies", () => {
    const manifest = source("package.json");
    expect(manifest).not.toContain("@supabase/supabase-js");
    expect(manifest).not.toContain("@lovable.dev/");
  });
});
