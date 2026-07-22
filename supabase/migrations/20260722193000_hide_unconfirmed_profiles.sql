-- Keep incomplete signups out of profile discovery. The auth record may exist
-- before its email is confirmed, but it must not look like an active member.

CREATE OR REPLACE FUNCTION public.list_profile_directory(
  _query text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  viewer uuid := auth.uid();
  q text := lower(btrim(coalesce(_query, '')));
  page_limit integer := greatest(1, least(coalesce(_limit, 50), 100));
  page_offset integer := greatest(0, coalesce(_offset, 0));
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  RETURN (
    WITH candidates AS (
      SELECT
        p.id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.visibility,
        CASE
          WHEN public.profile_is_visible(p.id, viewer, NULL) THEN p.bio
          ELSE NULL
        END AS bio,
        public.profile_is_visible(p.id, viewer, NULL) AS can_view,
        p.id = viewer AS is_self,
        outgoing.id AS outgoing_request_id,
        outgoing.status AS outgoing_status,
        incoming.id AS incoming_request_id,
        incoming.status AS incoming_status,
        lower(coalesce(nullif(btrim(p.display_name), ''), p.username)) AS sort_name
      FROM public.profiles p
      JOIN auth.users account
        ON account.id = p.id AND account.confirmed_at IS NOT NULL
      LEFT JOIN public.profile_access_requests outgoing
        ON outgoing.requester_id = viewer AND outgoing.owner_id = p.id
      LEFT JOIN public.profile_access_requests incoming
        ON incoming.requester_id = p.id AND incoming.owner_id = viewer
      WHERE q = ''
        OR lower(p.username) LIKE '%' || q || '%'
        OR lower(coalesce(p.display_name, '')) LIKE '%' || q || '%'
    ), page AS (
      SELECT * FROM candidates
      ORDER BY sort_name, lower(username), id
      LIMIT page_limit OFFSET page_offset
    )
    SELECT jsonb_build_object(
      'profiles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', page.id,
          'username', page.username,
          'display_name', page.display_name,
          'avatar_url', page.avatar_url,
          'bio', page.bio,
          'visibility', page.visibility,
          'can_view', page.can_view,
          'is_self', page.is_self,
          'outgoing_request_id', page.outgoing_request_id,
          'outgoing_status', page.outgoing_status,
          'incoming_request_id', page.incoming_request_id,
          'incoming_status', page.incoming_status
        ) ORDER BY page.sort_name, lower(page.username), page.id)
        FROM page
      ), '[]'::jsonb),
      'total', (SELECT count(*) FROM candidates)
    )
  );
END; $$;

REVOKE ALL ON FUNCTION public.list_profile_directory(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_profile_directory(text, integer, integer) TO authenticated;

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
      JOIN auth.users u ON u.id = p.id AND u.confirmed_at IS NOT NULL
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
