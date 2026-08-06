BEGIN;

DO $$ BEGIN
  CREATE TYPE circle_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE gift_category AS ENUM (
    'culture', 'tech_geek', 'informatique', 'beaute_bien_etre', 'mode', 'sport',
    'maison_deco', 'jeux_loisirs', 'gastronomie', 'voyages_experiences', 'enfants',
    'musique', 'loisirs', 'autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE gift_priority AS ENUM ('indispensable', 'j_adorerais', 'me_plairait');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE list_visibility AS ENUM ('public', 'circles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE profile_access_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE profile_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('reserved', 'purchased');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  avatar_path text,
  bio text,
  username text NOT NULL,
  visibility profile_visibility NOT NULL DEFAULT 'private',
  email_searchable boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz,
  onboarding_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9][a-z0-9-]{2,39}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx ON profiles (lower(username));

CREATE TABLE IF NOT EXISTS circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  invite_code_created_at timestamptz NOT NULL DEFAULT now(),
  invite_code_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  invite_code_revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  role circle_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS circle_members_user_idx ON circle_members (user_id, joined_at);

CREATE TABLE IF NOT EXISTS circle_bans (
  circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid REFERENCES "user" (id) ON DELETE SET NULL,
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN (
      'role_promoted', 'role_demoted', 'member_removed', 'member_left',
      'ownership_transferred', 'circle_deleted_on_leave'
    )
  ),
  actor_id uuid REFERENCES "user" (id) ON DELETE SET NULL,
  actor_name text,
  target_id uuid REFERENCES "user" (id) ON DELETE SET NULL,
  target_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_activity_circle_created_idx
  ON circle_activity (circle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS join_attempts (
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS join_attempts_user_time_idx
  ON join_attempts (user_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  circle_id uuid REFERENCES circles (id) ON DELETE SET NULL,
  title text NOT NULL,
  occasion text,
  event_date date,
  visibility list_visibility NOT NULL DEFAULT 'circles',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lists_owner_created_idx ON lists (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS list_circle_access (
  list_id uuid NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, circle_id)
);

CREATE INDEX IF NOT EXISTS list_circle_access_circle_idx
  ON list_circle_access (circle_id, list_id);

CREATE TABLE IF NOT EXISTS gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text,
  image_url text,
  image_path text,
  price numeric(10, 2),
  currency text NOT NULL DEFAULT 'EUR',
  priority gift_priority NOT NULL DEFAULT 'me_plairait',
  category gift_category NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gifts_list_id_idx ON gifts (list_id);
CREATE INDEX IF NOT EXISTS gifts_category_idx ON gifts (category);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id uuid NOT NULL UNIQUE REFERENCES gifts (id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  status reservation_status NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  status profile_access_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT profile_access_requests_distinct_users CHECK (requester_id <> owner_id),
  CONSTRAINT profile_access_requests_pair_unique UNIQUE (requester_id, owner_id)
);

CREATE INDEX IF NOT EXISTS profile_access_requests_owner_status_idx
  ON profile_access_requests (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_access_requests_requester_status_idx
  ON profile_access_requests (requester_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS profile_share_links_owner_idx
  ON profile_share_links (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS profile_share_link_lists (
  share_link_id uuid NOT NULL REFERENCES profile_share_links (id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  PRIMARY KEY (share_link_id, list_id)
);

CREATE TABLE IF NOT EXISTS storage_deletions_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  object_path text NOT NULL,
  reason text,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_deletions_queue_pending_idx
  ON storage_deletions_queue (next_attempt_at)
  WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS app_admins (
  user_id uuid PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'superadmin' CHECK (role = 'superadmin'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'Gift-Plan se refait une beauté. Nous revenons très vite !',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES "user" (id) ON DELETE SET NULL
);

INSERT INTO app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION gift_plan_create_profile() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  requested_username text;
BEGIN
  requested_username := lower(coalesce(nullif(NEW."username", ''), ''));
  requested_username := regexp_replace(requested_username, '[^a-z0-9-]+', '-', 'g');
  requested_username := trim(both '-' from requested_username);

  IF length(requested_username) < 3 OR length(requested_username) > 40
     OR EXISTS (SELECT 1 FROM profiles WHERE lower(username) = requested_username) THEN
    requested_username := 'profil-' || left(replace(NEW.id::text, '-', ''), 12);
  END IF;

  INSERT INTO profiles (id, display_name, username, avatar_url)
  VALUES (NEW.id, nullif(NEW.name, ''), requested_username, NEW.image)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_create_profile ON "user";
CREATE TRIGGER user_create_profile
  AFTER INSERT ON "user"
  FOR EACH ROW EXECUTE FUNCTION gift_plan_create_profile();

CREATE OR REPLACE FUNCTION gift_plan_add_circle_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO circle_members (circle_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (circle_id, user_id) DO UPDATE SET role = 'admin';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS circle_add_owner ON circles;
CREATE TRIGGER circle_add_owner
  AFTER INSERT ON circles
  FOR EACH ROW EXECUTE FUNCTION gift_plan_add_circle_owner();

CREATE OR REPLACE FUNCTION gift_plan_enqueue_gift_image_cleanup() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE old_path text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_path := OLD.image_path;
  ELSIF NEW.image_path IS DISTINCT FROM OLD.image_path THEN
    old_path := OLD.image_path;
  END IF;
  IF old_path IS NOT NULL AND length(old_path) > 0 THEN
    INSERT INTO storage_deletions_queue (bucket, object_path, reason)
    VALUES ('gift-images', old_path,
      CASE WHEN TG_OP = 'DELETE' THEN 'gift_deleted' ELSE 'gift_image_changed' END);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS gifts_enqueue_image_cleanup ON gifts;
CREATE TRIGGER gifts_enqueue_image_cleanup
  AFTER UPDATE OF image_path OR DELETE ON gifts
  FOR EACH ROW EXECUTE FUNCTION gift_plan_enqueue_gift_image_cleanup();

CREATE OR REPLACE FUNCTION gift_plan_enqueue_avatar_cleanup() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE old_path text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_path := OLD.avatar_path;
  ELSIF NEW.avatar_path IS DISTINCT FROM OLD.avatar_path THEN
    old_path := OLD.avatar_path;
  END IF;
  IF old_path IS NOT NULL AND length(old_path) > 0 THEN
    INSERT INTO storage_deletions_queue (bucket, object_path, reason)
    VALUES ('profile-avatars', old_path,
      CASE WHEN TG_OP = 'DELETE' THEN 'profile_deleted' ELSE 'profile_avatar_changed' END);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS profiles_enqueue_avatar_cleanup ON profiles;
CREATE TRIGGER profiles_enqueue_avatar_cleanup
  AFTER UPDATE OF avatar_path OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION gift_plan_enqueue_avatar_cleanup();

COMMIT;
