import { describe, expect, it } from "vitest";
import { extractGiftMetadata } from "../src/lib/gift-metadata.server";
const html = `<span id="productTitle">Hoodie MEDUOLA</span>
<input id="ASIN" value="B0DF2HXK5M">
<img id="landingImage" src="https://m.media-amazon.com/images/I/white.jpg">
<img class="swatch-image" alt="Orange" src="https://m.media-amazon.com/images/I/orange.jpg">
<span id="priceblock_ourprice">27,98 €</span>
<script>{"parentAsin":"B0DF2RQVT3","dimensions":["size_name","color_name"],"dimensionValuesDisplayData":{"B0DF2HXK5M":["S","Blanc"],"B0DP77BGQP":["L","Orange"]}}</script>`;
describe("Amazon product identity", () => {
  it("does not import the default white variant for a parent product", () => {
    const result = extractGiftMetadata(html, "https://www.amazon.fr/dp/B0DF2RQVT3");
    expect(result).toMatchObject({
      selectionRequired: true,
      imageUrl: null,
      price: null,
      description: null,
    });
    expect(result?.variants?.map((v) => v.label)).toEqual(["S · Blanc", "L · Orange"]);
  });
  it("keeps the selected orange child when Amazon redirects to the parent", () => {
    expect(
      extractGiftMetadata(
        html,
        "https://www.amazon.fr/dp/B0DF2RQVT3",
        "https://www.amazon.fr/dp/B0DP77BGQP?th=1&psc=1",
      ),
    ).toMatchObject({
      description: "L · Orange",
      imageUrl: "https://m.media-amazon.com/images/I/orange.jpg",
      price: null,
      variantPriceUnavailable: true,
    });
  });
  it("keeps the normal price when the displayed child matches the requested product", () => {
    expect(extractGiftMetadata(html, "https://www.amazon.fr/dp/B0DF2HXK5M")).toMatchObject({
      price: 27.98,
      imageUrl: "https://m.media-amazon.com/images/I/white.jpg",
    });
  });
  it("ignores malformed embedded variant data", () => {
    expect(
      extractGiftMetadata(
        html.replace('"dimensions":["size_name","color_name"]', '"dimensions":["__proto__"]'),
        "https://www.amazon.fr/dp/B0DF2RQVT3",
      )?.variants,
    ).toEqual([]);
  });
});
