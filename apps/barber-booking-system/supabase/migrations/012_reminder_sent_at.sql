-- Migration 012: Add reminder_sent_at column to bookings.
-- This column tracks whether a 24h SMS reminder has been sent for a booking.
-- The /api/cron/reminders job filters on IS NULL to find unsent reminders.
-- Without this column the cron fails with a 500 on every invocation.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_sent_at
  ON public.bookings (reminder_sent_at)
  WHERE reminder_sent_at IS NULL;
