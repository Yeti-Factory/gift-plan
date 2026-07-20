-- Onboarding RLS validation. Run against a TEST database only, never prod.
-- Verifies that authenticated users can update onboarding_version /
-- onboarding_completed_at on their OWN profile row, cannot update another
-- user's row, and that the `anon` role cannot update these columns at all.

\set ON_ERROR_STOP on

BEGIN;

-- Two synthetic auth users. auth.users is FK target for profiles.id.
DO $$
DECLARE
  uid_a uuid := '00000000-0000-0000-0000-0000000000a1';
  uid_b uuid := '00000000-0000-0000-0000-0000000000b2';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (uid_a, 'a@test.local') ON CONFLICT DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (uid_b, 'b@test.local') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (id, display_name)
  VALUES (uid_a, 'A'), (uid_b, 'B')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---- 1. Owner can update their own onboarding columns ----
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.profiles
     SET onboarding_version = 1,
         onboarding_completed_at = now()
   WHERE id = '00000000-0000-0000-0000-0000000000a1';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'ONBOARDING RLS FAIL: owner cannot update own profile (rows=%)', affected;
  END IF;
END $$;

-- ---- 2. Owner CANNOT update another user's onboarding columns ----
DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.profiles
     SET onboarding_version = 99,
         onboarding_completed_at = now()
   WHERE id = '00000000-0000-0000-0000-0000000000b2';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'ONBOARDING RLS FAIL: user updated another profile (rows=%)', affected;
  END IF;
END $$;

RESET ROLE;

-- ---- 3. anon cannot update onboarding columns ----
SET LOCAL ROLE anon;

DO $$
DECLARE
  affected int;
BEGIN
  UPDATE public.profiles
     SET onboarding_version = 42
   WHERE id = '00000000-0000-0000-0000-0000000000a1';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'ONBOARDING RLS FAIL: anon updated a profile (rows=%)', affected;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Also acceptable: GRANT denies UPDATE for anon.
  NULL;
END $$;

RESET ROLE;

-- Rollback so the test never persists synthetic rows.
ROLLBACK;

\echo 'ONBOARDING RLS CHECKS PASSED'