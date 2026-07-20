-- Directional profile-access validation. Run against a TEST database only.
-- All synthetic data is wrapped in a transaction and rolled back.
\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.list_profile_directory(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.request_profile_access(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PROFILE ACCESS FAIL: anon can call authenticated-only RPCs';
  END IF;

  IF has_table_privilege('authenticated', 'public.profile_access_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.profile_access_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.profile_access_requests', 'DELETE') THEN
    RAISE EXCEPTION 'PROFILE ACCESS FAIL: authenticated can bypass mutation RPCs';
  END IF;
END $$;

INSERT INTO auth.users (id, email)
VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'requester@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'owner@test.local')
ON CONFLICT DO NOTHING;

UPDATE public.profiles
SET visibility = 'private'
WHERE id IN (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000d2'
);

INSERT INTO public.lists (id, owner_id, circle_id, title, visibility)
VALUES (
  '00000000-0000-0000-0000-0000000000e3',
  '00000000-0000-0000-0000-0000000000d2',
  NULL,
  'Liste privée de test',
  'circles'
)
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

SELECT public.request_profile_access('00000000-0000-0000-0000-0000000000d2');

DO $$
BEGIN
  IF public.profile_is_visible(
    '00000000-0000-0000-0000-0000000000d2', auth.uid(), NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE ACCESS FAIL: pending request grants profile access';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

DO $$
DECLARE request_id uuid;
BEGIN
  SELECT id INTO request_id
  FROM public.profile_access_requests
  WHERE requester_id = '00000000-0000-0000-0000-0000000000c1'
    AND owner_id = auth.uid();
  PERFORM public.respond_profile_access(request_id, true);
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

DO $$
BEGIN
  IF NOT public.profile_is_visible(
    '00000000-0000-0000-0000-0000000000d2', auth.uid(), NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE ACCESS FAIL: accepted request does not grant profile access';
  END IF;
  IF NOT public.list_is_visible(
    '00000000-0000-0000-0000-0000000000e3', auth.uid(), NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE ACCESS FAIL: accepted request does not grant list access';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

SELECT public.revoke_profile_access('00000000-0000-0000-0000-0000000000c1');

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

DO $$
BEGIN
  IF public.profile_is_visible(
    '00000000-0000-0000-0000-0000000000d2', auth.uid(), NULL
  ) THEN
    RAISE EXCEPTION 'PROFILE ACCESS FAIL: revoked request still grants access';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;

\echo 'PROFILE ACCESS CHECKS PASSED'
