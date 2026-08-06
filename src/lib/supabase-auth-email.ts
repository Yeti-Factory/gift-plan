import type { AuthEmailActionType, AuthEmailHookData } from "@lovable.dev/email-js";

export interface NormalizedAuthEmailEvent {
  run_id?: string;
  data: AuthEmailHookData;
  version?: string;
}

interface SupabaseAuthEmailPayload {
  user?: {
    email?: unknown;
    new_email?: unknown;
  };
  email_data?: {
    token?: unknown;
    token_hash?: unknown;
    redirect_to?: unknown;
    email_action_type?: unknown;
    site_url?: unknown;
    token_new?: unknown;
    token_hash_new?: unknown;
    old_email?: unknown;
  };
}

const AUTH_ACTIONS = new Set<AuthEmailActionType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "reauthentication",
]);

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function safeRedirect(value: unknown, allowedOrigins: ReadonlySet<string>, fallback: string) {
  const candidate = nonEmptyString(value);
  if (!candidate) return fallback;

  const url = safeHttpsUrl(candidate);
  return url && allowedOrigins.has(url.origin) ? url.toString() : fallback;
}

function verificationUrl(
  supabaseUrl: string,
  tokenHash: string,
  actionType: AuthEmailActionType,
  redirectTo: string,
) {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function emailData(
  actionType: AuthEmailActionType,
  email: string,
  url: string,
  options: {
    oldEmail?: string | null;
    newEmail?: string | null;
    siteUrl: string;
    token?: string | null;
    newToken?: string | null;
  },
): AuthEmailHookData {
  return {
    action_type: actionType,
    email,
    url,
    old_email: options.oldEmail ?? null,
    new_email: options.newEmail ?? null,
    site_url: options.siteUrl,
    token: options.token ?? null,
    new_token: options.newToken ?? null,
  };
}

export function normalizeSupabaseAuthEmailPayload(
  value: unknown,
  options: {
    appUrl: string;
    supabaseUrl: string;
    messageId: string;
    allowedRedirectOrigins?: ReadonlySet<string>;
  },
): NormalizedAuthEmailEvent[] | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as SupabaseAuthEmailPayload;
  const user = payload.user;
  const source = payload.email_data;
  const email = nonEmptyString(user?.email);
  const actionType = nonEmptyString(source?.email_action_type);
  const appUrl = safeHttpsUrl(options.appUrl)?.toString();
  const supabaseUrl = safeHttpsUrl(options.supabaseUrl)?.toString();

  if (
    !user ||
    !source ||
    !email ||
    !actionType ||
    !AUTH_ACTIONS.has(actionType as AuthEmailActionType) ||
    !appUrl ||
    !supabaseUrl
  ) {
    return null;
  }

  const typedAction = actionType as AuthEmailActionType;
  const fallbackOrigin = new URL(appUrl).origin;
  const allowedOrigins = new Set(options.allowedRedirectOrigins ?? [fallbackOrigin]);
  allowedOrigins.add(fallbackOrigin);
  const redirectTo = safeRedirect(source.redirect_to, allowedOrigins, appUrl);
  const token = nonEmptyString(source.token);
  const tokenHash = nonEmptyString(source.token_hash);
  const tokenNew = nonEmptyString(source.token_new);
  const tokenHashNew = nonEmptyString(source.token_hash_new);
  const newEmail = nonEmptyString(user.new_email);
  const oldEmail = nonEmptyString(source.old_email) ?? email;

  if (typedAction === "reauthentication") {
    if (!token) return null;
    return [
      {
        run_id: options.messageId,
        data: emailData(typedAction, email, appUrl, { siteUrl: appUrl, token }),
      },
    ];
  }

  if (typedAction === "email_change") {
    if (!newEmail || !tokenHash) return null;

    const shared = { oldEmail, newEmail, siteUrl: appUrl, token, newToken: tokenNew };
    const events: NormalizedAuthEmailEvent[] = [];

    if (tokenHashNew) {
      events.push({
        run_id: `${options.messageId}:current`,
        data: emailData(
          typedAction,
          email,
          verificationUrl(supabaseUrl, tokenHashNew, typedAction, redirectTo),
          shared,
        ),
      });
    }

    events.push({
      run_id: `${options.messageId}:new`,
      data: emailData(
        typedAction,
        newEmail,
        verificationUrl(supabaseUrl, tokenHash, typedAction, redirectTo),
        shared,
      ),
    });
    return events;
  }

  if (!tokenHash) return null;
  return [
    {
      run_id: options.messageId,
      data: emailData(
        typedAction,
        email,
        verificationUrl(supabaseUrl, tokenHash, typedAction, redirectTo),
        { siteUrl: appUrl, token, newToken: tokenNew },
      ),
    },
  ];
}
