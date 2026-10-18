-- Requested global logout for the updated guide and messaging announcement.
-- Only revoke existing sessions once; later deployments preserve new logins.
DO $$
DECLARE
  first_application boolean;
  revoked integer;
BEGIN
  INSERT INTO app_release_events (release_key)
  VALUES ('guide-v3-messaging-2026-10-18')
  ON CONFLICT (release_key) DO NOTHING;
  first_application := FOUND;
  IF first_application THEN
    DELETE FROM "session";
    GET DIAGNOSTICS revoked = ROW_COUNT;
    UPDATE app_release_events SET revoked_sessions = revoked
    WHERE release_key = 'guide-v3-messaging-2026-10-18';
  END IF;
END $$;
