-- Migration 008: Add 'refund_failed' to bookings.payment_status constraint
-- The cancel/[token] route sets payment_status = 'refund_failed' when a
-- deposit Stripe refund fails after a customer self-cancel. Without this,
-- the update hits a constraint violation and the status stays unchanged.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid', 'refunded', 'refund_failed'));
