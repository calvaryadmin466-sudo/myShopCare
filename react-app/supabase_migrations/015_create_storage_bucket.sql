-- ╔══════════════════════════════════════════════════════════╗
-- ║     Create Storage Bucket for Business Logos            ║
-- ╚══════════════════════════════════════════════════════════╝

-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business-logos', 'business-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Grant access to authenticated users
-- Allow authenticated users to upload logos for their own businesses
CREATE POLICY "Authenticated users can upload business logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM businesses 
    WHERE id = public.get_my_business_id()
  )
);

-- Allow authenticated users to view logos
CREATE POLICY "Public can view business logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'business-logos');

-- Allow authenticated users to delete logos for their own businesses
CREATE POLICY "Authenticated users can delete business logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM businesses 
    WHERE id = public.get_my_business_id()
  )
);

-- Allow authenticated users to replace/update logos for their own businesses
CREATE POLICY "Authenticated users can update business logos"
ON storage.objects
FOR UPDATE
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM businesses 
    WHERE id = public.get_my_business_id()
  )
);
