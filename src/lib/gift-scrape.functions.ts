import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSafeUrl } from "./net-guard";
import { createLogger, newRequestId } from "./logger";
import { retryFetch } from "./retry";

const schema = z.object({ url: z.string().url() });

const MAX_BYTES = 1_000_000; // 1 MB
const TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;

// In-memory per-worker rate limit: 10 requests / 5 min per user.
// Best-effort (per instance). Combined with authenticated middleware.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 10;
const rateHits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateHits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rateHits.set(userId, hits);
    return true;
  }
  hits.push(now);
  rateHits.set(userId, hits);
  return false;
}

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

async function fetchWithGuards(rawUrl: string, requestId: string): Promise<string | null> {
  const log = createLogger("scrape", { requestId });
  let currentUrl = rawUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const safe = await assertSafeUrl(currentUrl);
      const res = await retryFetch(
        () =>
          fetch(safe.toString(), {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; GiftPlanBot/1.0; +https://gift-plan.yeti-lab.fr)",
              Accept: "text/html,application/xhtml+xml",
            },
          }),
        { attempts: 2, baseDelayMs: 200, logger: log, label: "scrape-fetch" },
      );

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        currentUrl = new URL(loc, safe).toString();
        continue;
      }

      if (!res.ok) {
        log.warn("non-ok response", { status: res.status });
        return null;
      }

      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!ct.startsWith("text/html") && !ct.startsWith("application/xhtml+xml")) {
        return null;
      }

      if (!res.body) return null;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        buf.set(c, off);
        off += c.byteLength;
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(buf);
    }
    log.warn("too many redirects");
    return null;
  } catch (err) {
    log.warn("fetch aborted", { err: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const scrapeGiftUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const requestId = newRequestId();
    const log = createLogger("scrape", { requestId });
    if (rateLimited(context.userId)) {
      log.warn("rate limited", { userId: context.userId });
      return { ok: false as const };
    }
    const html = await fetchWithGuards(data.url, requestId);
    if (!html) return { ok: false as const };
    try {
      const trimmed = html.slice(0, 500_000);

      const metaContent = (prop: string) =>
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
      const metaContentRev = (prop: string) =>
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");

      const title =
        pickMeta(trimmed, [
          metaContent("og:title"),
          metaContentRev("og:title"),
          metaContent("twitter:title"),
          /<title[^>]*>([^<]+)<\/title>/i,
        ]) ?? null;

      const imageUrl =
        pickMeta(trimmed, [
          metaContent("og:image:secure_url"),
          metaContent("og:image"),
          metaContentRev("og:image"),
          metaContent("twitter:image"),
        ]) ?? null;

      const priceRaw =
        pickMeta(trimmed, [
          metaContent("product:price:amount"),
          metaContent("og:price:amount"),
          metaContent("product:sale_price:amount"),
        ]) ?? null;

      const currency =
        pickMeta(trimmed, [
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
    } catch (err) {
      log.warn("parse failed", { err: err instanceof Error ? err.message : "?" });
      return { ok: false as const };
    }
  });
