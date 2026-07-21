import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const formSource = readFileSync(
  resolve(process.cwd(), "src/routes/_authenticated/my-lists.tsx"),
  "utf8",
);

describe("gift category form", () => {
  it("requires an explicit category for a new gift", () => {
    expect(formSource).toContain('useState<GiftCategory | "">(gift?.category ?? "")');
    expect(formSource).toContain('placeholder="Choisir une catégorie"');
    expect(formSource).toContain("disabled={busy || !category || !title.trim()}");
  });

  it("shows the category before the gift name", () => {
    const categoryLabel = formSource.indexOf("<Label>Catégorie (obligatoire)</Label>");
    const nameLabel = formSource.indexOf("<Label>Nom</Label>", categoryLabel);

    expect(categoryLabel).toBeGreaterThan(-1);
    expect(nameLabel).toBeGreaterThan(categoryLabel);
  });
});
