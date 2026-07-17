import { createFileRoute } from "@tanstack/react-router";
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

        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
          return Response.json({ error: "resend_not_configured" }, { status: 500 });
        }

        const origin =
          request.headers.get("origin") ||
          (request.headers.get("referer")
            ? new URL(request.headers.get("referer")!).origin
            : "https://gift-plan.yeti-lab.fr");

        // Generate a Supabase recovery link via the Admin API.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${origin}/reset-password` },
        });

        // Always respond 200 to avoid user enumeration.
        if (error || !data?.properties?.action_link) {
          console.error("[forgot-password] generateLink failed", error);
          return Response.json({ ok: true });
        }

        const actionLink = data.properties.action_link;

        const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;padding:24px;color:#111">
          <div style="max-width:520px;margin:0 auto">
            <h1 style="color:#e5624a">Gift-Plan</h1>
            <p>Bonjour,</p>
            <p>Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
            <p style="text-align:center;margin:32px 0">
              <a href="${actionLink}" style="background:#e5624a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600">Réinitialiser mon mot de passe</a>
            </p>
            <p style="font-size:12px;color:#666">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br/>
            <a href="${actionLink}" style="color:#e5624a;word-break:break-all">${actionLink}</a></p>
            <p style="font-size:12px;color:#666">Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
            <p style="font-size:12px;color:#999;margin-top:32px">— L'équipe Gift-Plan</p>
          </div>
        </body></html>`;

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Gift-Plan <noreply@yeti-lab.fr>",
            to: [email],
            subject: "Réinitialisation de ton mot de passe Gift-Plan",
            html,
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error("[forgot-password] resend failed", resp.status, text);
        }

        return Response.json({ ok: true });
      },
    },
  },
});