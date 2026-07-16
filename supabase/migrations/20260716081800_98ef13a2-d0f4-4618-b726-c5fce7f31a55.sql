
create policy "gift_images_auth_read" on storage.objects for select to authenticated
  using (bucket_id = 'gift-images');
create policy "gift_images_auth_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'gift-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gift_images_auth_update" on storage.objects for update to authenticated
  using (bucket_id = 'gift-images' and owner = auth.uid());
create policy "gift_images_auth_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'gift-images' and owner = auth.uid());
