DROP POLICY IF EXISTS gifts_insert_own ON public.gifts;
CREATE POLICY gifts_insert_own ON public.gifts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS reservations_update_buyer ON public.reservations;
CREATE POLICY reservations_update_buyer ON public.reservations
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.gift_owner_id(gift_id) <> auth.uid()
  );