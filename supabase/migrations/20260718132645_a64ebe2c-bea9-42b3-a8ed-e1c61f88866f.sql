-- P1: Enforce current circle membership on delete policies (idempotent forward-only fix)
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