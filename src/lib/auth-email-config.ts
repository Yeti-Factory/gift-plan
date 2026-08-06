type AuthEmailEnvironment = Partial<
  Record<
    "RESEND_API_KEY_GIFT_PLAN" | "RESEND_API_KEY" | "LOVABLE_API_KEY" | "AUTH_EMAIL_WEBHOOK_SECRET",
    string
  >
>;

export interface AuthEmailConfigStatus {
  ready: boolean;
  providerConfigured: boolean;
  webhookVerificationConfigured: boolean;
}

export function getAuthEmailConfigStatus(
  env: AuthEmailEnvironment = process.env,
): AuthEmailConfigStatus {
  const providerConfigured = Boolean(env.RESEND_API_KEY_GIFT_PLAN || env.RESEND_API_KEY);
  const webhookVerificationConfigured = Boolean(
    env.LOVABLE_API_KEY || env.AUTH_EMAIL_WEBHOOK_SECRET,
  );

  return {
    ready: providerConfigured && webhookVerificationConfigured,
    providerConfigured,
    webhookVerificationConfigured,
  };
}
