-- Product images storage bucket
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_insert" on storage.objects;
create policy "product_images_auth_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "product_images_auth_update" on storage.objects;
create policy "product_images_auth_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_delete" on storage.objects;
create policy "product_images_auth_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');

-- Business logos storage bucket
insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do nothing;

drop policy if exists "business_logos_public_read" on storage.objects;
create policy "business_logos_public_read"
on storage.objects for select
using (bucket_id = 'business-logos');

drop policy if exists "business_logos_auth_insert" on storage.objects;
create policy "business_logos_auth_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-logos' and 
  auth.uid() in (
    select owner_id from businesses where id = (storage.foldername(name))[1]::uuid
  )
);

drop policy if exists "business_logos_auth_update" on storage.objects;
create policy "business_logos_auth_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'business-logos' and 
  auth.uid() in (
    select owner_id from businesses where id = (storage.foldername(name))[1]::uuid
  )
);

drop policy if exists "business_logos_auth_delete" on storage.objects;
create policy "business_logos_auth_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-logos' and 
  auth.uid() in (
    select owner_id from businesses where id = (storage.foldername(name))[1]::uuid
  )
);
