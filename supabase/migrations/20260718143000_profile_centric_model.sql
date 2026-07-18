-- Profile-centric model: public/private profiles, multi-circle list access,
-- direct profile sharing, public discovery and reservation-safe profile pages.
-- Forward-only: the legacy lists.circle_id column is kept nullable for compatibility.

DO $$ BEGIN
  CREATE TYPE public.profile_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TYPE public.list_visibility AS ENUM ('public', 'circles');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS visibility public.profile_visibility NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS email_searchable boolean NOT NULL DEFAULT false;

-- Stable, collision-free handles for existing profiles.
UPDATE public.profiles
SET username = 'profil-' || left(replace(id::text, '-', ''), 12)
WHERE username IS NULL OR btrim(username) = '';

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9][a-z0-9-]{2,39}$');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)),
    'profil-' || left(replace(new.id::text, '-', ''), 12)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END; $$;

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS visibility public.list_visibility NOT NULL DEFAULT 'circles';
ALTER TABLE public.lists ALTER COLUMN circle_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.list_circle_access (
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, circle_id)
);
CREATE INDEX IF NOT EXISTS list_circle_access_circle_idx
  ON public.list_circle_access(circle_id, list_id);

INSERT INTO public.list_circle_access(list_id, circle_id)
SELECT id, circle_id FROM public.lists WHERE circle_id IS NOT NULL
ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, DELETE ON public.list_circle_access TO authenticated;
GRANT ALL ON public.list_circle_access TO service_role;
ALTER TABLE public.list_circle_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_circle_access_select_visible ON public.list_circle_access;
CREATE POLICY list_circle_access_select_visible ON public.list_circle_access
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
    OR public.is_circle_member(circle_id, auth.uid())
  );
DROP POLICY IF EXISTS list_circle_access_insert_owner ON public.list_circle_access;
CREATE POLICY list_circle_access_insert_owner ON public.list_circle_access
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
    AND public.is_circle_member(circle_id, auth.uid())
  );
DROP POLICY IF EXISTS list_circle_access_delete_owner ON public.list_circle_access;
CREATE POLICY list_circle_access_delete_owner ON public.list_circle_access
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.profile_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS profile_share_links_owner_idx
  ON public.profile_share_links(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_share_link_lists (
  share_link_id uuid NOT NULL REFERENCES public.profile_share_links(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  PRIMARY KEY (share_link_id, list_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_share_links TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.profile_share_link_lists TO authenticated;
GRANT ALL ON public.profile_share_links, public.profile_share_link_lists TO service_role;
ALTER TABLE public.profile_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_share_link_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_share_links_owner_all ON public.profile_share_links;
CREATE POLICY profile_share_links_owner_all ON public.profile_share_links
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS profile_share_link_lists_owner_all ON public.profile_share_link_lists;
CREATE POLICY profile_share_link_lists_owner_all ON public.profile_share_link_lists
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profile_share_links s
    WHERE s.id = share_link_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profile_share_links s
    JOIN public.lists l ON l.id = list_id
    WHERE s.id = share_link_id AND s.owner_id = auth.uid() AND l.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.profile_share_is_valid(
  _owner_id uuid, _token uuid, _list_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _token IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profile_share_links s
    WHERE s.owner_id = _owner_id
      AND s.token = _token
      AND s.revoked_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND (
        _list_id IS NULL OR EXISTS (
          SELECT 1 FROM public.profile_share_link_lists sl
          WHERE sl.share_link_id = s.id AND sl.list_id = _list_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_is_visible(
  _owner_id uuid, _viewer_id uuid DEFAULT auth.uid(), _token uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _owner_id AND (
      p.visibility = 'public'
      OR p.id = _viewer_id
      OR public.profile_share_is_valid(p.id, _token, NULL)
      OR (_viewer_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.circles c
        JOIN public.circle_members cm ON cm.circle_id = c.id
        WHERE c.created_by = p.id AND cm.user_id = _viewer_id
      ))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.list_is_visible(
  _list_id uuid, _viewer_id uuid DEFAULT auth.uid(), _token uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = _list_id AND (
      l.owner_id = _viewer_id
      OR l.visibility = 'public'
      OR public.profile_share_is_valid(l.owner_id, _token, l.id)
      OR (_viewer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.list_circle_access la
        WHERE la.list_id = l.id
          AND public.is_circle_member(la.circle_id, _viewer_id)
      ))
    )
  )
$$;

REVOKE ALL ON FUNCTION public.profile_share_is_valid(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_is_visible(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_is_visible(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_visible(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_is_visible(uuid, uuid, uuid) TO anon, authenticated;

-- Replace circle-bound read policies with list-level access policies.
DROP POLICY IF EXISTS lists_select_circle_members ON public.lists;
DROP POLICY IF EXISTS lists_select_profile_access ON public.lists;
CREATE POLICY lists_select_profile_access ON public.lists
  FOR SELECT TO authenticated USING (public.list_is_visible(id, auth.uid(), NULL));

DROP POLICY IF EXISTS lists_insert_own ON public.lists;
CREATE POLICY lists_insert_own ON public.lists
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- Public lists no longer have a mandatory circle_id, so ownership — not circle
-- membership — is the invariant for editing and deleting one's own lists.
DROP POLICY IF EXISTS lists_update_own ON public.lists;
CREATE POLICY lists_update_own ON public.lists
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS lists_delete_own ON public.lists;
CREATE POLICY lists_delete_own ON public.lists
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS gifts_select_circle_members ON public.gifts;
DROP POLICY IF EXISTS gifts_select_profile_access ON public.gifts;
CREATE POLICY gifts_select_profile_access ON public.gifts
  FOR SELECT TO authenticated USING (public.list_is_visible(list_id, auth.uid(), NULL));

DROP POLICY IF EXISTS reservations_select_buyer_or_circle_nonowner ON public.reservations;
DROP POLICY IF EXISTS reservations_select_profile_nonowner ON public.reservations;
CREATE POLICY reservations_select_profile_nonowner ON public.reservations
  FOR SELECT TO authenticated USING (
    buyer_id = auth.uid()
    OR (
      public.gift_owner_id(gift_id) <> auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.gifts g
        WHERE g.id = gift_id AND public.list_is_visible(g.list_id, auth.uid(), NULL)
      )
    )
  );

DROP POLICY IF EXISTS reservations_insert_self_nonowner ON public.reservations;
CREATE POLICY reservations_insert_self_nonowner ON public.reservations
  FOR INSERT TO authenticated WITH CHECK (
    buyer_id = auth.uid()
    AND public.gift_owner_id(gift_id) <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.gifts g
      WHERE g.id = gift_id AND public.list_is_visible(g.list_id, auth.uid(), NULL)
    )
  );

-- Public discovery. Email matching is exact, opt-in and never returns the email.
CREATE OR REPLACE FUNCTION public.search_public_profiles(_query text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  q text := lower(btrim(coalesce(_query, '')));
BEGIN
  IF length(q) < 2 OR length(q) > 100 THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', matches.id,
      'username', matches.username,
      'display_name', matches.display_name,
      'avatar_url', matches.avatar_url,
      'bio', matches.bio
    ) ORDER BY matches.display_name NULLS LAST)
    FROM (
      SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.visibility = 'public'
        AND (
          lower(p.username) LIKE '%' || q || '%'
          OR lower(coalesce(p.display_name, '')) LIKE '%' || q || '%'
          OR (p.email_searchable AND lower(coalesce(u.email, '')) = q)
        )
      ORDER BY p.display_name NULLS LAST
      LIMIT 30
    ) matches
  ), '[]'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION public.search_public_profiles(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_page(_username text, _share_token uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  viewer uuid := auth.uid();
BEGIN
  SELECT * INTO p FROM public.profiles WHERE lower(username) = lower(btrim(_username));
  IF p.id IS NULL THEN RETURN jsonb_build_object('error', 'PROFILE_NOT_FOUND'); END IF;
  IF NOT public.profile_is_visible(p.id, viewer, _share_token)
     AND NOT EXISTS (
       SELECT 1 FROM public.lists public_list
       WHERE public_list.owner_id = p.id AND public_list.visibility = 'public'
     ) THEN
    RETURN jsonb_build_object('error', 'PROFILE_PRIVATE');
  END IF;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'bio', CASE WHEN public.profile_is_visible(p.id, viewer, _share_token) THEN p.bio ELSE NULL END,
      'visibility', p.visibility,
      'is_owner', p.id = viewer
    ),
    'lists', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'occasion', l.occasion,
        'event_date', l.event_date,
        'visibility', l.visibility,
        'gifts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', g.id,
            'title', g.title,
            'description', g.description,
            'url', g.url,
            'image_url', g.image_url,
            'image_path', g.image_path,
            'price', g.price,
            'currency', g.currency,
            'priority', g.priority,
            'reservation', CASE WHEN p.id = viewer THEN NULL ELSE (
              SELECT jsonb_build_object(
                'status', r.status,
                'reserved_by_me', r.buyer_id = viewer
              ) FROM public.reservations r WHERE r.gift_id = g.id
            ) END
          ) ORDER BY g.created_at DESC)
          FROM public.gifts g WHERE g.list_id = l.id
        ), '[]'::jsonb)
      ) ORDER BY l.created_at DESC)
      FROM public.lists l
      WHERE l.owner_id = p.id
        AND public.list_is_visible(l.id, viewer, _share_token)
    ), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_public_list_page(_list_id uuid, _share_token uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.lists%ROWTYPE;
  p public.profiles%ROWTYPE;
  viewer uuid := auth.uid();
BEGIN
  SELECT * INTO l FROM public.lists WHERE id = _list_id;
  IF l.id IS NULL OR NOT public.list_is_visible(l.id, viewer, _share_token) THEN
    RETURN jsonb_build_object('error', 'LIST_NOT_FOUND');
  END IF;
  SELECT * INTO p FROM public.profiles WHERE id = l.owner_id;
  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_url', p.avatar_url, 'bio', CASE WHEN p.visibility = 'public' THEN p.bio ELSE NULL END,
      'visibility', p.visibility, 'is_owner', p.id = viewer
    ),
    'lists', jsonb_build_array(jsonb_build_object(
      'id', l.id, 'title', l.title, 'occasion', l.occasion,
      'event_date', l.event_date, 'visibility', l.visibility,
      'gifts', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', g.id, 'title', g.title, 'description', g.description,
          'url', g.url, 'image_url', g.image_url, 'image_path', g.image_path,
          'price', g.price, 'currency', g.currency, 'priority', g.priority,
          'reservation', CASE WHEN p.id = viewer THEN NULL ELSE (
            SELECT jsonb_build_object('status', r.status, 'reserved_by_me', r.buyer_id = viewer)
            FROM public.reservations r WHERE r.gift_id = g.id
          ) END
        ) ORDER BY g.created_at DESC)
        FROM public.gifts g WHERE g.list_id = l.id
      ), '[]'::jsonb)
    ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_page(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_list_page(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_page(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_list_page(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_list_access(
  _list_id uuid, _visibility public.list_visibility, _circle_ids uuid[] DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lists WHERE id = _list_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'NOT_LIST_OWNER';
  END IF;
  IF _visibility = 'circles' AND coalesce(array_length(_circle_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'CIRCLE_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(_circle_ids, '{}'::uuid[])) cid
    WHERE NOT public.is_circle_member(cid, auth.uid())
  ) THEN RAISE EXCEPTION 'NOT_CIRCLE_MEMBER'; END IF;

  UPDATE public.lists SET
    visibility = _visibility,
    circle_id = CASE WHEN _visibility = 'circles' THEN _circle_ids[1] ELSE NULL END
  WHERE id = _list_id;
  DELETE FROM public.list_circle_access WHERE list_id = _list_id;
  IF _visibility = 'circles' THEN
    INSERT INTO public.list_circle_access(list_id, circle_id)
    SELECT _list_id, cid FROM unnest(_circle_ids) cid ON CONFLICT DO NOTHING;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.create_profile_share_link(
  _list_ids uuid[], _label text DEFAULT NULL, _expires_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE s public.profile_share_links%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF coalesce(array_length(_list_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'LIST_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_list_ids) lid
    WHERE NOT EXISTS (SELECT 1 FROM public.lists l WHERE l.id = lid AND l.owner_id = auth.uid())
  ) THEN RAISE EXCEPTION 'NOT_LIST_OWNER'; END IF;
  INSERT INTO public.profile_share_links(owner_id, label, expires_at)
  VALUES (auth.uid(), nullif(btrim(_label), ''), _expires_at) RETURNING * INTO s;
  INSERT INTO public.profile_share_link_lists(share_link_id, list_id)
  SELECT s.id, lid FROM unnest(_list_ids) lid;
  RETURN jsonb_build_object('id', s.id, 'token', s.token, 'label', s.label, 'expires_at', s.expires_at);
END; $$;

CREATE OR REPLACE FUNCTION public.list_profile_share_links()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'token', s.token,
    'label', s.label,
    'created_at', s.created_at,
    'expires_at', s.expires_at,
    'revoked_at', s.revoked_at,
    'list_ids', (SELECT jsonb_agg(sl.list_id) FROM public.profile_share_link_lists sl WHERE sl.share_link_id = s.id)
  ) ORDER BY s.created_at DESC), '[]'::jsonb)
  FROM public.profile_share_links s WHERE s.owner_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.revoke_profile_share_link(_share_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.profile_share_links SET revoked_at = now()
  WHERE id = _share_id AND owner_id = auth.uid() AND revoked_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.set_gift_reservation(
  _gift_id uuid, _action text, _share_token uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
  g public.gifts%ROWTYPE;
  r public.reservations%ROWTYPE;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO g FROM public.gifts WHERE id = _gift_id;
  IF g.id IS NULL OR NOT public.list_is_visible(g.list_id, viewer, _share_token) THEN
    RAISE EXCEPTION 'GIFT_NOT_VISIBLE';
  END IF;
  IF g.owner_id = viewer THEN RAISE EXCEPTION 'OWNER_CANNOT_RESERVE'; END IF;

  IF _action = 'reserve' THEN
    INSERT INTO public.reservations(gift_id, buyer_id, status)
    VALUES (g.id, viewer, 'reserved') RETURNING * INTO r;
  ELSIF _action = 'purchased' THEN
    UPDATE public.reservations SET status = 'purchased'
    WHERE gift_id = g.id AND buyer_id = viewer RETURNING * INTO r;
  ELSIF _action = 'cancel' THEN
    DELETE FROM public.reservations
    WHERE gift_id = g.id AND buyer_id = viewer RETURNING * INTO r;
  ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ALREADY_RESERVED';
END; $$;

REVOKE ALL ON FUNCTION public.update_list_access(uuid, public.list_visibility, uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_profile_share_link(uuid[], text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_profile_share_links() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_profile_share_link(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_gift_reservation(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_list_access(uuid, public.list_visibility, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_share_link(uuid[], text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_profile_share_links() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_profile_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_gift_reservation(uuid, text, uuid) TO authenticated;

-- Prevent direct invocation of internal trigger/helper functions where applicable.
REVOKE EXECUTE ON FUNCTION public.profile_share_is_valid(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
