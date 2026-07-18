import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createLogger, newRequestId } from "@/lib/logger";

// Public health-check endpoint for Coolify / uptime probes.
// - GET  → JSON status (200 healthy, 503 degraded)
// - HEAD → 200 if the worker is alive (cheap ping, no DB)
//
// Never returns sensitive data. Uses the publishable key + a narrow read
// against a table with an anon SELECT policy so we don't leak service role.

interface HealthReport {
  status: "ok" | "degraded";
  version: string;
  uptimeMs: number;
  checks: {
    worker: "ok";
    database: "ok" | "fail" | "skip";
  };
  latencyMs: { database?: number };
  timestamp: string;
}

const bootAt = Date.now();

async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false, latencyMs: 0 };

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const started = Date.now();
  try {
    // Tiny query – RLS blocks reads without auth, but we only care that the
    // request round-trips without a network/transport error.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1).abortSignal(controller.signal);
    clearTimeout(timer);
    const latency = Date.now() - started;
    // A PostgREST "empty" response or a RLS-blocked response both mean the
    // database is reachable. Only transport-level failures (`fetch failed`)
    // set `error.message` without a status – treat those as unhealthy.
    if (error && !("code" in error)) return { ok: false, latencyMs: latency };
    return { ok: true, latencyMs: latency };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      HEAD: () => new Response(null, { status: 200, headers: { "cache-control": "no-store" } }),
      GET: async () => {
        const log = createLogger("health", { requestId: newRequestId() });
        const db = await pingDatabase();

        const report: HealthReport = {
          status: db.ok ? "ok" : "degraded",
          version: process.env.APP_VERSION ?? "dev",
          uptimeMs: Date.now() - bootAt,
          checks: { worker: "ok", database: db.ok ? "ok" : "fail" },
          latencyMs: { database: db.latencyMs },
          timestamp: new Date().toISOString(),
        };

        if (!db.ok) log.warn("database unreachable", { latencyMs: db.latencyMs });

        return Response.json(report, {
          status: db.ok ? 200 : 503,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});