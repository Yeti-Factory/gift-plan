
CREATE TABLE public.circle_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('role_promoted','role_demoted','member_removed','member_left','ownership_transferred','circle_deleted_on_leave')),
  actor_id uuid,
  actor_name text,
  target_id uuid,
  target_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX circle_activity_circle_created_idx ON public.circle_activity(circle_id, created_at DESC);

GRANT SELECT, INSERT ON public.circle_activity TO authenticated;
GRANT ALL ON public.circle_activity TO service_role;

ALTER TABLE public.circle_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read circle activity"
  ON public.circle_activity FOR SELECT
  TO authenticated
  USING (public.is_circle_member(circle_id, auth.uid()));

-- No INSERT policy: only SECURITY DEFINER functions can log entries.

-- Helper to fetch a display_name safely
CREATE OR REPLACE FUNCTION public._display_name(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT display_name FROM public.profiles WHERE id = _user_id
$$;

-- set_member_role: log role changes
CREATE OR REPLACE FUNCTION public.set_member_role(_circle_id uuid, _user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  creator uuid;
  previous_role circle_role;
  actor uuid;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_circle_admin(_circle_id, actor) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;
  IF _user_id = creator THEN RAISE EXCEPTION 'FORBIDDEN_CREATOR'; END IF;

  SELECT role INTO previous_role FROM public.circle_members
    WHERE circle_id = _circle_id AND user_id = _user_id;

  UPDATE public.circle_members
     SET role = _role::circle_role
   WHERE circle_id = _circle_id AND user_id = _user_id;

  IF previous_role IS DISTINCT FROM _role::circle_role THEN
    INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name, target_id, target_name)
    VALUES (
      _circle_id,
      CASE WHEN _role = 'admin' THEN 'role_promoted' ELSE 'role_demoted' END,
      actor, public._display_name(actor),
      _user_id, public._display_name(_user_id)
    );
  END IF;
END;
$function$;

-- remove_member: log removal
CREATE OR REPLACE FUNCTION public.remove_member(_circle_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  creator uuid;
  actor uuid;
  target_name_snapshot text;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_circle_admin(_circle_id, actor) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;
  IF _user_id = creator THEN RAISE EXCEPTION 'FORBIDDEN_CREATOR'; END IF;

  target_name_snapshot := public._display_name(_user_id);
  DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = _user_id;

  INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name, target_id, target_name)
  VALUES (_circle_id, 'member_removed', actor, public._display_name(actor), _user_id, target_name_snapshot);
END;
$function$;

-- leave_circle: log departures and ownership transfer
CREATE OR REPLACE FUNCTION public.leave_circle(_circle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  caller uuid;
  caller_name text;
  creator uuid;
  successor uuid;
  successor_name text;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = _circle_id AND user_id = caller) THEN
    RAISE EXCEPTION 'NOT_MEMBER';
  END IF;

  caller_name := public._display_name(caller);
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;

  IF caller = creator THEN
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
      -- Log before deletion (cascade will remove the log too, but this keeps ordering consistent)
      INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name)
      VALUES (_circle_id, 'circle_deleted_on_leave', caller, caller_name);
      DELETE FROM public.circles WHERE id = _circle_id;
      RETURN jsonb_build_object('circle_deleted', true);
    END IF;

    successor_name := public._display_name(successor);

    UPDATE public.circles SET created_by = successor WHERE id = _circle_id;
    UPDATE public.circle_members SET role = 'admin'
      WHERE circle_id = _circle_id AND user_id = successor;
    DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = caller;

    INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name, target_id, target_name)
    VALUES (_circle_id, 'ownership_transferred', caller, caller_name, successor, successor_name);
    INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name)
    VALUES (_circle_id, 'member_left', caller, caller_name);

    RETURN jsonb_build_object('circle_deleted', false, 'new_owner_id', successor, 'new_owner_name', successor_name);
  END IF;

  DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = caller;
  INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name)
  VALUES (_circle_id, 'member_left', caller, caller_name);
  RETURN jsonb_build_object('circle_deleted', false);
END;
$function$;
