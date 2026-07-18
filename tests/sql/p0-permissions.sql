-- P0 validation: run against the project DB with superuser (psql via .env PG*).
-- Each block RAISEs on unexpected outcome to fail fast in CI.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------
-- P0-1 : helpers utilisés dans les policies RLS DOIVENT être
--        exécutables par le rôle `authenticated`, sinon outage.
-- ---------------------------------------------------------------
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'is_circle_member(uuid,uuid)',
    'is_circle_admin(uuid,uuid)',
    'shares_circle_with(uuid)',
    'gift_owner_id(uuid)',
    'gift_circle_id(uuid)',
    '_display_name(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF NOT has_function_privilege('authenticated', 'public.' || fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'P0-1 FAIL: authenticated cannot EXECUTE %', fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'P0-1 OK: RLS helpers executable by authenticated';
END $$;

-- ---------------------------------------------------------------
-- P0-2 : ancienne join_circle plus appelable par les users,
--        la v2 l'est.
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.join_circle(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P0-2 FAIL: legacy join_circle still callable';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.join_circle_v2(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P0-2 FAIL: join_circle_v2 not callable by authenticated';
  END IF;
  RAISE NOTICE 'P0-2 OK: join_circle_v2 wired, legacy revoked';
END $$;

-- ---------------------------------------------------------------
-- P0-2 (comportement): rate limit persiste les échecs.
-- Wrapped in a transaction that's rolled back so no join_attempts row survives.
BEGIN;
DO $$
DECLARE
  fake_user constant uuid := gen_random_uuid();
  result jsonb;
  i int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', fake_user::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', fake_user::text)::text, true);
  SET LOCAL role authenticated;

  FOR i IN 1..5 LOOP
    result := public.join_circle_v2('AAAAAAAAAAAA');
    IF (result->>'error') <> 'CODE_INVALID' THEN
      RAISE EXCEPTION 'expected CODE_INVALID, got %', result;
    END IF;
  END LOOP;
  result := public.join_circle_v2('AAAAAAAAAAAA');
  IF (result->>'error') <> 'RATE_LIMITED' THEN
    RAISE EXCEPTION 'P0-2 FAIL: 6th attempt not rate limited, got %', result;
  END IF;
  RAISE NOTICE 'P0-2 OK: invalid attempts count toward rate limit';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------
-- P0-4 : image_path scoping — un gift ne peut pas pointer vers le
--        dossier d'un autre user (trigger _gifts_validate_image_path).
-- ---------------------------------------------------------------
DO $$
DECLARE
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  list_id uuid;
  err text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gifts_validate_image_path') THEN
    RAISE EXCEPTION 'P0-4 FAIL: trigger gifts_validate_image_path missing';
  END IF;
  RAISE NOTICE 'P0-4 OK: image_path trigger present';
END $$;

-- ---------------------------------------------------------------
-- P0-4 : file de purge storage possède les colonnes de retry.
-- ---------------------------------------------------------------
DO $$
DECLARE
  col text;
  cols text[] := ARRAY['attempt_count', 'last_error', 'next_attempt_at'];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='storage_deletions_queue' AND column_name=col
    ) THEN
      RAISE EXCEPTION 'P0-4 FAIL: column % missing on storage_deletions_queue', col;
    END IF;
  END LOOP;
  RAISE NOTICE 'P0-4 OK: storage_deletions_queue has retry columns';
END $$;

SELECT 'ALL P0 CHECKS PASSED' AS status;