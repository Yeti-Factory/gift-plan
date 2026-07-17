REVOKE ALL ON FUNCTION public.create_circle(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_circle(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_circle(text) TO authenticated;