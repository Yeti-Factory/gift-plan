CREATE OR REPLACE FUNCTION public._circles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.invite_code is null or new.invite_code = '' then
    new.invite_code := public.gen_invite_code();
  end if;
  return new;
end $function$;