
-- Phase 1: security hardening (non-destructive)

-- 1. circle_members: no direct writes; drop cm_insert_self
DROP POLICY IF EXISTS cm_insert_self ON public.circle_members;
REVOKE INSERT, UPDATE ON public.circle_members FROM authenticated, anon;

-- 2. circle_bans
CREATE TABLE IF NOT EXISTS public.circle_bans (
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid,
  PRIMARY KEY (circle_id, user_id)
);
GRANT SELECT ON public.circle_bans TO authenticated;
GRANT ALL ON public.circle_bans TO service_role;
ALTER TABLE public.circle_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS circle_bans_admin_select ON public.circle_bans;
CREATE POLICY circle_bans_admin_select ON public.circle_bans
  FOR SELECT TO authenticated
  USING (public.is_circle_admin(circle_id, auth.uid()));

-- 3. Invitation code hardening
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS invite_code_created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS invite_code_revoked_at timestamptz;

-- Column-level SELECT for the new metadata (admins seulement via RPC dédiée; on n'ouvre pas la colonne)
-- Ne rien accorder ici : les valeurs ne sont lues que par SECURITY DEFINER get_invite_code

CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  n CONSTANT int := 12;
  result text := '';
  i int;
  rand_bytes bytea;
BEGIN
  rand_bytes := gen_random_bytes(n);
  FOR i IN 0..n-1 LOOP
    result := result || substr(alphabet, (get_byte(rand_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN result;
END $$;

-- 4. join_attempts (rate limit)
CREATE TABLE IF NOT EXISTS public.join_attempts (
  user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS join_attempts_user_time_idx
  ON public.join_attempts (user_id, attempted_at DESC);
GRANT ALL ON public.join_attempts TO service_role;
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
-- pas de policy: seuls les SECURITY DEFINER accèdent

-- 5. join_circle avec bans + expiration + rate limit
CREATE OR REPLACE FUNCTION public.join_circle(_code text)
RETURNS public.circles
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
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  DELETE FROM public.join_attempts WHERE attempted_at < now() - interval '1 hour';
  SELECT count(*) INTO attempts FROM public.join_attempts
    WHERE user_id = auth.uid() AND attempted_at > now() - interval '10 minutes';
  IF attempts >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  INSERT INTO public.join_attempts(user_id) VALUES (auth.uid());

  norm := upper(trim(_code));

  SELECT * INTO found FROM public.circles
    WHERE invite_code = norm
      AND invite_code_revoked_at IS NULL
      AND (invite_code_expires_at IS NULL OR invite_code_expires_at > now());
  IF found.id IS NULL THEN
    RAISE EXCEPTION 'CODE_INVALID';
  END IF;

  IF EXISTS (SELECT 1 FROM public.circle_bans WHERE circle_id = found.id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'BANNED';
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role)
    VALUES (found.id, auth.uid(), 'member')
    ON CONFLICT (circle_id, user_id) DO NOTHING;

  RETURN found;
END $$;

CREATE OR REPLACE FUNCTION public.join_circle_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.circles;
BEGIN
  c := public.join_circle(_code);
  RETURN c.id;
END $$;

-- 6. regenerate_invite_code: reset metadata
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_circle_admin(_circle_id, auth.uid()) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  LOOP
    new_code := public.gen_invite_code();
    BEGIN
      UPDATE public.circles
        SET invite_code = new_code,
            invite_code_created_at = now(),
            invite_code_expires_at = now() + interval '30 days',
            invite_code_revoked_at = NULL
      WHERE id = _circle_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN new_code;
END $$;

-- 7. remove_member: verify + ban
CREATE OR REPLACE FUNCTION public.remove_member(_circle_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid;
  actor uuid;
  target_name_snapshot text;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_circle_admin(_circle_id, actor) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = _circle_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'NOT_MEMBER';
  END IF;
  SELECT created_by INTO creator FROM public.circles WHERE id = _circle_id;
  IF _user_id = creator THEN RAISE EXCEPTION 'FORBIDDEN_CREATOR'; END IF;

  target_name_snapshot := public._display_name(_user_id);
  DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = _user_id;
  INSERT INTO public.circle_bans(circle_id, user_id, banned_by)
    VALUES (_circle_id, _user_id, actor)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name, target_id, target_name)
    VALUES (_circle_id, 'member_removed', actor, public._display_name(actor), _user_id, target_name_snapshot);
END $$;

-- 8. set_member_role: refuse non-member targets
CREATE OR REPLACE FUNCTION public.set_member_role(_circle_id uuid, _user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF previous_role IS NULL THEN RAISE EXCEPTION 'NOT_MEMBER'; END IF;

  IF previous_role = _role::circle_role THEN
    RETURN;
  END IF;

  UPDATE public.circle_members SET role = _role::circle_role
   WHERE circle_id = _circle_id AND user_id = _user_id;

  INSERT INTO public.circle_activity(circle_id, action, actor_id, actor_name, target_id, target_name)
    VALUES (
      _circle_id,
      CASE WHEN _role = 'admin' THEN 'role_promoted' ELSE 'role_demoted' END,
      actor, public._display_name(actor),
      _user_id, public._display_name(_user_id)
    );
END $$;

-- 9. profiles: narrow SELECT to self + shared-circle members
CREATE OR REPLACE FUNCTION public.shares_circle_with(_other uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_members a
    JOIN public.circle_members b ON a.circle_id = b.circle_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  )
$$;

DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self_or_shared_circle ON public.profiles;
CREATE POLICY profiles_select_self_or_shared_circle ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_circle_with(id));

-- 10. gifts: force owner_id = list.owner_id
CREATE OR REPLACE FUNCTION public._gifts_before_write()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  list_owner uuid;
BEGIN
  SELECT owner_id INTO list_owner FROM public.lists WHERE id = NEW.list_id;
  IF list_owner IS NULL THEN RAISE EXCEPTION 'LIST_NOT_FOUND'; END IF;
  NEW.owner_id := list_owner;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gifts_before_write ON public.gifts;
CREATE TRIGGER gifts_before_write
  BEFORE INSERT OR UPDATE ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public._gifts_before_write();

DROP POLICY IF EXISTS gifts_update_own ON public.gifts;
CREATE POLICY gifts_update_own ON public.gifts
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.lists WHERE id = gifts.list_id AND owner_id = auth.uid()
  ))
  WITH CHECK (owner_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.lists WHERE id = gifts.list_id AND owner_id = auth.uid()
  ));

-- 11. lists: update/delete require current membership
DROP POLICY IF EXISTS lists_update_own ON public.lists;
CREATE POLICY lists_update_own ON public.lists
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND public.is_circle_member(circle_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND public.is_circle_member(circle_id, auth.uid()));

DROP POLICY IF EXISTS lists_delete_own ON public.lists;
CREATE POLICY lists_delete_own ON public.lists
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.is_circle_member(circle_id, auth.uid()));

-- 12. reservations: immutable gift_id/buyer_id + membership check
CREATE OR REPLACE FUNCTION public._reservations_before_update()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.gift_id <> OLD.gift_id THEN RAISE EXCEPTION 'GIFT_IMMUTABLE'; END IF;
  IF NEW.buyer_id <> OLD.buyer_id THEN RAISE EXCEPTION 'BUYER_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reservations_before_update ON public.reservations;
CREATE TRIGGER reservations_before_update
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public._reservations_before_update();

DROP POLICY IF EXISTS reservations_update_buyer ON public.reservations;
CREATE POLICY reservations_update_buyer ON public.reservations
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() AND public.is_circle_member(public.gift_circle_id(gift_id), auth.uid()))
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.gift_owner_id(gift_id) <> auth.uid()
    AND public.is_circle_member(public.gift_circle_id(gift_id), auth.uid())
  );

-- 13. circle_activity: writes réservés aux SECURITY DEFINER
REVOKE INSERT, UPDATE, DELETE ON public.circle_activity FROM authenticated, anon;

-- 14. Function grants hygiene
REVOKE EXECUTE ON FUNCTION public.join_circle(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_circle_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_circle(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_circle(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_circle_with(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.join_circle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_circle_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_circle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_circle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_circle_with(uuid) TO authenticated;
