import { createFileRoute } from "@tanstack/react-router";

import { createLogger, newRequestId } from "@/lib/logger";
import { getSelfHostedReadiness } from "@/lib/self-hosted/config";
import { getDatabasePool, pingDatabase } from "@/lib/self-hosted/database.server";

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
        let reconnection: "pending" | "done" = "pending";
        if (database === "ok") {
          try {
            const release = await getDatabasePool().query(
              "SELECT 1 FROM app_release_events WHERE release_key = 'guide-v3-messaging-2026-10-18'",
            );
            if (release.rowCount) reconnection = "done";
          } catch {
            /* the release is not applied yet */
          }
        }
        // Mail outages should be visible without removing a working app from the proxy.
        const healthy =
          database === "ok" &&
          Object.entries(configuration.checks).every(([name, configured]) =>
            name === "email" ? true : configured,
          );
        return Response.json(
          {
            status: healthy && configuration.ready ? "ok" : "degraded",
            version: process.env.APP_VERSION ?? "dev",
            uptimeMs: Date.now() - bootAt,
            checks: {
              worker: "ok",
              reconnection,
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
