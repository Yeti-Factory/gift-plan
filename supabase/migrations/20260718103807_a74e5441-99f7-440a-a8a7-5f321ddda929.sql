
REVOKE EXECUTE ON FUNCTION public.create_circle(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_circle(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_circle_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_circle(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invite_code(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_circle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_circle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_circle_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_circle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_code(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_circle_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_circle_with(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gift_owner_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gift_circle_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._display_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._circles_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._circles_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._gifts_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._reservations_before_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._gifts_enqueue_image_cleanup() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "no direct access" ON public.join_attempts;
CREATE POLICY "no direct access" ON public.join_attempts
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no direct access" ON public.storage_deletions_queue;
CREATE POLICY "no direct access" ON public.storage_deletions_queue
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
