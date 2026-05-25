-- Migration 012: Create public Supabase Storage bucket for QR code images.
--
-- Moving QR codes from the `tickets.qr_code` TEXT column (base64 data URLs,
-- ~4–6 KB each) to object storage dramatically shrinks row size and lets the
-- browser cache images by URL rather than re-parsing kilobytes of base64.
--
-- After running this migration:
--   1. Deploy the updated API routes that call uploadQRToStorage().
--   2. Hit POST /api/admin/migrate-qr-codes to backfill existing tickets.
--   3. Once backfill is confirmed, you may drop the qr_code column (optional).

-- Create the bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-codes',
  'qr-codes',
  true,                        -- public: QR images are served without auth
  524288,                      -- 512 KB max per file (PNGs are ~15–30 KB)
  ARRAY['image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous (unauthenticated) reads — required for public bucket serving
-- (CREATE POLICY IF NOT EXISTS is not supported before Postgres 17)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read qr-codes'
  ) THEN
    CREATE POLICY "Public read qr-codes"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'qr-codes');
  END IF;
END $$;

-- Only the service role (server-side API) may write to this bucket.
-- Supabase service-role key bypasses RLS, so no additional INSERT policy needed.
