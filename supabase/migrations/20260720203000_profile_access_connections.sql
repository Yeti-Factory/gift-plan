-- Authenticated profile directory and revocable, directional access requests.
-- A requester only gains access to a private profile and all of its lists after
-- the profile owner explicitly accepts. The reverse access is never implied.

DO $$ BEGIN
  CREATE TYPE public.profile_access_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

CREATE TABLE IF NOT EXISTS public.profile_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.profile_access_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT profile_access_requests_distinct_users CHECK (requester_id <> owner_id),
  CONSTRAINT profile_access_requests_pair_unique UNIQUE (requester_id, owner_id)
);

CREATE INDEX IF NOT EXISTS profile_access_requests_owner_status_idx
  ON public.profile_access_requests(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_access_requests_requester_status_idx
  ON public.profile_access_requests(requester_id, status, created_at DESC);

GRANT SELECT ON public.profile_access_requests TO authenticated;
GRANT ALL ON public.profile_access_requests TO service_role;
ALTER TABLE public.profile_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_access_requests_select_participants
  ON public.profile_access_requests;
CREATE POLICY profile_access_requests_select_participants
  ON public.profile_access_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR owner_id = auth.uid());

-- Accepted access makes a private profile visible to the requester. Existing
-- public, owner, share-link and circle access paths remain unchanged.
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
        FROM public.profile_access_requests access_request
        WHERE access_request.owner_id = p.id
          AND access_request.requester_id = _viewer_id
          AND access_request.status = 'accepted'
      ))
      OR (_viewer_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.circles c
        JOIN public.circle_members cm ON cm.circle_id = c.id
        WHERE c.created_by = p.id AND cm.user_id = _viewer_id
      ))
    )
  )
$$;

-- An accepted request grants the requester all current and future lists owned
-- by that profile. This is intentionally directional and fully revocable.
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
        SELECT 1
        FROM public.profile_access_requests access_request
        WHERE access_request.owner_id = l.owner_id
          AND access_request.requester_id = _viewer_id
          AND access_request.status = 'accepted'
      ))
      OR (_viewer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.list_circle_access la
        WHERE la.list_id = l.id
          AND public.is_circle_member(la.circle_id, _viewer_id)
      ))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.list_profile_directory(
  _query text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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

CREATE OR REPLACE FUNCTION public.list_profile_access_inbox()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE viewer uuid := auth.uid();
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  RETURN jsonb_build_object(
    'pending', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'request_id', access_request.id,
        'requester_id', requester.id,
        'username', requester.username,
        'display_name', requester.display_name,
        'avatar_url', requester.avatar_url,
        'created_at', access_request.created_at
      ) ORDER BY access_request.created_at DESC)
      FROM public.profile_access_requests access_request
      JOIN public.profiles requester ON requester.id = access_request.requester_id
      WHERE access_request.owner_id = viewer AND access_request.status = 'pending'
    ), '[]'::jsonb),
    'granted', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'request_id', access_request.id,
        'requester_id', requester.id,
        'username', requester.username,
        'display_name', requester.display_name,
        'avatar_url', requester.avatar_url,
        'responded_at', access_request.responded_at
      ) ORDER BY access_request.responded_at DESC NULLS LAST, access_request.created_at DESC)
      FROM public.profile_access_requests access_request
      JOIN public.profiles requester ON requester.id = access_request.requester_id
      WHERE access_request.owner_id = viewer AND access_request.status = 'accepted'
    ), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_pending_profile_access_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.profile_access_requests
  WHERE owner_id = auth.uid() AND status = 'pending'
$$;

CREATE OR REPLACE FUNCTION public.request_profile_access(_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
  target_visibility public.profile_visibility;
  existing public.profile_access_requests%ROWTYPE;
  saved public.profile_access_requests%ROWTYPE;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF _profile_id = viewer THEN RAISE EXCEPTION 'SELF_REQUEST_FORBIDDEN'; END IF;

  SELECT visibility INTO target_visibility FROM public.profiles WHERE id = _profile_id;
  IF target_visibility IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO existing
  FROM public.profile_access_requests
  WHERE requester_id = viewer AND owner_id = _profile_id;

  IF existing.id IS NOT NULL AND existing.status = 'accepted' THEN
    RETURN jsonb_build_object('id', existing.id, 'status', existing.status);
  END IF;
  IF target_visibility <> 'private' THEN RAISE EXCEPTION 'PROFILE_IS_PUBLIC'; END IF;

  INSERT INTO public.profile_access_requests(
    requester_id, owner_id, status, created_at, updated_at, responded_at
  ) VALUES (
    viewer, _profile_id, 'pending', now(), now(), NULL
  )
  ON CONFLICT (requester_id, owner_id) DO UPDATE SET
    status = 'pending',
    created_at = now(),
    updated_at = now(),
    responded_at = NULL
  RETURNING * INTO saved;

  RETURN jsonb_build_object('id', saved.id, 'status', saved.status);
END; $$;

CREATE OR REPLACE FUNCTION public.respond_profile_access(
  _request_id uuid, _accept boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
  saved public.profile_access_requests%ROWTYPE;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  UPDATE public.profile_access_requests SET
    status = CASE WHEN _accept THEN 'accepted'::public.profile_access_status
                  ELSE 'declined'::public.profile_access_status END,
    responded_at = now(),
    updated_at = now()
  WHERE id = _request_id AND owner_id = viewer AND status = 'pending'
  RETURNING * INTO saved;

  IF saved.id IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id', saved.id, 'status', saved.status);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_profile_access(_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
  affected integer;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  DELETE FROM public.profile_access_requests
  WHERE requester_id = viewer AND owner_id = _profile_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_profile_access(_requester_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  viewer uuid := auth.uid();
  affected integer;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  DELETE FROM public.profile_access_requests
  WHERE requester_id = _requester_id AND owner_id = viewer;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END; $$;

REVOKE ALL ON FUNCTION public.list_profile_directory(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_profile_access_inbox()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pending_profile_access_count()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_profile_access(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_profile_access(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_profile_access(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_profile_access(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_profile_directory(text, integer, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_profile_access_inbox()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_profile_access_count()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_profile_access(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_profile_access(uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_profile_access(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_profile_access(uuid)
  TO authenticated;
