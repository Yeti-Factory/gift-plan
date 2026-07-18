import { isIP } from "net";

/**
 * SSRF protection: reject hostnames/IPs that target internal networks or cloud metadata.
 *
 * Two runtimes are supported:
 * - Node (production Docker): full DNS resolution via `dns.promises.lookup(host, {all:true})`.
 *   Missing DNS is treated as a hard failure (fail-closed).
 * - Cloudflare Workers preview: `dns` is missing → we only apply hostname/IP-literal checks.
 *   Callers running in Workers should never scrape untrusted URLs in that mode.
 *
 * Residual risk: DNS rebinding between the pre-check and the fetch remains possible for
 * short-lived attacks. Mitigation: assertSafeUrl is re-invoked on every redirect hop in
 * gift-scrape (the fetch pipeline never follows redirects automatically). For higher
 * assurance, wrap fetch with a pinned undici Agent — currently out of scope.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  "metadata.google.internal",
  "metadata.goog",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".intranet",
  ".corp",
  ".home.arpa",
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = (n << 8) + b;
  }
  return n >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  // JS bitwise ops return Int32 (signed). Force unsigned before comparison
  // so masks with the top bit set (172.16.x, 169.254.x, 224+, 240+) work.
  const masked = (bits: number) => (n & bits) >>> 0;
  // 0.0.0.0/8
  if (masked(0xff000000) === 0x00000000) return true;
  // 10.0.0.0/8
  if (masked(0xff000000) === 0x0a000000) return true;
  // 127.0.0.0/8
  if (masked(0xff000000) === 0x7f000000) return true;
  // 169.254.0.0/16 (link-local, incl. 169.254.169.254 metadata)
  if (masked(0xffff0000) === 0xa9fe0000) return true;
  // 172.16.0.0/12
  if (masked(0xfff00000) === 0xac100000) return true;
  // 192.168.0.0/16
  if (masked(0xffff0000) === 0xc0a80000) return true;
  // 100.64.0.0/10 (CGNAT)
  if (masked(0xffc00000) === 0x64400000) return true;
  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  if (masked(0xf0000000) === 0xe0000000) return true;
  if (masked(0xf0000000) === 0xf0000000) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // Unique local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
  // IPv4-mapped ::ffff:127.0.0.1 etc.
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return false;
}

/**
 * Normalize a hostname as it might appear in URL.hostname:
 * - lowercased
 * - trailing dot removed
 * - IPv6 brackets removed ("[::1]" -> "::1")
 */
export function normalizeHostname(hostname: string): string {
  let h = hostname.toLowerCase();
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  return h;
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = normalizeHostname(hostname);
  if (!lower) return true;
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  for (const suf of BLOCKED_HOSTNAME_SUFFIXES) {
    if (lower.endsWith(suf)) return true;
  }
  if (isBlockedIp(lower)) return true;
  return false;
}

/**
 * Validate a URL is safe to fetch server-side (SSRF-hardened).
 *
 * Behavior:
 * - Rejects non-http(s) schemes.
 * - Rejects URL-embedded credentials.
 * - Rejects hostnames matching internal suffixes and IP literals in private ranges.
 * - Resolves DNS and rejects if ANY resolved address is private/loopback/link-local/etc.
 * - Fails closed if DNS lookup errors in the Node runtime.
 *   In Workers (no `dns` module), only hostname/IP-literal checks apply.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BLOCKED_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new Error("URL_CREDENTIALS_FORBIDDEN");
  }
  const host = normalizeHostname(url.hostname);
  if (isBlockedHostname(host)) {
    throw new Error("BLOCKED_HOST");
  }

  // Detect Node runtime — Workers exposes globalThis.WebSocketPair but has no `dns`.
  let dns: typeof import("dns/promises") | null = null;
  try {
    dns = await import("dns/promises");
  } catch {
    dns = null;
  }

  if (dns) {
    // Fail-closed: if DNS resolution fails for any reason, refuse the request.
    let results: { address: string; family: number }[];
    try {
      results = await dns.lookup(host, { all: true });
    } catch (e) {
      throw new Error(
        "DNS_LOOKUP_FAILED:" + (e instanceof Error ? e.message : "unknown"),
      );
    }
    if (results.length === 0) throw new Error("DNS_LOOKUP_EMPTY");
    for (const r of results) {
      if (isBlockedIp(r.address)) {
        throw new Error("BLOCKED_RESOLVED_IP");
      }
    }
  }

  return url;
}
