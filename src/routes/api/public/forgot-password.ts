import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export const Route = createFileRoute("/api/public/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_email" }, { status: 400 });
        }
        const { email } = parsed.data;

        const origin =
          request.headers.get("origin") ||
          (request.headers.get("referer")
            ? new URL(request.headers.get("referer")!).origin
            : "https://gift-plan.yeti-lab.fr");

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
          console.error("[forgot-password] missing backend public env vars");
          return Response.json({ error: "backend_not_configured" }, { status: 500 });
        }

        const supabasePublic = createClient(supabaseUrl, supabaseKey, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (supabaseKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", supabaseKey);
              return fetch(input, { ...init, headers });
            },
          },
        });

        // Always respond 200 to avoid user enumeration.
        const { error } = await supabasePublic.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) {
          console.error("[forgot-password] recovery request failed", error.message);
        }

        return Response.json({ ok: true });
      },
    },
  },
});