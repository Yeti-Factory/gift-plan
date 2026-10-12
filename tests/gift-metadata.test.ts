import { describe, expect, it } from "vitest";
import {
  extractGiftMetadata,
  fnacTitleFromUrl,
  parseProductPrice,
} from "../src/lib/gift-metadata.server";

const amazonUrl = "https://www.amazon.fr/Dictionnaire-amoureux-chiens/dp/2259322840";
const amazon = `
  <title>Amazon.fr - Dictionnaire amoureux des chiens - Livres</title>
  <meta property="og:title" content="Amazon">
  <meta property="og:description" content="Amazon">
  <meta property="og:image" content="https://m.media-amazon.com/images/G/01/share-icons/previewdoh/amazon.png">
  <meta name="description" content="Un livre sur les chiens &amp; leurs maîtres.">
  <span id="productTitle">Dictionnaire amoureux des chiens</span>
  <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/cover.jpg">
  <span id="apex-pricetopay-accessibility-label">27,00&nbsp;€</span>
`;

describe("product metadata", () => {
  it("imports the actual Amazon product instead of the merchant sharing metadata", () => {
    expect(extractGiftMetadata(amazon, amazonUrl)).toEqual({
      title: "Dictionnaire amoureux des chiens",
      description: "Un livre sur les chiens & leurs maîtres.",
      imageUrl: "https://m.media-amazon.com/images/I/cover.jpg",
      price: 27,
      currency: "EUR",
    });
  });
  it("reads product information beyond the old 500 KB parsing cutoff", () => {
    expect(extractGiftMetadata(" ".repeat(550000) + amazon, amazonUrl)?.title).toBe(
      "Dictionnaire amoureux des chiens",
    );
  });
  it("chooses the largest Amazon image when no high-resolution URL is provided", () => {
    const html = amazon.replace(
      'data-old-hires="https://m.media-amazon.com/images/I/cover.jpg"',
      "data-a-dynamic-image='{&quot;https://m.media-amazon.com/images/I/small.jpg&quot;:[100,100],&quot;https://m.media-amazon.com/images/I/large.jpg&quot;:[800,600]}'",
    );
    expect(extractGiftMetadata(html, amazonUrl)?.imageUrl).toContain("/large.jpg");
  });
  it("reads the displayed Amazon price when its accessibility span is empty", () => {
    const html = amazon.replace(
      '<span id="apex-pricetopay-accessibility-label">27,00&nbsp;€</span>',
      '<span class="a-price priceToPay"><span class="a-offscreen"></span><span class="a-price-whole">27<span>,</span></span><span class="a-price-fraction">00</span><span>€</span></span>',
    );
    expect(extractGiftMetadata(html, amazonUrl)?.price).toBe(27);
  });
  it("rejects a store-only preview rather than returning its name and logo", () => {
    expect(
      extractGiftMetadata(
        '<title>Amazon</title><meta property="og:title" content="Amazon"><meta property="og:image" content="https://m.media-amazon.com/images/G/01/share-icons/amazon.png">',
        amazonUrl,
      ),
    ).toBeNull();
  });
  it("rejects robot checks even when product sharing tags are present", () => {
    expect(extractGiftMetadata("<title>Robot Check</title>" + amazon, amazonUrl)).toBeNull();
    expect(
      extractGiftMetadata(amazon + '<form action="/errors/validateCaptcha"></form>', amazonUrl),
    ).toBeNull();
  });
  it("prioritizes Product JSON-LD over a generic store preview", () => {
    const html =
      '<meta property="og:title" content="Ma boutique"><script type="application/ld+json">' +
      JSON.stringify({
        "@graph": [
          { "@type": "Organization", name: "Ma boutique", logo: "/logo.png" },
          {
            "@type": ["Thing", "Product"],
            name: "Lampe d’atelier",
            description: "Solide &amp; pratique",
            image: { url: "/images/lampe.jpg" },
            offers: { "@type": "Offer", price: "1 299,95", priceCurrency: "EUR" },
          },
        ],
      }) +
      "</script>";
    expect(extractGiftMetadata(html, "https://shop.example/lampe")).toEqual({
      title: "Lampe d’atelier",
      description: "Solide & pratique",
      imageUrl: "https://shop.example/images/lampe.jpg",
      price: 1299.95,
      currency: "EUR",
    });
  });
  it("selects the product matching the current page among multiple JSON-LD products", () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify([
        {
          "@type": "Product",
          name: "Autre objet",
          url: "https://shop.example/other",
          offers: { price: 100, priceCurrency: "EUR" },
        },
        {
          "@type": "Product",
          name: "Bon objet",
          url: "https://shop.example/item",
          offers: { price: 25, priceCurrency: "EUR" },
        },
      ]) +
      "</script>";
    expect(extractGiftMetadata(html, "https://shop.example/item?utm_source=share")?.title).toBe(
      "Bon objet",
    );
  });
  it("tolerates one malformed JSON-LD block and keeps apostrophes and numeric entities", () => {
    const html =
      '<script type="application/ld+json">{bad}</script><meta content="L\'objet &#233;tonnant" property="og:title"><meta content="/images/photo.jpg" name="twitter:image"><meta content="19,90" property="product:price:amount"><meta content="EUR" property="product:price:currency">';
    expect(extractGiftMetadata(html, "https://shop.example/item")).toMatchObject({
      title: "L'objet étonnant",
      imageUrl: "https://shop.example/images/photo.jpg",
      price: 19.9,
      currency: "EUR",
    });
  });
  it("does not invent a price from an aggregate offer range or an empty price", () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Product",
        name: "Objet à variantes",
        offers: { "@type": "AggregateOffer", lowPrice: 10, highPrice: 25, priceCurrency: "EUR" },
      }) +
      "</script>";
    expect(extractGiftMetadata(html, "https://shop.example/item")?.price).toBeNull();
    expect(parseProductPrice("")).toBeNull();
  });
  it("rejects logos, local image hosts, credentials and non-web image protocols", () => {
    for (const image of [
      "/logo.png",
      "http://127.0.0.1/img.jpg",
      "https://user:pass@shop.example/img.jpg",
      "data:image/png;base64,xyz",
      "javascript:alert(1)",
    ]) {
      const html =
        '<meta property="og:title" content="Objet utile"><meta property="og:image" content="' +
        image +
        '">';
      expect(extractGiftMetadata(html, "https://shop.example/item")?.imageUrl).toBeNull();
    }
  });
  it.each([
    ["29,90 €", 29.9],
    ["1.299,95", 1299.95],
    ["1,299.95", 1299.95],
    ["27.00", 27],
    [0, 0],
    [null, null],
    ["-10", null],
    ["10–20", null],
    ["à partir de 10 €", null],
    ["NaN", null],
  ])("parses %s without making up a price", (value, expected) => {
    expect(parseProductPrice(value)).toBe(expected);
  });
});

describe("other merchant formats", () => {
  it("reads IKEA's current price without adding fees or duplicating its screen-reader text", () => {
    const html =
      '<meta property="og:title" content="TÄRNABY lampe"><meta property="og:image" content="/lamp.jpg"><span class="pipcom-price-module__current-price"><span class="pipcom-price__integer">19</span><span class="pipcom-price__decimal">,99</span><span class="pipcom-price__currency">€</span><span class="pipcom-price__sr-text">Prix 19,99€</span></span><div>Éco-part. 0,25€</div>';
    expect(extractGiftMetadata(html, "https://www.ikea.com/fr/fr/p/lampe/")).toMatchObject({
      title: "TÄRNABY lampe",
      price: 19.99,
      currency: "EUR",
    });
  });
  it("reads a Product described using HTML microdata", () => {
    const html =
      '<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Lampe verte</h1><p itemprop="description">Batterie rechargeable</p><img itemprop="image" src="/lamp.jpg"><div itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="price" content="34.95"><meta itemprop="priceCurrency" content="EUR"></div></div>';
    expect(extractGiftMetadata(html, "https://shop.example/lampe")).toEqual({
      title: "Lampe verte",
      description: "Batterie rechargeable",
      imageUrl: "https://shop.example/lamp.jpg",
      price: 34.95,
      currency: "EUR",
    });
  });
  it("resolves an offer referenced from a JSON-LD graph", () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({
        "@graph": [
          { "@type": "Product", name: "Casque noir", offers: { "@id": "#offer" } },
          { "@id": "#offer", "@type": "Offer", price: 49.99, priceCurrency: "EUR" },
        ],
      }) +
      "</script>";
    expect(extractGiftMetadata(html, "https://shop.example/casque")).toMatchObject({
      title: "Casque noir",
      price: 49.99,
      currency: "EUR",
    });
  });
  it("reads an offer's price specification", () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Product",
        name: "Livre illustré",
        offers: { "@type": "Offer", priceSpecification: { price: 16.5, priceCurrency: "EUR" } },
      }) +
      "</script>";
    expect(extractGiftMetadata(html, "https://shop.example/livre")?.price).toBe(16.5);
  });
  it("uses alternative metadata when the Open Graph preview is generic", () => {
    const html =
      '<title>Amazon</title><meta property="og:title" content="Amazon"><meta name="twitter:title" content="Un vrai produit"><meta property="og:image" content="/logo.png"><meta name="twitter:image" content="/photo.jpg">';
    expect(extractGiftMetadata(html, amazonUrl)).toMatchObject({
      title: "Un vrai produit",
      imageUrl: "https://www.amazon.fr/photo.jpg",
    });
  });
  it("skips logos in a structured image array", () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "Product",
        name: "Mon objet",
        image: ["/logo.png", "/photo.jpg"],
      }) +
      "</script>";
    expect(extractGiftMetadata(html, "https://shop.example/item")?.imageUrl).toBe(
      "https://shop.example/photo.jpg",
    );
  });
});

describe("labelled Fnac URL fallback", () => {
  it("derives only a provisional name from a full Fnac product slug", () => {
    expect(
      fnacTitleFromUrl(
        "https://www.fnac.com/a23181524/Stephane-Hoffmann-Dictionnaire-amoureux-des-chiens?NUMERICAL=Y",
      ),
    ).toEqual({
      title: "Stephane Hoffmann Dictionnaire amoureux des chiens",
      description: null,
      imageUrl: null,
      price: null,
      currency: null,
    });
  });
  it("does not turn bare reference numbers or unknown sites into product names", () => {
    for (const url of [
      "https://www.fnac.com/a23181524",
      "https://shop.example/a123/Un-produit",
      "https://fnac.com.evil.example/a123/Un-produit",
      "https://user:pass@fnac.com/a123/Un-produit",
      "file:///a123/Un-produit",
    ])
      expect(fnacTitleFromUrl(url)).toBeNull();
  });
  it("decodes accented names and tolerates malformed URL escapes without throwing", () => {
    expect(fnacTitleFromUrl("https://www.fnac.com/a123/Livre-illustr%C3%A9")?.title).toBe(
      "Livre illustré",
    );
    expect(fnacTitleFromUrl("https://www.fnac.com/a123/%ZZ")).toBeNull();
  });
});

it("recognizes the Fnac game URL supplied by the user with the title before its reference", () => {
  expect(
    fnacTitleFromUrl("https://www.fnac.com/Jeu-d-ambiance-Outsider-Prejuges/a14732648/w-4"),
  ).toEqual({
    title: "Jeu d ambiance Outsider Prejuges",
    description: null,
    imageUrl: null,
    price: null,
    currency: null,
  });
});
