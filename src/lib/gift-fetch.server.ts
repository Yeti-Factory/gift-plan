import { assertSafeUrl } from "./net-guard";
import { createLogger } from "./logger";
import { retryFetch } from "./retry";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 6;

export async function fetchGiftPage(
  rawUrl: string,
  requestId: string,
): Promise<{ html: string; url: string } | null> {
  const log = createLogger("scrape", { requestId });
  let currentUrl = rawUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const safe = await assertSafeUrl(currentUrl);
      const res = await retryFetch(
        () =>
          fetch(safe.href, {
            method: "GET",
            cache: "no-store",
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; GiftPlanBot/1.0; +https://gift-plan.yeti-lab.fr)",
              Accept: "text/html,application/xhtml+xml",
              "Accept-Language": "fr-FR,fr;q=0.9",
            },
          }),
        { attempts: 2, baseDelayMs: 200, logger: log, label: "scrape-fetch" },
      );
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) return null;
        currentUrl = new URL(location, safe).href;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        log.warn("non-ok response", { status: res.status });
        return null;
      }
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!type.startsWith("text/html") && !type.startsWith("application/xhtml+xml")) {
        await res.body?.cancel();
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
        const bytes = value.subarray(0, MAX_BYTES - total);
        chunks.push(bytes);
        total += bytes.byteLength;
        if (total >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
      const buffer = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { html: new TextDecoder("utf-8").decode(buffer), url: safe.href };
    }
    log.warn("too many redirects");
    return null;
  } catch {
    log.warn("product page unavailable");
    return null;
  } finally {
    clearTimeout(timer);
  }
}
