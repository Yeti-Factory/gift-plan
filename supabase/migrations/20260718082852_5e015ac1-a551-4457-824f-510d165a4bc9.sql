
-- 1. image_path column on gifts (nullable, backward compatible)
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS image_path text;

-- 2. Deletion queue: files to be removed from storage by a cleanup job.
CREATE TABLE IF NOT EXISTS public.storage_deletions_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  object_path text NOT NULL,
  reason text,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT ALL ON public.storage_deletions_queue TO service_role;
-- authenticated has no direct access; population happens via SECURITY DEFINER trigger.

ALTER TABLE public.storage_deletions_queue ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can read/write (bypasses RLS).

-- 3. Trigger: enqueue image removals on gift delete / image change.
CREATE OR REPLACE FUNCTION public._gifts_enqueue_image_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_path text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_path := OLD.image_path;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.image_path IS DISTINCT FROM OLD.image_path THEN
      old_path := OLD.image_path;
    END IF;
  END IF;

  IF old_path IS NOT NULL AND length(old_path) > 0 THEN
    INSERT INTO public.storage_deletions_queue(bucket, object_path, reason)
    VALUES ('gift-images', old_path,
            CASE WHEN TG_OP = 'DELETE' THEN 'gift_deleted' ELSE 'gift_image_changed' END);
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS gifts_enqueue_image_cleanup ON public.gifts;
CREATE TRIGGER gifts_enqueue_image_cleanup
  AFTER UPDATE OR DELETE ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public._gifts_enqueue_image_cleanup();

-- 4. Storage policy: restrict direct read to the uploader only.
-- Other circle members receive images via short-lived signed URLs generated server-side.
DROP POLICY IF EXISTS gift_images_auth_read ON storage.objects;
CREATE POLICY gift_images_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gift-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
