
-- Retirer le SELECT global puis regranter colonne par colonne (sauf invite_code)
REVOKE SELECT ON public.circles FROM authenticated;
GRANT SELECT (id, name, created_by, created_at) ON public.circles TO authenticated;

-- RPC pour récupérer le code d'invitation (admin uniquement)
CREATE OR REPLACE FUNCTION public.get_invite_code(_circle_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT public.is_circle_admin(_circle_id, auth.uid()) THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  SELECT invite_code INTO code FROM public.circles WHERE id = _circle_id;
  RETURN code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invite_code(uuid) TO authenticated;
