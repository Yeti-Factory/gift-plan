-- Profile-model validation: run after all migrations with a privileged psql role.
\set ON_ERROR_STOP on

DO $$
DECLARE
  required_column text;
BEGIN
  FOREACH required_column IN ARRAY ARRAY['username', 'bio', 'visibility', 'email_searchable'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = required_column
    ) THEN
      RAISE EXCEPTION 'PROFILE MODEL FAIL: profiles.% is missing', required_column;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'list_circle_access'
  ) THEN
    RAISE EXCEPTION 'PROFILE MODEL FAIL: list_circle_access is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_share_links'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_share_link_lists'
  ) THEN
    RAISE EXCEPTION 'PROFILE MODEL FAIL: direct invitation tables are missing';
  END IF;

  IF NOT has_function_privilege('anon', 'public.search_public_profiles(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.get_profile_page(text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROFILE MODEL FAIL: public discovery RPCs are unavailable to anon';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.set_gift_reservation(uuid,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PROFILE MODEL FAIL: reservation RPC is unavailable';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.profile_share_is_valid(uuid,uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PROFILE MODEL FAIL: internal share-token helper is callable directly';
  END IF;

  RAISE NOTICE 'PROFILE MODEL CHECKS PASSED';
END $$;
