import { DomUtils, parseDocument } from "htmlparser2";
import { isBlockedHostname } from "./net-guard";

type Element = ReturnType<typeof DomUtils.findAll>[number];
type JsonObject = Record<string, unknown>;

export interface GiftMetadata {
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
}

function plainText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const dom = parseDocument(value);
  for (const node of DomUtils.findAll(
    (node) => ["script", "style"].includes(node.name),
    dom.children,
  )) {
    DomUtils.removeElement(node);
  }
  const text = DomUtils.textContent(dom).replace(/\s+/g, " ").trim().slice(0, max);
  return text || null;
}

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

export function parseProductPrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/\d/.test(value) || /[-–]|\b(?:from|à partir)\b/i.test(value))
    return null;
  let raw = value
    .trim()
    .replace(/(?:EUR|USD|GBP|€|\$|£)/gi, "")
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d[\d.,]*$/.test(raw)) return null;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    raw = raw.replace(decimal === "," ? /\./g : /,/g, "").replace(",", ".");
  } else if (comma >= 0) {
    raw = /^\d{1,3}(?:,\d{3})+$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, "");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const price = Number(raw);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function imageUrl(value: unknown, sourceUrl: string): string | null {
  if (Array.isArray(value))
    return value.map((item) => imageUrl(item, sourceUrl)).find(Boolean) ?? null;
  const item = value;
  const raw = typeof item === "string" ? item : (object(item)?.contentUrl ?? object(item)?.url);
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw, sourceUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      isBlockedHostname(url.hostname)
    )
      return null;
    if (
      /(?:^|[/_.-])(?:logo|favicon|sprites?|placeholder)(?:[/_.-]|$)|\/share-icons\//i.test(
        url.pathname,
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function generic(value: string | null, siteName: string | null, sourceUrl: string): boolean {
  if (!value) return true;
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
  const title = normalize(value);
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  return (
    title.length < 3 ||
    title === normalize(host) ||
    title === normalize(host.split(".")[0]) ||
    (siteName !== null && title === normalize(siteName)) ||
    /^(amazon|amazonfr|amazoncom|accueil|homepage|welcometoamazon)$/.test(title)
  );
}

function structuredProducts(scripts: Element[]) {
  const products: JsonObject[] = [];
  const references = new Map<string, JsonObject>();
  const visit = (value: unknown, depth = 0) => {
    if (depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const node = object(value);
    if (!node) return;
    if (typeof node["@id"] === "string") references.set(node["@id"], node);
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    if (types.some((type) => typeof type === "string" && /(?:^|[/#])Product$/.test(type)))
      products.push(node);
    visit(node["@graph"], depth + 1);
    visit(node.mainEntity, depth + 1);
  };
  for (const script of scripts) {
    try {
      visit(JSON.parse(DomUtils.textContent(script)));
    } catch {
      // One malformed block must not prevent reading the other product data.
    }
  }
  return { products, references };
}

export function extractGiftMetadata(html: string, sourceUrl: string): GiftMetadata | null {
  const dom = parseDocument(html);
  const elements = DomUtils.findAll(() => true, dom.children);
  const byId = (id: string) => elements.find((node) => node.attribs.id === id);
  const text = (node: Element | undefined) =>
    node ? plainText(DomUtils.getOuterHTML(node)) : null;
  const meta = new Map<string, string>();
  for (const node of elements) {
    if (node.name !== "meta") continue;
    const key = (node.attribs.property ?? node.attribs.name ?? "").toLowerCase();
    if (key && node.attribs.content && !meta.has(key)) meta.set(key, node.attribs.content);
  }
  const getMeta = (...keys: string[]) =>
    keys.map((key) => meta.get(key)).find((value) => value?.trim()) ?? null;
  const pageTitle = text(elements.find((node) => node.name === "title"));
  if (
    /robot\s*check|captcha|access denied|just a moment|vérifi(?:ez|cation).*humain/i.test(
      pageTitle ?? "",
    ) ||
    elements.some(
      (node) => node.name === "form" && /validateCaptcha/i.test(node.attribs.action ?? ""),
    )
  )
    return null;
  const siteName = plainText(getMeta("og:site_name", "og:sitename"));
  const { products, references } = structuredProducts(
    elements.filter(
      (node) =>
        node.name === "script" &&
        (node.attribs.type ?? "").toLowerCase().split(";")[0].trim() === "application/ld+json",
    ),
  );
  const canonical = elements.find(
    (node) => node.name === "link" && node.attribs.rel?.toLowerCase() === "canonical",
  )?.attribs.href;
  const samePage = (raw: unknown) => {
    if (typeof raw !== "string") return false;
    try {
      const candidate = new URL(raw, sourceUrl);
      return [sourceUrl, canonical].some((base) => {
        if (!base) return false;
        const url = new URL(base, sourceUrl);
        return (
          candidate.origin === url.origin &&
          candidate.pathname.replace(/\/$/, "") === url.pathname.replace(/\/$/, "")
        );
      });
    } catch {
      return false;
    }
  };
  const product =
    products.find((item) => samePage(item.url) || samePage(item["@id"])) ??
    (products.length === 1 ? products[0] : null);
  const host = new URL(sourceUrl).hostname;
  const amazon = /(?:^|\.)amazon\.(?:fr|com|co\.uk|de|es|it|nl|com\.be|ca)$/.test(host);
  const amazonTitle = amazon ? text(byId("productTitle")) : null;
  const productScope = elements.find(
    (node) =>
      node.attribs.itemscope !== undefined &&
      /(?:[/#])Product(?:$|\s)/.test(node.attribs.itemtype ?? ""),
  );
  const microNodes = productScope ? DomUtils.findAll(() => true, [productScope]) : [];
  const micro = (name: string) => {
    const node = microNodes.find((node) =>
      (node.attribs.itemprop ?? "").split(/\s+/).includes(name),
    );
    return node
      ? (node.attribs.content ?? node.attribs.href ?? node.attribs.src ?? text(node))
      : null;
  };
  const title =
    [
      amazonTitle,
      plainText(product?.name, 500),
      plainText(micro("name"), 500),
      plainText(getMeta("og:title"), 500),
      plainText(getMeta("twitter:title"), 500),
      pageTitle,
    ].find((value) => !generic(value ?? null, siteName, sourceUrl)) ?? null;
  if (!title) return null;

  const description =
    [
      plainText(product?.description),
      plainText(micro("description")),
      plainText(getMeta("og:description")),
      plainText(getMeta("description")),
      plainText(getMeta("twitter:description")),
    ].find((value) => value && !generic(value, siteName, sourceUrl)) ?? null;
  let productImage: string | null = null;
  if (amazon) {
    const img = byId("landingImage") ?? byId("imgBlkFront");
    if (img) {
      productImage = imageUrl(img.attribs["data-old-hires"], sourceUrl);
      if (!productImage && img.attribs["data-a-dynamic-image"]) {
        try {
          const images = object(JSON.parse(img.attribs["data-a-dynamic-image"]));
          const candidates = Object.entries(images ?? {})
            .map(([url, size]) => ({
              url,
              area:
                Array.isArray(size) && size.every((v) => typeof v === "number")
                  ? Number(size[0]) * Number(size[1])
                  : 0,
            }))
            .sort((a, b) => b.area - a.area);
          productImage =
            candidates.map((item) => imageUrl(item.url, sourceUrl)).find(Boolean) ?? null;
        } catch {
          /* Use the normal image if the dynamic list is malformed. */
        }
      }
      productImage ??= imageUrl(img.attribs.src, sourceUrl);
    }
  }
  const image =
    productImage ??
    imageUrl(product?.image, sourceUrl) ??
    imageUrl(micro("image"), sourceUrl) ??
    ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]
      .map((key) => imageUrl(getMeta(key), sourceUrl))
      .find(Boolean) ??
    null;
  const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers];
  const resolveOffer = (value: unknown) => {
    const item = object(value);
    return item && typeof item["@id"] === "string" ? (references.get(item["@id"]) ?? item) : item;
  };
  const offer = offers
    .map(resolveOffer)
    .find(
      (item) => parseProductPrice(item?.price ?? object(item?.priceSpecification)?.price) !== null,
    );
  const specification = object(offer?.priceSpecification);
  let rawPrice: unknown =
    offer?.price ??
    specification?.price ??
    micro("price") ??
    getMeta("product:sale_price:amount", "product:price:amount", "og:price:amount");
  let currency =
    plainText(
      offer?.priceCurrency ??
        specification?.priceCurrency ??
        micro("priceCurrency") ??
        getMeta("product:price:currency", "og:price:currency"),
    )?.toUpperCase() ?? null;
  if (amazon) {
    const priceNode =
      byId("apex-pricetopay-accessibility-label") ??
      byId("priceblock_ourprice") ??
      byId("priceblock_dealprice") ??
      elements.find((node) => /(?:^|\s)priceToPay(?:\s|$)/.test(node.attribs.class ?? ""));
    const value = text(priceNode);
    if (parseProductPrice(value) !== null) {
      rawPrice = value;
      currency = value?.includes("€") ? "EUR" : currency;
    }
  }
  if (/(?:^|\.)ikea\.com$/.test(host)) {
    const currentPrice = elements.find((node) =>
      (node.attribs.class ?? "").split(/\s+/).includes("pipcom-price-module__current-price"),
    );
    if (currentPrice) {
      const nodes = DomUtils.findAll(() => true, [currentPrice]);
      const part = (name: string) =>
        text(nodes.find((node) => (node.attribs.class ?? "").split(/\s+/).includes(name))) ?? "";
      const value =
        part("pipcom-price__integer") +
        part("pipcom-price__decimal") +
        part("pipcom-price__currency");
      if (parseProductPrice(value) !== null) {
        rawPrice = value;
        currency = value.includes("€") ? "EUR" : currency;
      }
    }
  }
  return { title, description, imageUrl: image, price: parseProductPrice(rawPrice), currency };
}

/** A labelled fallback for Fnac when the public product page cannot be read. */
export function fnacTitleFromUrl(rawUrl: string): GiftMetadata | null {
  try {
    const url = new URL(rawUrl);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !["fnac.com", "www.fnac.com", "m.fnac.com"].includes(url.hostname.toLowerCase())
    )
      return null;
    const slug =
      url.pathname.match(/^\/a\d+\/([^/]+)\/?/i)?.[1] ??
      url.pathname.match(/^\/([^/]+)\/a\d+(?:\/|$)/i)?.[1];
    if (!slug) return null;
    const title = plainText(
      decodeURIComponent(slug)
        .replace(/\.html?$/i, "")
        .replace(/-/g, " "),
      500,
    );
    if (
      !title ||
      title.length < 5 ||
      !/[\p{L}]{3}/u.test(title) ||
      /^(article|produit|fiche|default)$/i.test(title)
    )
      return null;
    return { title, description: null, imageUrl: null, price: null, currency: null };
  } catch {
    return null;
  }
}
