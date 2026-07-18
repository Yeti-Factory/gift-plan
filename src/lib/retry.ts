// Small exponential-backoff retry helper for external service calls.
// Retries only on transient failures (network error, or 5xx / 408 / 429).
// Never retries on 4xx client errors (400, 401, 403, 404, 422).

import { createLogger, type Logger } from "./logger";

export interface RetryOptions {
  attempts?: number; // total attempts including the first (default 3)
  baseDelayMs?: number; // initial backoff (default 250)
  maxDelayMs?: number; // cap on backoff (default 3000)
  logger?: Logger; // where to log retry attempts
  label?: string; // short label for logs
}

const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetriableStatus(status: number): boolean {
  return RETRIABLE_STATUS.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Runs `fn` up to `attempts` times. `fn` may either throw (network / abort)
 * or return a `Response` — if the response status is retriable we retry.
 * Returns the last Response (or throws the last error).
 */
export async function retryFetch(
  fn: () => Promise<Response>,
  opts: RetryOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 250;
  const max = opts.maxDelayMs ?? 3000;
  const log = opts.logger ?? createLogger("retry");
  const label = opts.label ?? "fetch";

  let lastErr: unknown;
  let lastRes: Response | undefined;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fn();
      if (res.ok || !isRetriableStatus(res.status) || i === attempts) return res;
      lastRes = res;
      log.warn(`${label} retriable status`, { attempt: i, status: res.status });
    } catch (err) {
      lastErr = err;
      if (i === attempts) throw err;
      log.warn(`${label} threw`, {
        attempt: i,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    const delay = Math.min(max, base * 2 ** (i - 1)) + Math.floor(Math.random() * 100);
    await sleep(delay);
  }

  if (lastRes) return lastRes;
  throw lastErr ?? new Error(`${label} failed after ${attempts} attempts`);
}
