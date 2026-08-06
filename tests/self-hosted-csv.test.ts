import { describe, expect, it } from "vitest";

import { parseCsv } from "../selfhost/scripts/csv.mjs";

describe("self-hosted CSV parser", () => {
  it("parses quoted commas, escaped quotes and embedded newlines", () => {
    expect(parseCsv('id,name,bio\r\n1,"Nom, Prénom","Une ""envie""\nsur deux lignes"\r\n')).toEqual(
      [
        ["id", "name", "bio"],
        ["1", "Nom, Prénom", 'Une "envie"\nsur deux lignes'],
      ],
    );
  });

  it("ignores empty trailing rows", () => {
    expect(parseCsv("id,name\n1,Alice\n\n")).toEqual([
      ["id", "name"],
      ["1", "Alice"],
    ]);
  });

  it("rejects an unterminated quoted value", () => {
    expect(() => parseCsv('id,name\n1,"Alice')).toThrow("guillemet non fermé");
  });
});
