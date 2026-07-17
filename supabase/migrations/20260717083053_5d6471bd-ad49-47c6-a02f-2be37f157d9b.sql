CREATE OR REPLACE FUNCTION public.create_circle(_name text)
RETURNS public.circles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_circle public.circles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO public.circles (name, created_by, invite_code)
  VALUES (trim(_name), auth.uid(), public.gen_invite_code())
  RETURNING * INTO new_circle;

  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (new_circle.id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  RETURN new_circle;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_circle(text) TO authenticated;