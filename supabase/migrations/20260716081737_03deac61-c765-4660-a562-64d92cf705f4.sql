
-- Fix search_path on the two remaining functions
alter function public.gen_invite_code() set search_path = public;
alter function public._circles_before_insert() set search_path = public;

-- Revoke public execute on all our security-definer / helper functions
revoke execute on function public.gen_invite_code() from public;
revoke execute on function public._circles_before_insert() from public;
revoke execute on function public._circles_after_insert() from public;
revoke execute on function public.is_circle_member(uuid, uuid) from public;
revoke execute on function public.is_circle_admin(uuid, uuid) from public;
revoke execute on function public.gift_circle_id(uuid) from public;
revoke execute on function public.gift_owner_id(uuid) from public;
revoke execute on function public.join_circle_by_code(text) from public;
