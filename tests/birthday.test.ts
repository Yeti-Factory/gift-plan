import { describe, expect, it } from "vitest";
import { birthdayFromParts, formatBirthday, isBirthday } from "../src/lib/birthday";

describe("annual birthdays without a birth year", () => {
  it.each(["01-01", "02-29", "04-30", "12-31"])("accepts %s", (value) =>
    expect(isBirthday(value)).toBe(true),
  );
  it.each(["02-30", "04-31", "00-01", "13-01", "01-00", "1-2", "2026-01-01", "", null, 42])(
    "rejects %s",
    (value) => expect(isBirthday(value)).toBe(false),
  );
  it("normalizes typed day and month and displays the French birthday without a year", () => {
    expect(birthdayFromParts("9", "4")).toBe("04-09");
    expect(birthdayFromParts("31", "4")).toBeNull();
    expect(formatBirthday("04-09")).toBe("9 avril");
    expect(formatBirthday("01-01")).toBe("1er janvier");
    expect(formatBirthday("02-29")).toBe("29 février");
    expect(formatBirthday(null)).toBeNull();
  });
});
