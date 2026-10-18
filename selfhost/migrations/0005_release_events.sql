CREATE TABLE IF NOT EXISTS app_release_events (
  release_key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  revoked_sessions integer NOT NULL DEFAULT 0
);
