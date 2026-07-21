-- Public profile avatars with owner-scoped writes and asynchronous cleanup.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'profiles_avatar_path_owner'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_avatar_path_owner
      CHECK (
        avatar_path IS NULL
        OR (storage.foldername(avatar_path))[1] = id::text
      );
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_avatars_insert_own ON storage.objects;
CREATE POLICY profile_avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_update_own ON storage.objects;

DROP POLICY IF EXISTS profile_avatars_delete_own ON storage.objects;
CREATE POLICY profile_avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public._profiles_enqueue_avatar_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_path text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_path := OLD.avatar_path;
  ELSIF NEW.avatar_path IS DISTINCT FROM OLD.avatar_path THEN
    old_path := OLD.avatar_path;
  END IF;

  IF old_path IS NOT NULL AND length(old_path) > 0 THEN
    INSERT INTO public.storage_deletions_queue(bucket, object_path, reason)
    VALUES (
      'profile-avatars',
      old_path,
      CASE WHEN TG_OP = 'DELETE' THEN 'profile_deleted' ELSE 'profile_avatar_changed' END
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS profiles_enqueue_avatar_cleanup ON public.profiles;
CREATE TRIGGER profiles_enqueue_avatar_cleanup
  AFTER UPDATE OF avatar_path OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._profiles_enqueue_avatar_cleanup();
