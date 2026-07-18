-- Superadmin control plane and application-wide maintenance mode.
-- Forward-only. Existing public data policies remain unchanged.

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'superadmin' CHECK (role = 'superadmin'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'Gift-Plan se refait une beauté. Nous revenons très vite !',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.app_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Bootstrap the creator account. The user id remains authoritative even if the
-- public username is changed later.
INSERT INTO public.app_admins (user_id, role)
SELECT id, 'superadmin'
FROM public.profiles
WHERE lower(username) = 'profil-16134649a795'
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_admins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE a.user_id = auth.uid() AND a.role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_app_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'maintenance', s.maintenance_mode,
    'message', s.maintenance_message,
    'is_superadmin', public.is_superadmin()
  )
  FROM public.app_settings s
  WHERE s.id = true;
$$;

CREATE OR REPLACE FUNCTION public.set_maintenance_mode(
  _enabled boolean,
  _message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.app_settings%ROWTYPE;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'SUPERADMIN_REQUIRED';
  END IF;

  UPDATE public.app_settings
  SET maintenance_mode = _enabled,
      maintenance_message = CASE
        WHEN _message IS NULL OR length(btrim(_message)) = 0 THEN maintenance_message
        ELSE left(btrim(_message), 500)
      END,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = true
  RETURNING * INTO result;

  RETURN jsonb_build_object(
    'maintenance', result.maintenance_mode,
    'message', result.maintenance_message,
    'is_superadmin', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_app_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_maintenance_mode(boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_maintenance_mode(boolean, text) TO authenticated;
