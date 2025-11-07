-- Allow anonymous uploads to the bills-converted bucket
-- This is needed for client-side PDF-to-image conversion uploads
CREATE POLICY "Allow anonymous uploads to converted bills"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bills-converted');