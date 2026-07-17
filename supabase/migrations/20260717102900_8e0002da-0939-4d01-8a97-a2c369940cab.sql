
CREATE OR REPLACE FUNCTION public.join_circle(_code text)
RETURNS public.circles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found public.circles;
  norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  norm := upper(trim(_code));

  SELECT * INTO found FROM public.circles WHERE invite_code = norm;
  IF found.id IS NULL THEN
    RAISE EXCEPTION 'CODE_INVALID';
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (found.id, auth.uid(), 'member')
  ON CONFLICT (circle_id, user_id) DO NOTHING;

  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION public.join_circle(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_circle(text) TO authenticated;
