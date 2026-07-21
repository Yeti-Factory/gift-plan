-- Profile avatar RLS validation. Run against a TEST database only, never prod.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  uid_a uuid := '00000000-0000-0000-0000-0000000000a1';
  uid_b uuid := '00000000-0000-0000-0000-0000000000b2';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (uid_a, 'avatar-a@test.local') ON CONFLICT DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (uid_b, 'avatar-b@test.local') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (uid_a, 'Avatar A', 'avatar-a'), (uid_b, 'Avatar B', 'avatar-b')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('profile-avatars', uid_b::text || '/existing.png', uid_b)
  ON CONFLICT (bucket_id, name) DO NOTHING;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- Owner can link an avatar in their own folder to their profile.
DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.profiles
     SET avatar_path = '00000000-0000-0000-0000-0000000000a1/avatar.png',
         avatar_url = 'https://example.test/profile-avatars/a1/avatar.png'
   WHERE id = '00000000-0000-0000-0000-0000000000a1';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: owner could not update own profile';
  END IF;
END $$;

-- Owner cannot point their profile at another user's storage folder.
DO $$
BEGIN
  UPDATE public.profiles
     SET avatar_path = '00000000-0000-0000-0000-0000000000b2/forbidden.png'
   WHERE id = '00000000-0000-0000-0000-0000000000a1';
  RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: cross-folder profile path succeeded';
EXCEPTION WHEN check_violation THEN
  NULL;
END $$;

-- Owner cannot update another user's avatar metadata.
DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.profiles
     SET avatar_url = 'https://example.test/forbidden.png'
   WHERE id = '00000000-0000-0000-0000-0000000000b2';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: user updated another profile';
  END IF;
END $$;

-- Owner can insert in their own folder.
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES (
  'profile-avatars',
  '00000000-0000-0000-0000-0000000000a1/avatar.png',
  '00000000-0000-0000-0000-0000000000a1'::uuid
);

-- Owner cannot delete another user's object.
DO $$
DECLARE
  affected int;
BEGIN
  DELETE FROM storage.objects
   WHERE bucket_id = 'profile-avatars'
     AND name = '00000000-0000-0000-0000-0000000000b2/existing.png';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: user deleted another avatar';
  END IF;
END $$;

-- Owner can delete an object in their own folder.
DO $$
DECLARE
  affected int;
BEGIN
  DELETE FROM storage.objects
   WHERE bucket_id = 'profile-avatars'
     AND name = '00000000-0000-0000-0000-0000000000a1/avatar.png';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: owner could not delete own avatar';
  END IF;
END $$;

-- Cross-folder insert must be rejected.
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES (
    'profile-avatars',
    '00000000-0000-0000-0000-0000000000b2/forbidden.png',
    '00000000-0000-0000-0000-0000000000a1'::uuid
  );
  RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: cross-folder insert succeeded';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  NULL;
END $$;

RESET ROLE;

-- Anonymous users cannot upload avatars.
SET LOCAL ROLE anon;
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES (
    'profile-avatars',
    '00000000-0000-0000-0000-0000000000a1/anon.png',
    '00000000-0000-0000-0000-0000000000a1'::uuid
  );
  RAISE EXCEPTION 'PROFILE AVATAR RLS FAIL: anonymous upload succeeded';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  NULL;
END $$;

RESET ROLE;
ROLLBACK;

\echo 'PROFILE AVATAR RLS CHECKS PASSED'
