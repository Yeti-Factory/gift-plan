-- Run against a test database only. Verifies that RLS lets an owner delete a
-- gift from a profile-centric list (legacy circle_id is NULL) while another
-- authenticated user still cannot delete it.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, email)
VALUES
  ('00000000-0000-0000-0000-0000000000a7', 'gift-owner@test.local'),
  ('00000000-0000-0000-0000-0000000000b8', 'gift-other@test.local')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, display_name)
VALUES
  ('00000000-0000-0000-0000-0000000000a7', 'Gift owner'),
  ('00000000-0000-0000-0000-0000000000b8', 'Gift other')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lists (id, owner_id, circle_id, title, visibility)
VALUES (
  '00000000-0000-0000-0000-0000000000c9',
  '00000000-0000-0000-0000-0000000000a7',
  NULL,
  'Profile-centric delete test',
  'public'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.gifts (id, list_id, owner_id, title)
VALUES (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000c9',
  '00000000-0000-0000-0000-0000000000a7',
  'Gift protected by RLS'
)
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';

DO $$
DECLARE affected integer;
BEGIN
  DELETE FROM public.gifts WHERE id = '00000000-0000-0000-0000-0000000000d1';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'GIFT DELETE RLS FAIL: another user deleted the gift';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';

DO $$
DECLARE affected integer;
BEGIN
  DELETE FROM public.gifts WHERE id = '00000000-0000-0000-0000-0000000000d1';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'GIFT DELETE RLS FAIL: owner deleted % rows instead of 1', affected;
  END IF;
END $$;

RESET ROLE;
ROLLBACK;

\echo 'GIFT DELETE RLS CHECKS PASSED'
