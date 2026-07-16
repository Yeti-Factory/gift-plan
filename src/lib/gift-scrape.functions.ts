import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ url: z.string().url() });

function pickMeta(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export const scrapeGiftUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GiftPlanBot/1.0; +https://gift-plan.lovable.app)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) return { ok: false as const };
      const html = (await res.text()).slice(0, 500_000);

      const metaContent = (prop: string) =>
        new RegExp(
          `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
          "i",
        );
      const metaContentRev = (prop: string) =>
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
          "i",
        );

      const title =
        pickMeta(html, [
          metaContent("og:title"),
          metaContentRev("og:title"),
          metaContent("twitter:title"),
          /<title[^>]*>([^<]+)<\/title>/i,
        ]) ?? null;

      const imageUrl =
        pickMeta(html, [
          metaContent("og:image:secure_url"),
          metaContent("og:image"),
          metaContentRev("og:image"),
          metaContent("twitter:image"),
        ]) ?? null;

      const priceRaw =
        pickMeta(html, [
          metaContent("product:price:amount"),
          metaContent("og:price:amount"),
          metaContent("product:sale_price:amount"),
        ]) ?? null;

      const currency =
        pickMeta(html, [
          metaContent("product:price:currency"),
          metaContent("og:price:currency"),
        ]) ?? null;

      const price = priceRaw ? Number(priceRaw.replace(",", ".")) : null;

      return {
        ok: true as const,
        title: title ? decodeEntities(title) : null,
        imageUrl: imageUrl ?? null,
        price: Number.isFinite(price) ? price : null,
        currency: currency ?? null,
      };
    } catch {
      return { ok: false as const };
    }
  });