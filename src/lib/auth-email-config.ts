type AuthEmailEnvironment = Partial<
  Record<
    | "RESEND_API_KEY_GIFT_PLAN"
    | "RESEND_API_KEY"
    | "SEND_EMAIL_HOOK_SECRET"
    | "LOVABLE_API_KEY"
    | "AUTH_EMAIL_WEBHOOK_SECRET",
    string
  >
>;

export interface AuthEmailConfigStatus {
  ready: boolean;
  providerConfigured: boolean;
  webhookVerificationConfigured: boolean;
  supabaseWebhookConfigured: boolean;
  lovableWebhookConfigured: boolean;
}

export function getAuthEmailConfigStatus(
  env: AuthEmailEnvironment = process.env,
): AuthEmailConfigStatus {
  const providerConfigured = Boolean(env.RESEND_API_KEY_GIFT_PLAN || env.RESEND_API_KEY);
  const supabaseWebhookConfigured = Boolean(env.SEND_EMAIL_HOOK_SECRET);
  const lovableWebhookConfigured = Boolean(env.LOVABLE_API_KEY || env.AUTH_EMAIL_WEBHOOK_SECRET);
  const webhookVerificationConfigured = supabaseWebhookConfigured || lovableWebhookConfigured;

  return {
    ready: providerConfigured && webhookVerificationConfigured,
    providerConfigured,
    webhookVerificationConfigured,
    supabaseWebhookConfigured,
    lovableWebhookConfigured,
  };
}
