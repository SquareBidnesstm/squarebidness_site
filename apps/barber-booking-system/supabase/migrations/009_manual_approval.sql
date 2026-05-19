-- Migration 009: Manual approval toggle
-- Run in: Supabase SQL Editor
-- -------------------------------------------------------
-- Adds manual_approval flag to shops (off by default).
-- Adds counter_time to bookings for barber alt-time proposals.
-- Extends booking status check to include pending_approval + counter_proposed.
-- -------------------------------------------------------

-- 1. Add manual_approval to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS manual_approval boolean NOT NULL DEFAULT false;

-- 2. Add counter_time to bookings
--    Stores the barber's proposed alternative time as a display string (e.g. "2:00 PM")
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS counter_time text;

-- 3. Extend the status check constraint to cover the two new states.
--    PostgreSQL auto-names the inline check as bookings_status_check.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
    'pending_approval',   -- waiting for barber to CONFIRM / DECLINE / propose alt time
    'counter_proposed'    -- barber proposed an alt time; waiting for client YES / NO
  ));
