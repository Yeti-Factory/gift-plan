import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchGiftPage } from "./gift-fetch.server";
import { extractGiftMetadata, fnacTitleFromUrl } from "./gift-metadata.server";
import { createLogger, newRequestId } from "./logger";

const schema = z.object({ url: z.string().url() });

// In-memory per-worker rate limit: 10 requests / 5 min per user.
// Best-effort (per instance). Combined with authenticated middleware.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 10;
const rateHits = new Map<string, number[]>();

const requireSelfHostedAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized");
  const { getSession } = await import("@/lib/self-hosted/session.server");
  const session = await getSession(request.headers);
  if (!session?.user.id) throw new Error("Unauthorized");
  return next({ context: { userId: session.user.id } });
});

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

export const scrapeGiftUrl = createServerFn({ method: "POST" })
  .middleware([requireSelfHostedAuth])
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const requestId = newRequestId();
    const log = createLogger("scrape", { requestId });
    if (rateLimited(context.userId)) {
      log.warn("rate limited");
      return { ok: false as const, reason: "rate_limited" as const };
    }
    const page = await fetchGiftPage(data.url, requestId);
    const fallback = fnacTitleFromUrl(data.url);
    if (!page)
      return fallback
        ? { ok: true as const, source: "url" as const, ...fallback }
        : { ok: false as const, reason: "unavailable" as const };
    try {
      const metadata = extractGiftMetadata(page.html, page.url);
      if (!metadata)
        return fallback
          ? { ok: true as const, source: "url" as const, ...fallback }
          : { ok: false as const, reason: "not_product" as const };
      return { ok: true as const, source: "page" as const, ...metadata };
    } catch {
      log.warn("parse failed");
      return { ok: false as const, reason: "unavailable" as const };
    }
  });
