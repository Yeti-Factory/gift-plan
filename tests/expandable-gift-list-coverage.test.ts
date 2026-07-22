import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = [
  "src/routes/_authenticated/my-lists.tsx",
  "src/routes/_authenticated/circles/$circleId.members.$userId.tsx",
  "src/routes/_authenticated/gifts-i-offer.tsx",
  "src/routes/p/$username.tsx",
];

describe("expandable gift list coverage", () => {
  it.each(routes)("uses the compact expandable list in %s", (route) => {
    const source = readFileSync(resolve(process.cwd(), route), "utf8");

    expect(source).toContain("ExpandableGiftList");
    expect(source).toContain("ExpandableGiftRow");
  });
});
