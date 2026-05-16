-- Migration 010: Orders status constraint fix + audit additions
-- Fixes the orders.status check constraint to include values the application
-- actually writes ('paid', 'refund_failed'). The original schema only had
-- ('pending', 'completed', 'refunded', 'cancelled').

-- ── orders.status constraint ──────────────────────────────────────────────────
-- PostgreSQL names inline CHECK constraints as <table>_<column>_check.
-- We drop the old constraint (if it exists) and replace with the full set.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN ('pending', 'paid', 'completed', 'refunded', 'cancelled', 'refund_failed')
  );

-- ── platform_payouts.amount_cents ─────────────────────────────────────────────
-- Webhook now stores the raw Stripe application_fee_amount in integer cents.
-- Add the column if it doesn't exist; existing rows keep amount (dollars).
ALTER TABLE public.platform_payouts
  ADD COLUMN IF NOT EXISTS amount_cents integer;

-- ── Ticket transfer history ───────────────────────────────────────────────────
-- Lightweight audit log so the original owner has a record of transfers.
-- The transfer endpoint now requires currentEmail verification (C5 fix).
CREATE TABLE IF NOT EXISTS public.ticket_transfers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_email     text NOT NULL,
  to_name        text NOT NULL,
  to_email       text NOT NULL,
  transferred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id
  ON public.ticket_transfers(ticket_id);

-- ── orders: ref_code index ────────────────────────────────────────────────────
-- ref_code was added in 007_referrals_group_pricing.sql but without an index.
CREATE INDEX IF NOT EXISTS idx_orders_ref_code
  ON public.orders(ref_code)
  WHERE ref_code IS NOT NULL;
