-- INSERT ... RETURNING checks both the INSERT and SELECT policies. The
-- visibility helper queries lists again and cannot see the row created by the
-- command that is still in progress, so an otherwise valid owner insert was
-- rejected. Check ownership directly before falling back to shared access.

DROP POLICY IF EXISTS lists_select_profile_access ON public.lists;
CREATE POLICY lists_select_profile_access ON public.lists
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.list_is_visible(id, auth.uid(), NULL)
  );
