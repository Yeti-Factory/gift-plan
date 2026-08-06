const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_UPLOAD_DIR = "/data/uploads";

export interface SelfHostedConfig {
  appUrl: string;
  authSecret: string;
  databaseUrl: string;
  emailFrom: string;
  resendApiKey: string;
  uploadDir: string;
  databaseSsl: boolean;
  google?: {
    clientId: string;
    clientSecret: string;
  };
}

export interface SelfHostedReadiness {
  ready: boolean;
  checks: {
    appUrl: boolean;
    authSecret: boolean;
    database: boolean;
    email: boolean;
    uploads: boolean;
    google: boolean;
  };
  missing: string[];
}

type Environment = Record<string, string | undefined>;

function hasValidAppUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function enabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function getSelfHostedReadiness(env: Environment = process.env): SelfHostedReadiness {
  const appUrl = env.APP_URL ?? (env.NODE_ENV === "production" ? undefined : DEFAULT_APP_URL);
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const googlePartiallyConfigured = Boolean(env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET);
  const checks = {
    appUrl: hasValidAppUrl(appUrl),
    authSecret: Boolean(env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32),
    database: Boolean(env.DATABASE_URL),
    email: Boolean(env.RESEND_API_KEY_GIFT_PLAN || env.RESEND_API_KEY),
    uploads: Boolean(env.UPLOAD_DIR || env.NODE_ENV !== "production"),
    google: !googlePartiallyConfigured || googleConfigured,
  };

  const missing = [
    !checks.appUrl && "APP_URL (URL HTTPS publique)",
    !checks.authSecret && "BETTER_AUTH_SECRET (32 caractères minimum)",
    !checks.database && "DATABASE_URL",
    !checks.email && "RESEND_API_KEY_GIFT_PLAN ou RESEND_API_KEY",
    !checks.uploads && "UPLOAD_DIR",
    !checks.google && "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (tous les deux, ou aucun)",
  ].filter((value): value is string => Boolean(value));

  return { ready: missing.length === 0, checks, missing };
}

export function getSelfHostedConfig(env: Environment = process.env): SelfHostedConfig {
  const readiness = getSelfHostedReadiness(env);
  if (!readiness.ready) {
    throw new Error(`Configuration autonome incomplète : ${readiness.missing.join(", ")}`);
  }

  const appUrl = env.APP_URL ?? DEFAULT_APP_URL;
  const resendApiKey = env.RESEND_API_KEY_GIFT_PLAN ?? env.RESEND_API_KEY;
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined;

  return {
    appUrl: new URL(appUrl).origin,
    authSecret: env.BETTER_AUTH_SECRET!,
    databaseUrl: env.DATABASE_URL!,
    databaseSsl: enabled(env.DATABASE_SSL),
    emailFrom: env.AUTH_EMAIL_FROM ?? "Gift-Plan <noreply@yeti-lab.fr>",
    resendApiKey: resendApiKey!,
    uploadDir: env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR,
    google,
  };
}
