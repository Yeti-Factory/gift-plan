
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(_circle_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  tries int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT public.is_circle_admin(_circle_id, auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  LOOP
    new_code := public.gen_invite_code();
    BEGIN
      UPDATE public.circles SET invite_code = new_code WHERE id = _circle_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN new_code;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) TO authenticated;
