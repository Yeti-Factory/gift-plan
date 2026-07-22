import * as React from "react";
import {
  type AuthEmailActionType,
  type AuthEmailDefinitions,
  type AuthEmailHookData,
} from "@lovable.dev/email-js";
import { verifyWebhookRequest, WebhookError } from "@lovable.dev/webhooks-js";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import { createLogger, newRequestId } from "@/lib/logger";
import { retryFetch } from "@/lib/retry";

// Configuration
const SITE_NAME = "Gift-Plan";
const SENDER_DOMAIN = "yeti-lab.fr";
const FROM_DOMAIN = "yeti-lab.fr";
const APP_URL = process.env.APP_URL ?? "https://gift-plan.yeti-lab.fr";
const SITE_URL = APP_URL;
const RESET_PASSWORD_URL = `${SITE_URL}/reset-password`;
const ALLOWED_RECOVERY_REDIRECT_ORIGINS = new Set([
  SITE_URL,
  "https://gift-plan.lovable.app",
  "https://id-preview--96df8292-ee19-43bf-af6b-a257a4d04dfb.lovable.app",
  "https://96df8292-ee19-43bf-af6b-a257a4d04dfb.lovableproject.com",
]);

// Per-IP rate limit (best-effort in-memory).
const WEBHOOK_RATE_WINDOW_MS = 60_000;
const WEBHOOK_RATE_MAX = 20;
const webhookHits = new Map<string, number[]>();

function webhookRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (webhookHits.get(ip) ?? []).filter((t) => now - t < WEBHOOK_RATE_WINDOW_MS);
  if (hits.length >= WEBHOOK_RATE_MAX) {
    webhookHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  webhookHits.set(ip, hits);
  return false;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

const authEmails = {
  signup: {
    subject: "Confirmez votre adresse email",
    render: (data) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        recipient: data.email,
        confirmationUrl: data.url,
      }),
  },
  invite: {
    subject: "Vous avez été invité(e) à rejoindre Gift-Plan",
    render: (data) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: data.url,
      }),
  },
  magiclink: {
    subject: "Votre lien de connexion Gift-Plan",
    render: (data) =>
      React.createElement(MagicLinkEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  recovery: {
    subject: "Réinitialisez votre mot de passe Gift-Plan",
    render: (data) =>
      React.createElement(RecoveryEmail, {
        siteName: SITE_NAME,
        confirmationUrl: forceRecoveryRedirectUrl(data.url),
      }),
  },
  email_change: {
    subject: "Confirmez votre nouvelle adresse email",
    render: (data) =>
      React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: data.old_email ?? "",
        newEmail: data.new_email ?? "",
        confirmationUrl: data.url,
      }),
  },
  reauthentication: {
    subject: "Votre code de vérification Gift-Plan",
    render: (data) => React.createElement(ReauthenticationEmail, { token: data.token ?? "" }),
  },
} satisfies AuthEmailDefinitions;

function forceRecoveryRedirectUrl(value: string) {
  try {
    const url = new URL(value);

    const tokenHash = url.searchParams.get("token") ?? url.searchParams.get("token_hash");
    if (tokenHash) {
      const resetUrl = new URL(RESET_PASSWORD_URL);
      resetUrl.searchParams.set("type", "recovery");
      resetUrl.searchParams.set("token_hash", tokenHash);
      return resetUrl.toString();
    }

    url.searchParams.delete("redirect_uri");
    url.searchParams.set("redirect_to", RESET_PASSWORD_URL);
    return url.toString();
  } catch {
    return value;
  }
}

function isAuthActionType(value: string): value is AuthEmailActionType {
  return value in authEmails;
}

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    const redirectTo = url.searchParams.get("redirect_to") ?? url.searchParams.get("redirect_uri");
    if (!redirectTo) return true;

    const redirectUrl = new URL(redirectTo);
    return redirectUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isExpectedRecoveryUrl(value: string) {
  try {
    const url = new URL(value);
    const backendUrl = process.env.SUPABASE_URL;
    if (backendUrl && url.origin !== new URL(backendUrl).origin) return false;

    const type = url.searchParams.get("type");
    if (type && type !== "recovery") return false;

    const redirectTo = url.searchParams.get("redirect_to") ?? url.searchParams.get("redirect_uri");
    if (!redirectTo) return true;

    return ALLOWED_RECOVERY_REDIRECT_ORIGINS.has(new URL(redirectTo).origin);
  } catch {
    return false;
  }
}

export function isAuthEmailActionAllowed(actionType: AuthEmailActionType, url: string) {
  return actionType !== "recovery" || isExpectedRecoveryUrl(url);
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY_GIFT_PLAN || process.env.RESEND_API_KEY || null;
}

function parseAuthPayload(
  body: unknown,
): { run_id?: string; data: AuthEmailHookData; version?: string } | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as { run_id?: unknown; version?: unknown; type?: unknown; data?: unknown };
  const data = payload.data as Partial<AuthEmailHookData> | undefined;

  if (
    payload.type !== "auth" ||
    !data ||
    typeof data.action_type !== "string" ||
    !isAuthActionType(data.action_type) ||
    typeof data.email !== "string" ||
    typeof data.url !== "string" ||
    !isSafeHttpsUrl(data.url)
  ) {
    return null;
  }

  return {
    run_id: typeof payload.run_id === "string" ? payload.run_id : undefined,
    version: typeof payload.version === "string" ? payload.version : undefined,
    data: {
      action_type: data.action_type,
      url: data.url,
      email: data.email,
      old_email: typeof data.old_email === "string" ? data.old_email : null,
      new_email: typeof data.new_email === "string" ? data.new_email : null,
      site_url: typeof data.site_url === "string" ? data.site_url : SITE_URL,
      token: typeof data.token === "string" ? data.token : null,
      new_token: typeof data.new_token === "string" ? data.new_token : null,
      callback_url: typeof data.callback_url === "string" ? data.callback_url : undefined,
    },
  };
}

async function sendAuthEmailWithResend(body: unknown, requestId: string) {
  const log = createLogger("auth-email", { requestId });
  const resendKey = getResendApiKey();
  if (!resendKey) {
    log.error("resend key missing");
    return Response.json(
      { error: "Email sender is not configured for this deployment" },
      { status: 503 },
    );
  }

  const event = parseAuthPayload(body);
  if (!event) {
    return Response.json({ error: "Invalid auth email webhook payload" }, { status: 400 });
  }
  if (event.version && event.version !== "1") {
    return Response.json(
      { error: `Unsupported payload version: ${event.version}` },
      { status: 400 },
    );
  }
  if (!isAuthEmailActionAllowed(event.data.action_type, event.data.url)) {
    log.warn("unsupported auth email url", { action_type: event.data.action_type });
    return Response.json({ error: "Unsupported auth email action" }, { status: 400 });
  }

  const definition = authEmails[event.data.action_type];
  const { render } = await import("@react-email/render");
  const subject = definition.subject;
  const element = await definition.render(event.data);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  const started = Date.now();
  const response = await retryFetch(
    () =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          ...(event.run_id ? { "Idempotency-Key": event.run_id } : {}),
        },
        body: JSON.stringify({
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          to: [event.data.email],
          subject,
          html,
          text,
        }),
      }),
    { attempts: 3, logger: log, label: "resend" },
  );

  const latencyMs = Date.now() - started;
  if (!response.ok) {
    const errorText = await response.text();
    log.error("resend failed", undefined, {
      status: response.status,
      latencyMs,
      body: errorText.slice(0, 200),
    });
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }

  log.info("sent", { action: event.data.action_type, latencyMs });
  return Response.json({ success: true, sent: true });
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const requestId = newRequestId();
        const ip = clientIp(request);

        // 1. Rate limit before any work
        if (webhookRateLimited(ip)) {
          console.warn(`[auth-email:${requestId}] rate limited ip=${ip}`);
          return new Response("Too Many Requests", { status: 429 });
        }

        return handleAuthWebhook(request, requestId, ip);
      },
    },
  },
});

async function handleAuthWebhook(
  request: Request,
  requestId: string,
  ip: string,
): Promise<Response> {
  const log = createLogger("auth-email", { requestId });
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallbackSecret = process.env.AUTH_EMAIL_WEBHOOK_SECRET;
  const secrets = [apiKey, fallbackSecret].filter((v): v is string => Boolean(v));

  if (secrets.length === 0) {
    log.error("no signing secret configured");
    return new Response("Server misconfigured", { status: 503 });
  }

  // HMAC-SHA256 verification against x-lovable-signature (raw body + timestamp).
  let payload: unknown;
  try {
    const result = await verifyWebhookRequest({
      req: request,
      secret: secrets[0],
      secrets: secrets.slice(1),
    });
    payload = result.payload;
  } catch (e) {
    const code = e instanceof WebhookError ? e.code : "unknown";
    log.warn("hmac rejected", { reason: code, ip });
    return new Response("Unauthorized", { status: 401 });
  }

  return sendAuthEmailWithResend(payload, requestId);
}
