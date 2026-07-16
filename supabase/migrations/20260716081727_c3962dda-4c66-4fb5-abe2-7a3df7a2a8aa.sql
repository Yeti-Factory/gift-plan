
-- Enums
create type public.gift_priority as enum ('indispensable','j_adorerais','me_plairait');
create type public.reservation_status as enum ('reserved','purchased');
create type public.circle_role as enum ('admin','member');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_all_auth" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Circles
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.circles to authenticated;
grant all on public.circles to service_role;

-- Circle members
create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
grant select, insert, update, delete on public.circle_members to authenticated;
grant all on public.circle_members to service_role;

-- Helper: security-definer membership check (avoids RLS recursion)
create or replace function public.is_circle_member(_circle_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circle_members where circle_id = _circle_id and user_id = _user_id)
$$;
grant execute on function public.is_circle_member(uuid, uuid) to authenticated;

create or replace function public.is_circle_admin(_circle_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circle_members where circle_id = _circle_id and user_id = _user_id and role = 'admin')
$$;
grant execute on function public.is_circle_admin(uuid, uuid) to authenticated;

-- Circles RLS
alter table public.circles enable row level security;
create policy "circles_select_members" on public.circles for select to authenticated
  using (public.is_circle_member(id, auth.uid()));
create policy "circles_insert_self" on public.circles for insert to authenticated
  with check (created_by = auth.uid());
create policy "circles_update_admin" on public.circles for update to authenticated
  using (public.is_circle_admin(id, auth.uid())) with check (public.is_circle_admin(id, auth.uid()));
create policy "circles_delete_admin" on public.circles for delete to authenticated
  using (public.is_circle_admin(id, auth.uid()));

-- Circle members RLS
alter table public.circle_members enable row level security;
create policy "cm_select_same_circle" on public.circle_members for select to authenticated
  using (public.is_circle_member(circle_id, auth.uid()));
create policy "cm_insert_self" on public.circle_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "cm_delete_self_or_admin" on public.circle_members for delete to authenticated
  using (user_id = auth.uid() or public.is_circle_admin(circle_id, auth.uid()));

-- Auto-generate invite code + add creator as admin
create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  select upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6))
$$;

create or replace function public._circles_before_insert() returns trigger language plpgsql as $$
begin
  if new.invite_code is null or new.invite_code = '' then
    new.invite_code := public.gen_invite_code();
  end if;
  return new;
end $$;
create trigger circles_before_insert before insert on public.circles
  for each row execute function public._circles_before_insert();

create or replace function public._circles_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.circle_members(circle_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end $$;
create trigger circles_after_insert after insert on public.circles
  for each row execute function public._circles_after_insert();

-- Join by code
create or replace function public.join_circle_by_code(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _cid uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select id into _cid from public.circles where invite_code = upper(_code);
  if _cid is null then raise exception 'CIRCLE_NOT_FOUND'; end if;
  insert into public.circle_members(circle_id, user_id, role)
    values (_cid, auth.uid(), 'member')
    on conflict do nothing;
  return _cid;
end $$;
grant execute on function public.join_circle_by_code(text) to authenticated;

-- Lists
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  title text not null,
  occasion text,
  event_date date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lists to authenticated;
grant all on public.lists to service_role;
alter table public.lists enable row level security;
create policy "lists_select_circle_members" on public.lists for select to authenticated
  using (public.is_circle_member(circle_id, auth.uid()));
create policy "lists_insert_own" on public.lists for insert to authenticated
  with check (owner_id = auth.uid() and public.is_circle_member(circle_id, auth.uid()));
create policy "lists_update_own" on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "lists_delete_own" on public.lists for delete to authenticated
  using (owner_id = auth.uid());

-- Gifts
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  url text,
  image_url text,
  price numeric(10,2),
  currency text not null default 'EUR',
  priority public.gift_priority not null default 'me_plairait',
  created_at timestamptz not null default now()
);
create index gifts_list_id_idx on public.gifts(list_id);
grant select, insert, update, delete on public.gifts to authenticated;
grant all on public.gifts to service_role;
alter table public.gifts enable row level security;

create or replace function public.gift_circle_id(_gift_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select l.circle_id from public.gifts g join public.lists l on l.id = g.list_id where g.id = _gift_id
$$;
grant execute on function public.gift_circle_id(uuid) to authenticated;

create or replace function public.gift_owner_id(_gift_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from public.gifts where id = _gift_id
$$;
grant execute on function public.gift_owner_id(uuid) to authenticated;

create policy "gifts_select_circle_members" on public.gifts for select to authenticated
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and public.is_circle_member(l.circle_id, auth.uid())
    )
  );
create policy "gifts_insert_own" on public.gifts for insert to authenticated
  with check (owner_id = auth.uid());
create policy "gifts_update_own" on public.gifts for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "gifts_delete_own" on public.gifts for delete to authenticated
  using (owner_id = auth.uid());

-- Reservations
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null unique references public.gifts(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  status public.reservation_status not null default 'reserved',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reservations to authenticated;
grant all on public.reservations to service_role;
alter table public.reservations enable row level security;

-- Owner of a gift MUST NOT see its reservations (surprise protection)
create policy "reservations_select_buyer_or_circle_nonowner" on public.reservations for select to authenticated
  using (
    buyer_id = auth.uid()
    or (
      public.gift_owner_id(gift_id) <> auth.uid()
      and public.is_circle_member(public.gift_circle_id(gift_id), auth.uid())
    )
  );

create policy "reservations_insert_self_nonowner" on public.reservations for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and public.gift_owner_id(gift_id) <> auth.uid()
    and public.is_circle_member(public.gift_circle_id(gift_id), auth.uid())
  );

create policy "reservations_update_buyer" on public.reservations for update to authenticated
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

create policy "reservations_delete_buyer" on public.reservations for delete to authenticated
  using (buyer_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.gifts;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.circle_members;
