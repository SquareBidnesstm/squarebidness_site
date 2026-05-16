-- Migration 006: Document booking_rules shop_settings key
-- The API reads shop_settings WHERE key = 'booking_rules' to get:
--   min_lead_time_minutes  (default 120 if absent)
--   slot_interval_minutes  (default 30 if absent)
--
-- This migration is a no-op on existing data (INSERT ... ON CONFLICT DO NOTHING)
-- and documents the expected structure so new shops start with sensible defaults.

-- Ensure the shop_settings table has the correct columns (idempotent)
ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS value_json jsonb;

-- Add a comment explaining the booking_rules key
COMMENT ON TABLE public.shop_settings IS
  'Key-value store for per-shop configuration.
   Known keys:
     booking_rules  — jsonb with min_lead_time_minutes (int) and slot_interval_minutes (int)
     deposit_rules  — jsonb with deposit_type, deposit_amount, deposit_pct
  ';

-- For each existing shop that has no booking_rules setting yet, insert defaults.
-- ON CONFLICT DO NOTHING means this is safe to re-run.
INSERT INTO public.shop_settings (shop_id, key, value_json)
SELECT
  s.id,
  'booking_rules',
  '{"min_lead_time_minutes": 120, "slot_interval_minutes": 30}'::jsonb
FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shop_settings ss
  WHERE ss.shop_id = s.id AND ss.key = 'booking_rules'
)
ON CONFLICT DO NOTHING;
