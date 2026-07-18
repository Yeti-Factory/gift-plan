import { isIP } from "net";

/**
 * SSRF protection: reject hostnames/IPs that target internal networks or cloud metadata.
 *
 * We defensively handle two runtimes:
 * - Node (production Docker): use `dns.promises.lookup` for full DNS resolution.
 * - Cloudflare Workers preview: `dns` may be missing → fall back to hostname-only checks.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback", "broadcasthost"]);

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".lan"];

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
  // 0.0.0.0/8
  if ((n & 0xff000000) === 0x00000000) return true;
  // 10.0.0.0/8
  if ((n & 0xff000000) === 0x0a000000) return true;
  // 127.0.0.0/8
  if ((n & 0xff000000) === 0x7f000000) return true;
  // 169.254.0.0/16 (link-local, incl. 169.254.169.254 metadata)
  if ((n & 0xffff0000) === 0xa9fe0000) return true;
  // 172.16.0.0/12
  if ((n & 0xfff00000) === 0xac100000) return true;
  // 192.168.0.0/16
  if ((n & 0xffff0000) === 0xc0a80000) return true;
  // 100.64.0.0/10 (CGNAT)
  if ((n & 0xffc00000) === 0x64400000) return true;
  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  if ((n & 0xf0000000) === 0xe0000000) return true;
  if ((n & 0xf0000000) === 0xf0000000) return true;
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

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  for (const suf of BLOCKED_HOSTNAME_SUFFIXES) {
    if (lower.endsWith(suf)) return true;
  }
  // Literal IP as hostname
  if (isBlockedIp(lower)) return true;
  return false;
}

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
  if (isBlockedHostname(url.hostname)) {
    throw new Error("BLOCKED_HOST");
  }

  // Best-effort DNS resolution (Node runtime).
  try {
    const dns = await import("dns/promises");
    const results = await dns.lookup(url.hostname, { all: true });
    for (const r of results) {
      if (isBlockedIp(r.address)) {
        throw new Error("BLOCKED_RESOLVED_IP");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("BLOCKED_")) throw e;
    // dns module unavailable (Workers) — hostname-only check already applied above.
  }

  return url;
}
