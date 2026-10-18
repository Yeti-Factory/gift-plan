BEGIN;
CREATE OR REPLACE FUNCTION gift_plan_valid_birthday(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT value IS NULL OR (
    value ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    AND right(value, 2) <= CASE left(value, 2)
      WHEN '02' THEN '29' WHEN '04' THEN '30' WHEN '06' THEN '30'
      WHEN '09' THEN '30' WHEN '11' THEN '30' ELSE '31' END
  );
$$;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birthday text CHECK (gift_plan_valid_birthday(birthday));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday text CHECK (gift_plan_valid_birthday(birthday));
CREATE OR REPLACE FUNCTION gift_plan_sync_birthday() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  UPDATE profiles SET birthday = NEW.birthday WHERE id = NEW.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS user_sync_birthday ON "user";
CREATE TRIGGER user_sync_birthday AFTER INSERT OR UPDATE OF birthday ON "user"
FOR EACH ROW EXECUTE FUNCTION gift_plan_sync_birthday();
COMMIT;
