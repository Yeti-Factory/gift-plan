
-- set_member_role
CREATE OR REPLACE FUNCTION public.set_member_role(_circle_id uuid, _user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_circle_admin(_circle_id, auth.uid()) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;
  IF _user_id = creator THEN RAISE EXCEPTION 'FORBIDDEN_CREATOR'; END IF;
  UPDATE public.circle_members
     SET role = _role::circle_role
   WHERE circle_id = _circle_id AND user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_member_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;

-- remove_member
CREATE OR REPLACE FUNCTION public.remove_member(_circle_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_circle_admin(_circle_id, auth.uid()) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;
  IF _user_id = creator THEN RAISE EXCEPTION 'FORBIDDEN_CREATOR'; END IF;
  DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;

-- leave_circle
CREATE OR REPLACE FUNCTION public.leave_circle(_circle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid;
  creator uuid;
  successor uuid;
  successor_name text;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = _circle_id AND user_id = caller) THEN
    RAISE EXCEPTION 'NOT_MEMBER';
  END IF;
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;

  IF caller = creator THEN
    -- Chercher un successeur admin
    SELECT user_id INTO successor
      FROM public.circle_members
     WHERE circle_id = _circle_id AND user_id <> caller AND role = 'admin'
     ORDER BY joined_at ASC LIMIT 1;

    IF successor IS NULL THEN
      SELECT user_id INTO successor
        FROM public.circle_members
       WHERE circle_id = _circle_id AND user_id <> caller
       ORDER BY joined_at ASC LIMIT 1;
    END IF;

    IF successor IS NULL THEN
      DELETE FROM public.circles WHERE id = _circle_id;
      RETURN jsonb_build_object('circle_deleted', true);
    END IF;

    UPDATE public.circles SET created_by = successor WHERE id = _circle_id;
    UPDATE public.circle_members SET role = 'admin'
      WHERE circle_id = _circle_id AND user_id = successor;
    DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = caller;

    SELECT display_name INTO successor_name FROM public.profiles WHERE id = successor;
    RETURN jsonb_build_object('circle_deleted', false, 'new_owner_id', successor, 'new_owner_name', successor_name);
  END IF;

  DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = caller;
  RETURN jsonb_build_object('circle_deleted', false);
END;
$$;
REVOKE ALL ON FUNCTION public.leave_circle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_circle(uuid) TO authenticated;

-- Cascade: s'assurer que la suppression d'un cercle nettoie listes/cadeaux/réservations
-- (les FK devraient déjà être ON DELETE CASCADE, mais on vérifie via l'exécution)
