import { createFileRoute } from "@tanstack/react-router";

import { getSelfHostedReadiness } from "@/lib/self-hosted/config";
import { pingDatabase } from "@/lib/self-hosted/database.server";

export const Route = createFileRoute("/api/public/self-hosted-ready")({
  server: {
    handlers: {
      GET: async () => {
        const configuration = getSelfHostedReadiness();
        let database: "ok" | "fail" | "not-configured" = "not-configured";
        let latencyMs: number | undefined;

        if (configuration.checks.database && configuration.checks.authSecret) {
          try {
            latencyMs = await pingDatabase();
            database = "ok";
          } catch {
            database = "fail";
          }
        }

        const ready = configuration.ready && database === "ok";
        return Response.json(
          {
            status: ready ? "ready" : "not-ready",
            configuration: configuration.checks,
            missing: configuration.missing,
            database,
            latencyMs,
          },
          { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
