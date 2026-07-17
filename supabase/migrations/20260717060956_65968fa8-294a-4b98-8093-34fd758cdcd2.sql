CREATE OR REPLACE FUNCTION public._circles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Always trust the authenticated user from the request, not client payload.
  NEW.created_by := auth.uid();

  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := public.gen_invite_code();
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS circles_insert_self ON public.circles;

CREATE POLICY circles_insert_authenticated
ON public.circles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());