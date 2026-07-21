-- Gift owners must be able to delete gifts from every list they own.
-- The previous policy also required membership in lists.circle_id, a legacy
-- field that is NULL for profile-centric and public lists. PostgreSQL then
-- silently affected zero rows through RLS.

DROP POLICY IF EXISTS gifts_delete_own ON public.gifts;
CREATE POLICY gifts_delete_own ON public.gifts
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.lists l
      WHERE l.id = gifts.list_id
        AND l.owner_id = auth.uid()
    )
  );
