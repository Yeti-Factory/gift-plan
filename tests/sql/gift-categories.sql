-- Run against a test database only. Schema contract checks are read-only and
-- the transaction is rolled back for consistency with the other SQL tests.
BEGIN;

DO $$
DECLARE
  category_default text;
  category_nullable text;
  category_count integer;
BEGIN
  SELECT column_default, is_nullable
    INTO category_default, category_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'gifts'
     AND column_name = 'category';

  IF category_default IS NULL OR category_default NOT LIKE '%autre%' THEN
    RAISE EXCEPTION 'gift category default is missing';
  END IF;
  IF category_nullable <> 'NO' THEN
    RAISE EXCEPTION 'gift category must be NOT NULL';
  END IF;

  SELECT count(*) INTO category_count
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'
     AND t.typname = 'gift_category';

  IF category_count <> 14 THEN
    RAISE EXCEPTION 'expected 14 gift categories, got %', category_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'gift_category'
       AND e.enumlabel = 'loisirs'
  ) THEN
    RAISE EXCEPTION 'gift category loisirs is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'gift_category'
       AND e.enumlabel = 'musique'
  ) THEN
    RAISE EXCEPTION 'gift category musique is missing';
  END IF;
END $$;

ROLLBACK;
