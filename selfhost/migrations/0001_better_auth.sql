BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "user" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "username" text,
  "displayUsername" text
);

CREATE UNIQUE INDEX IF NOT EXISTS user_email_lower_uidx ON "user" (lower("email"));
CREATE UNIQUE INDEX IF NOT EXISTS user_username_lower_uidx
  ON "user" (lower("username")) WHERE "username" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session" ("userId");
CREATE INDEX IF NOT EXISTS session_expires_at_idx ON "session" ("expiresAt");

CREATE TABLE IF NOT EXISTS "account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_provider_account_unique UNIQUE ("providerId", "accountId")
);

CREATE INDEX IF NOT EXISTS account_user_id_idx ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification" ("identifier");
CREATE INDEX IF NOT EXISTS verification_expires_at_idx ON "verification" ("expiresAt");

COMMIT;

