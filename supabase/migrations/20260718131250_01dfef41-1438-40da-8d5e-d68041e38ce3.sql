
-- P0-1: Restore EXECUTE on RLS helper functions for authenticated.
-- These are SECURITY DEFINER but authenticated still needs EXECUTE to call them
-- from within an RLS policy body.
GRANT EXECUTE ON FUNCTION public.is_circle_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_circle_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_circle_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_owner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_circle_id(uuid) TO authenticated;
-- _display_name is used indirectly by RPCs but let's keep parity for future policies.
GRANT EXECUTE ON FUNCTION public._display_name(uuid) TO authenticated;

-- P1 (bundled here because same policy files): tighten delete policies to
-- require current circle membership, not only historical ownership.
DROP POLICY IF EXISTS gifts_delete_own ON public.gifts;
CREATE POLICY gifts_delete_own ON public.gifts
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = gifts.list_id
        AND public.is_circle_member(l.circle_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS reservations_delete_buyer ON public.reservations;
CREATE POLICY reservations_delete_buyer ON public.reservations
  FOR DELETE TO authenticated
  USING (
    buyer_id = auth.uid()
    AND public.is_circle_member(public.gift_circle_id(gift_id), auth.uid())
  );
