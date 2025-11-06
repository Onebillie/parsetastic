-- Ensure bills-converted storage bucket exists for PDF-to-image conversion
INSERT INTO storage.buckets (id, name, public)
VALUES ('bills-converted', 'bills-converted', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for converted bills" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage converted bills" ON storage.objects;

-- Public read access for converted bill images
CREATE POLICY "Public read access for converted bills"
ON storage.objects FOR SELECT
USING (bucket_id = 'bills-converted');

-- Allow service role to manage converted images  
CREATE POLICY "Service role can manage converted bills"
ON storage.objects FOR ALL
USING (bucket_id = 'bills-converted' AND auth.role() = 'service_role');