ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancel_token uuid DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS cancelled_by text CHECK (cancelled_by IN ('admin', 'client', 'system'));

-- Backfill existing rows that have no token
UPDATE public.bookings SET cancel_token = gen_random_uuid() WHERE cancel_token IS NULL;
