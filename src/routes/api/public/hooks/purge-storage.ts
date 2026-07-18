import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/lib/logger";

/**
 * Idempotent worker for the storage_deletions_queue.
 *
 * Called by pg_cron every 10 minutes with the project apikey header. Iterates
 * pending rows (with backoff via next_attempt_at), deletes the underlying
 * storage object via supabaseAdmin, then marks the row processed. Failures
 * bump attempt_count and schedule a later retry, capping at 10 attempts.
 */

const MAX_BATCH = 100;
const MAX_ATTEMPTS = 10;

function requireApiKey(request: Request): Response | null {
  const provided = request.headers.get("apikey") ?? request.headers.get("Apikey");
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!expected) return new Response("Server misconfigured", { status: 500 });
  if (!provided || provided !== expected) return new Response("Unauthorized", { status: 401 });
  return null;
}

export const Route = createFileRoute("/api/public/hooks/purge-storage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;

        const log = createLogger("purge-storage");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rows, error } = await supabaseAdmin
          .from("storage_deletions_queue")
          .select("id, bucket, object_path, attempt_count")
          .is("processed_at", null)
          .lte("next_attempt_at", new Date().toISOString())
          .lt("attempt_count", MAX_ATTEMPTS)
          .order("next_attempt_at", { ascending: true })
          .limit(MAX_BATCH);
        if (error) {
          log.error("queue read failed", { err: error.message });
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let deleted = 0;
        let failed = 0;
        for (const r of rows ?? []) {
          const { error: delErr } = await supabaseAdmin.storage
            .from(r.bucket)
            .remove([r.object_path]);
          if (delErr) {
            failed++;
            const nextAttempt = new Date(
              Date.now() + Math.min(2 ** (r.attempt_count + 1), 60) * 60_000,
            ).toISOString();
            await supabaseAdmin
              .from("storage_deletions_queue")
              .update({
                attempt_count: r.attempt_count + 1,
                last_error: delErr.message.slice(0, 500),
                next_attempt_at: nextAttempt,
              })
              .eq("id", r.id);
            log.warn("delete failed", { id: r.id, path: r.object_path, err: delErr.message });
            continue;
          }
          await supabaseAdmin
            .from("storage_deletions_queue")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", r.id);
          deleted++;
        }

        return new Response(
          JSON.stringify({ ok: true, deleted, failed, considered: rows?.length ?? 0 }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});