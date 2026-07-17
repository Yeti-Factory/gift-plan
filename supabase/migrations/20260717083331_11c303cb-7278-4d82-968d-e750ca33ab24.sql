CREATE OR REPLACE FUNCTION public.create_circle(_name text)
RETURNS public.circles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_circle public.circles;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO public.circles (name, created_by, invite_code)
  VALUES (trim(_name), caller_id, public.gen_invite_code())
  RETURNING * INTO new_circle;

  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (new_circle.id, caller_id, 'admin')
  ON CONFLICT (circle_id, user_id) DO UPDATE SET role = 'admin';

  RETURN new_circle;
END;
$$;

REVOKE ALL ON FUNCTION public.create_circle(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_circle(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_circle(text) TO authenticated;