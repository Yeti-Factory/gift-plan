import { describe, expect, it } from "vitest";

import {
  GIFT_CATEGORY_OPTIONS,
  filterGiftsByCategory,
  getGiftCategoryOption,
  isGiftCategory,
  normalizeGiftCategory,
} from "@/lib/gift-category";

describe("gift categories", () => {
  it("exposes the requested families with unique values", () => {
    const values = GIFT_CATEGORY_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
    expect(values).toEqual(
      expect.arrayContaining([
        "culture",
        "musique",
        "tech_geek",
        "informatique",
        "beaute_bien_etre",
        "mode",
        "sport",
        "loisirs",
      ]),
    );
    expect(getGiftCategoryOption("jeux_loisirs").label).toBe("Jeux");
    expect(getGiftCategoryOption("loisirs").label).toBe("Loisirs");
    expect(getGiftCategoryOption("musique").label).toBe("Musique");
    expect(getGiftCategoryOption("loisirs").iconClass).toContain("text-");
  });

  it("falls back safely to the other category", () => {
    expect(isGiftCategory("culture")).toBe(true);
    expect(isGiftCategory("unknown")).toBe(false);
    expect(normalizeGiftCategory(null)).toBe("autre");
    expect(getGiftCategoryOption("unknown").label).toBe("Autre");
  });

  it("filters gifts while keeping the all option lossless", () => {
    const gifts = [
      { id: "book", category: "culture" },
      { id: "ball", category: "sport" },
      { id: "legacy", category: null },
    ];

    expect(filterGiftsByCategory(gifts, "all")).toBe(gifts);
    expect(filterGiftsByCategory(gifts, "sport")).toEqual([{ id: "ball", category: "sport" }]);
    expect(filterGiftsByCategory(gifts, "autre")).toEqual([{ id: "legacy", category: null }]);
  });
});
