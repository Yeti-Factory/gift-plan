import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { getSelfHostedConfig } from "./config";
import { getDatabasePool } from "./database.server";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.server";
import { purgeQueuedUploads } from "./files.server";

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
    user: {
      changeEmail: { enabled: true },
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          const database = await getDatabasePool().connect();
          try {
            await database.query("BEGIN");
            await database.query(
              `WITH successors AS (
                 SELECT c.id AS circle_id, successor.user_id
                   FROM circles c
                   JOIN LATERAL (
                     SELECT cm.user_id
                       FROM circle_members cm
                      WHERE cm.circle_id = c.id AND cm.user_id <> $1::uuid
                      ORDER BY CASE cm.role WHEN 'admin' THEN 0 ELSE 1 END, cm.joined_at
                      LIMIT 1
                   ) successor ON true
                  WHERE c.created_by = $1::uuid
               ), transferred AS (
                 UPDATE circles c SET created_by = s.user_id
                   FROM successors s WHERE c.id = s.circle_id
                   RETURNING c.id, s.user_id
               )
               UPDATE circle_members cm SET role = 'admin'
                 FROM transferred t
                WHERE cm.circle_id = t.id AND cm.user_id = t.user_id`,
              [user.id],
            );
            await database.query("COMMIT");
          } catch (error) {
            await database.query("ROLLBACK");
            throw error;
          } finally {
            database.release();
          }
        },
        afterDelete: async () => {
          await purgeQueuedUploads().catch(() => undefined);
        },
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
