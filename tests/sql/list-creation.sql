-- Run against a test database only. Verifies the exact INSERT ... RETURNING
-- flow used by the list form while keeping all synthetic data in a rollback.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, email)
VALUES
  ('00000000-0000-0000-0000-0000000001a7', 'list-owner@test.local'),
  ('00000000-0000-0000-0000-0000000001b8', 'list-other@test.local')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000001a7","role":"authenticated"}';

DO $$
DECLARE created_id uuid;
BEGIN
  INSERT INTO public.lists (title, visibility, owner_id, circle_id)
  VALUES (
    'Owner list creation test',
    'public',
    '00000000-0000-0000-0000-0000000001a7',
    NULL
  )
  RETURNING id INTO created_id;

  IF created_id IS NULL THEN
    RAISE EXCEPTION 'LIST CREATION RLS FAIL: INSERT RETURNING returned no id';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000001b8","role":"authenticated"}';

DO $$
BEGIN
  BEGIN
    INSERT INTO public.lists (title, visibility, owner_id, circle_id)
    VALUES (
      'Forbidden list creation test',
      'public',
      '00000000-0000-0000-0000-0000000001a7',
      NULL
    );
    RAISE EXCEPTION 'LIST CREATION RLS FAIL: another user created a list for the owner';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
ROLLBACK;

\echo 'LIST CREATION RLS CHECKS PASSED'
