import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { getSelfHostedConfig } from "./config";
import { getDatabasePool } from "./database.server";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.server";

function createAuth() {
  const config = getSelfHostedConfig();
  return betterAuth({
    appName: "Gift-Plan",
    baseURL: config.appUrl,
    basePath: "/api/auth",
    secret: config.authSecret,
    database: getDatabasePool(),
    trustedOrigins: [config.appUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(user.email, url);
      },
    },
    emailVerification: {
      expiresIn: 60 * 60 * 24,
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(user.email, url);
      },
    },
    socialProviders: config.google
      ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
          },
        }
      : undefined,
    advanced: {
      cookiePrefix: "gift-plan",
      useSecureCookies: config.appUrl.startsWith("https://"),
      database: { generateId: "uuid" },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (value) => /^[a-zA-Z0-9_.-]+$/.test(value),
      }),
      tanstackStartCookies(),
    ],
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (!authInstance) authInstance = createAuth();
  return authInstance;
}

export type GiftPlanAuth = ReturnType<typeof getAuth>;
