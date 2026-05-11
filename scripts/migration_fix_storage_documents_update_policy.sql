-- Fix: Storage UPDATE-Policy für documents-Bucket fehlt
-- Hintergrund: upsert:true beim Protokoll-Upload löst intern ein UPDATE auf
-- storage.objects aus — ohne UPDATE-Policy schlägt das mit RLS-Fehler fehl.

CREATE POLICY "Allow update flreew_0"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');
