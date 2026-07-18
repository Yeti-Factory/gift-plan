// Security headers applied to every non-webhook response.
// - HSTS: 1 year + preload (only meaningful over HTTPS in prod)
// - X-Content-Type-Options: prevent MIME sniffing
// - X-Frame-Options: deny framing (defense-in-depth alongside frame-ancestors)
// - Referrer-Policy: don't leak paths/queries to third parties
// - Permissions-Policy: block sensor / payment / geolocation APIs we don't use
// - CSP: allow self + configured Supabase origin (REST + realtime).
//   Styles allow 'unsafe-inline' because Tailwind / shadcn inject a style tag;
//   scripts allow 'unsafe-inline' because TanStack Start SSR injects the
//   hydration payload as an inline <script>. A nonce-based CSP would require
//   SSR plumbing we don't have; this still blocks external script origins.

function supabaseOrigin(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

export function buildCsp(): string {
  const sb = supabaseOrigin();
  const sbWs = sb ? sb.replace(/^http/, "ws") : "";
  const connect = ["'self'", sb, sbWs, "https://*.lovable.dev", "https://*.lovable.app"].filter(Boolean).join(" ");
  const img = ["'self'", "data:", "blob:", sb, "https:"].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `img-src ${img}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function applySecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  if (!h.has("content-security-policy")) h.set("content-security-policy", buildCsp());
  h.set("x-content-type-options", "nosniff");
  h.set("x-frame-options", "DENY");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set(
    "permissions-policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  if (process.env.NODE_ENV === "production") {
    h.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  h.set("cross-origin-opener-policy", "same-origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}