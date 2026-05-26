-- ============================================================
-- Pho-Matic Photography — Booking System Schema
-- Run in: Supabase SQL Editor
-- ============================================================

-- Bookings table
CREATE TABLE IF NOT EXISTS phomatic_bookings (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_code             text NOT NULL UNIQUE,
  cancel_token             text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,

  -- Service
  service_id               text NOT NULL,
  service_name             text NOT NULL,
  duration_minutes         integer,

  -- Appointment
  session_date             date NOT NULL,
  session_time             text NOT NULL,   -- display format: "10:00 AM"

  -- Client
  client_name              text NOT NULL,
  client_phone             text NOT NULL,
  client_email             text,
  client_notes             text,

  -- Pricing (all in cents)
  total_price_cents        integer NOT NULL,
  deposit_cents            integer NOT NULL,
  balance_due_cents        integer NOT NULL,
  refund_amount_cents      integer NOT NULL DEFAULT 0,

  -- Stripe
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id   text,

  -- Status: pending | confirmed | completed | cancelled | expired | no_show
  status                   text NOT NULL DEFAULT 'pending',

  cancelled_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Blocked dates (admin can mark days unavailable)
CREATE TABLE IF NOT EXISTS phomatic_blocked_dates (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocked_date date NOT NULL UNIQUE,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pm_bookings_date     ON phomatic_bookings(session_date);
CREATE INDEX IF NOT EXISTS idx_pm_bookings_status   ON phomatic_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pm_bookings_phone    ON phomatic_bookings(client_phone);
CREATE INDEX IF NOT EXISTS idx_pm_bookings_email    ON phomatic_bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_pm_bookings_checkout ON phomatic_bookings(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_pm_bookings_cancel   ON phomatic_bookings(cancel_token);
CREATE INDEX IF NOT EXISTS idx_pm_blocked_date      ON phomatic_blocked_dates(blocked_date);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_phomatic_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pm_bookings_updated_at ON phomatic_bookings;
CREATE TRIGGER trg_pm_bookings_updated_at
  BEFORE UPDATE ON phomatic_bookings
  FOR EACH ROW EXECUTE FUNCTION update_phomatic_bookings_updated_at();

-- Row Level Security (service role bypasses RLS — safe for API usage)
ALTER TABLE phomatic_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE phomatic_blocked_dates ENABLE ROW LEVEL SECURITY;

-- No public access — all reads/writes go through the service role key in API functions
