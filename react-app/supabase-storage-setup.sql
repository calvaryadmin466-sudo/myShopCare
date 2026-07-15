-- Product images storage bucket
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product_images_auth_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

create policy "product_images_auth_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images');

create policy "product_images_auth_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
