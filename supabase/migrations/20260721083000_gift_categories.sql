-- Gift categories used for iconography and client-side list filtering.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'gift_category'
  ) THEN
    CREATE TYPE public.gift_category AS ENUM (
      'culture',
      'tech_geek',
      'informatique',
      'beaute_bien_etre',
      'mode',
      'sport',
      'maison_deco',
      'jeux_loisirs',
      'gastronomie',
      'voyages_experiences',
      'enfants',
      'autre'
    );
  END IF;
END $$;

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS category public.gift_category NOT NULL DEFAULT 'autre';

CREATE INDEX IF NOT EXISTS gifts_category_idx ON public.gifts(category);

-- The profile/list RPCs build their JSON explicitly, so expose the new field
-- without changing any visibility or surprise-protection rule.
CREATE OR REPLACE FUNCTION public.get_profile_page(
  _username text,
  _share_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
            'category', g.category,
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
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_list_page(
  _list_id uuid,
  _share_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
          'category', g.category,
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
