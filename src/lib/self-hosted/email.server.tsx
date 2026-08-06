import * as React from "react";
import { render } from "@react-email/render";

import { SignupEmail } from "@/lib/email-templates/signup";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { createLogger } from "@/lib/logger";
import { retryFetch } from "@/lib/retry";
import { getSelfHostedConfig } from "./config";

const log = createLogger("self-hosted-email");

async function sendEmail(to: string, subject: string, element: React.ReactElement) {
  const config = getSelfHostedConfig();
  const html = await render(element);
  const response = await retryFetch(
    () =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from: config.emailFrom, to: [to], subject, html }),
      }),
    { logger: log, label: "resend", attempts: 3 },
  );

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") ?? undefined;
    log.error("Resend rejected the email", undefined, { status: response.status, requestId });
    throw new Error(`Resend email delivery failed (${response.status})`);
  }
}

export async function sendVerificationEmail(email: string, confirmationUrl: string) {
  const config = getSelfHostedConfig();
  await sendEmail(
    email,
    "Confirmez votre adresse email",
    React.createElement(SignupEmail, {
      siteName: "Gift-Plan",
      siteUrl: config.appUrl,
      recipient: email,
      confirmationUrl,
    }),
  );
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  await sendEmail(
    email,
    "Réinitialisez votre mot de passe Gift-Plan",
    React.createElement(RecoveryEmail, {
      siteName: "Gift-Plan",
      confirmationUrl: resetUrl,
    }),
  );
}
