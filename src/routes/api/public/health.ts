import { createFileRoute } from "@tanstack/react-router";

import { createLogger, newRequestId } from "@/lib/logger";
import { getSelfHostedReadiness } from "@/lib/self-hosted/config";
import { pingDatabase } from "@/lib/self-hosted/database.server";

const bootAt = Date.now();

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      HEAD: () => new Response(null, { status: 200, headers: { "cache-control": "no-store" } }),
      GET: async () => {
        const log = createLogger("health", { requestId: newRequestId() });
        const configuration = getSelfHostedReadiness();
        const started = Date.now();
        let database: "ok" | "fail" = "fail";
        let databaseLatencyMs = 0;
        if (configuration.checks.database) {
          try {
            databaseLatencyMs = await pingDatabase();
            database = "ok";
          } catch (error) {
            databaseLatencyMs = Date.now() - started;
            log.warn("database unreachable", {
              latencyMs: databaseLatencyMs,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        const healthy = configuration.ready && database === "ok";
        return Response.json(
          {
            status: healthy ? "ok" : "degraded",
            version: process.env.APP_VERSION ?? "dev",
            uptimeMs: Date.now() - bootAt,
            checks: {
              worker: "ok",
              database,
              email: configuration.checks.email ? "ok" : "fail",
            },
            latencyMs: { database: databaseLatencyMs },
            timestamp: new Date().toISOString(),
          },
          { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
