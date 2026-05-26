-- Expand the no_barber_overlap exclusion constraint to cover all statuses
-- that hold a slot: pending_approval, counter_proposed, and awaiting_payment.
-- The original constraint (migration 003) only covered pending + confirmed,
-- leaving a race window for the DB-level safety net during approval flows.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_barber_overlap;

ALTER TABLE public.bookings
  ADD CONSTRAINT no_barber_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'pending_approval', 'counter_proposed', 'awaiting_payment'));
