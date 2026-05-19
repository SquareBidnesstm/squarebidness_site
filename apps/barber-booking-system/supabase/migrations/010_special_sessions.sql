-- Migration 010: Per-barber Special Sessions (off-hours bookings)
-- Run in: Supabase SQL Editor
-- -------------------------------------------------------
-- special_sessions_enabled  — barber-level toggle (default off)
-- special_sessions_price_cents — barber's default off-hours fee (default $150)
-- is_special_session         — flag on bookings
-- special_session_price_cents — the agreed price (set when barber accepts)
-- special_session_checkout_id — Stripe checkout session ID for full payment
-- awaiting_payment            — new status between barber acceptance and client payment
-- -------------------------------------------------------

-- 1. Add special session config to barbers
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS special_sessions_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_sessions_price_cents integer NOT NULL DEFAULT 15000;

-- 2. Add special session fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_special_session boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_session_price_cents integer,
  ADD COLUMN IF NOT EXISTS special_session_checkout_id text;

-- 3. Extend the status check constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
    'pending_approval',
    'counter_proposed',
    'awaiting_payment'   -- barber accepted, waiting for client's full payment via Stripe
  ));

-- 4. Index for Stripe session lookup on payment confirmation
CREATE INDEX IF NOT EXISTS idx_bookings_special_checkout
  ON public.bookings(special_session_checkout_id)
  WHERE special_session_checkout_id IS NOT NULL;
