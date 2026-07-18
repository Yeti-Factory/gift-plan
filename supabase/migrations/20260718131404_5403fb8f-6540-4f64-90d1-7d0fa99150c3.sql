
-- =========================================================
-- P0-2 : rate limiting réel des tentatives de rejoindre un cercle.
-- =========================================================
CREATE OR REPLACE FUNCTION public.join_circle_v2(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found public.circles;
  norm text;
  attempts int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Cleanup very old attempts.
  DELETE FROM public.join_attempts WHERE attempted_at < now() - interval '1 hour';

  -- Count recent attempts BEFORE inserting the current one.
  SELECT count(*) INTO attempts FROM public.join_attempts
    WHERE user_id = auth.uid() AND attempted_at > now() - interval '10 minutes';
  IF attempts >= 5 THEN
    -- Do not persist this attempt: rate limit already reached.
    RETURN jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
  END IF;

  -- Persist THIS attempt unconditionally so invalid tries also count.
  INSERT INTO public.join_attempts(user_id) VALUES (auth.uid());

  norm := upper(trim(coalesce(_code, '')));

  SELECT * INTO found FROM public.circles
    WHERE invite_code = norm
      AND invite_code_revoked_at IS NULL
      AND (invite_code_expires_at IS NULL OR invite_code_expires_at > now());

  IF found.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CODE_INVALID');
  END IF;

  IF EXISTS (SELECT 1 FROM public.circle_bans WHERE circle_id = found.id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BANNED');
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role)
    VALUES (found.id, auth.uid(), 'member')
    ON CONFLICT (circle_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'circle_id', found.id,
    'circle_name', found.name
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.join_circle_v2(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.join_circle_v2(text) TO authenticated;

-- Disable the old buggy RPC for end-users (kept in DB for historical audits).
REVOKE EXECUTE ON FUNCTION public.join_circle(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_circle_by_code(text) FROM PUBLIC, anon, authenticated;

-- =========================================================
-- P0-4 : durcissement stockage.
-- =========================================================

-- Suivi des retries pour la file de suppression.
ALTER TABLE public.storage_deletions_queue
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS storage_deletions_queue_pending_idx
  ON public.storage_deletions_queue (next_attempt_at)
  WHERE processed_at IS NULL;

-- Empêche image_path de référencer le dossier d'un autre utilisateur.
CREATE OR REPLACE FUNCTION public._gifts_validate_image_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  expected_prefix text;
BEGIN
  IF NEW.image_path IS NULL OR length(NEW.image_path) = 0 THEN
    RETURN NEW;
  END IF;
  expected_prefix := NEW.owner_id::text || '/';
  IF position(expected_prefix in NEW.image_path) <> 1 THEN
    RAISE EXCEPTION 'IMAGE_PATH_FORBIDDEN'
      USING DETAIL = 'image_path must start with the gift owner_id folder';
  END IF;
  -- Deny traversal / absolute paths.
  IF NEW.image_path LIKE '%..%' OR NEW.image_path LIKE '/%' THEN
    RAISE EXCEPTION 'IMAGE_PATH_FORBIDDEN' USING DETAIL = 'illegal characters';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public._gifts_validate_image_path() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gifts_validate_image_path ON public.gifts;
CREATE TRIGGER gifts_validate_image_path
  BEFORE INSERT OR UPDATE ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public._gifts_validate_image_path();
