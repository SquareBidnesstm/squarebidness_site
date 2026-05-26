-- =========================================================
-- SQUARE BIDNESS EVENTS PLATFORM
-- events.squarebidness.com
-- CANONICAL SCHEMA — reflects all migrations 001-010
-- Run this to start fresh. For incremental changes apply
-- supabase/migrations/ files in order.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ORGANIZERS
-- Self-serve organizer accounts with Stripe Connect
-- Includes: password auth, email verification, password reset
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organizers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,
  name                     text NOT NULL,
  email                    text NOT NULL UNIQUE,
  phone                    text,
  bio                      text,
  logo_url                 text,
  website                  text,

  -- Stripe Connect
  stripe_account_id        text UNIQUE,
  stripe_onboarding_complete boolean NOT NULL DEFAULT false,

  -- Auth (001: password_hash, 004: reset tokens, 005: email verification)
  password_hash            text,
  reset_token              text,
  reset_token_expires_at   timestamptz,
  email_verified           boolean NOT NULL DEFAULT false,
  verification_token       text,

  -- Access
  is_admin                 boolean NOT NULL DEFAULT false,
  active                   boolean NOT NULL DEFAULT true,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- EVENTS
-- Core event record
-- Includes: refund policy, featured flag, recurrence (006)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  organizer_id         uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,

  title                text NOT NULL,
  description          text,
  category             text CHECK (category IN (
    'comedy', 'trail_ride', 'concert', 'meetup',
    'pop_up', 'community', 'sports', 'other'
  )),

  -- Location
  venue_name           text,
  address              text,
  city                 text,
  state                text,
  zip                  text,
  location_notes       text,

  -- Date & Time
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz NOT NULL,
  timezone             text NOT NULL DEFAULT 'America/Chicago',

  -- Media
  cover_image_url      text,

  -- Visibility
  status               text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  is_public            boolean NOT NULL DEFAULT true,
  is_featured          boolean NOT NULL DEFAULT false,  -- 006

  -- Capacity
  total_capacity       integer CHECK (total_capacity > 0),

  -- Refund policy (006)
  refund_policy        text NOT NULL DEFAULT 'no_refunds'
    CHECK (refund_policy IN ('no_refunds', 'up_to_24h', 'up_to_48h', 'up_to_7d', 'full_refund', 'custom')),
  refund_policy_notes  text,

  -- Recurrence (006)
  recurrence_group_id  uuid,
  recurrence_rule      text,  -- 'weekly' | 'biweekly' | 'monthly'

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_event_time CHECK (starts_at < ends_at)
);

-- =========================================================
-- TICKET TIERS
-- Multiple tiers per event (GA, VIP, Early Bird, etc.)
-- Includes: group pricing (007)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ticket_tiers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  name                 text NOT NULL,
  description          text,
  price                numeric(10,2) NOT NULL CHECK (price >= 0),
  quantity             integer NOT NULL CHECK (quantity > 0),
  quantity_sold        integer NOT NULL DEFAULT 0,

  -- Group / bulk pricing (007)
  group_min_qty        integer,
  group_discount_pct   numeric(5,2),

  -- Sale window
  sale_starts_at       timestamptz,
  sale_ends_at         timestamptz,

  sort_order           integer NOT NULL DEFAULT 0,
  active               boolean NOT NULL DEFAULT true,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_tier_sale_window CHECK (
    sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_starts_at < sale_ends_at
  ),
  CONSTRAINT quantity_sold_valid CHECK (quantity_sold >= 0 AND quantity_sold <= quantity)
);

-- =========================================================
-- ORDERS
-- One order per checkout session (can hold multiple tickets)
-- status: pending → paid → (cancelled | refunded | refund_failed)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code                text NOT NULL UNIQUE,
  event_id                  uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  organizer_id              uuid NOT NULL REFERENCES public.organizers(id) ON DELETE RESTRICT,

  -- Buyer info
  buyer_name                text NOT NULL,
  buyer_email               text NOT NULL,
  buyer_phone               text,

  -- Referral tracking (007)
  ref_code                  text,

  -- Promo code applied at checkout (009)
  promo_id                  uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  promo_discount            numeric(10,2) DEFAULT 0.00 CHECK (promo_discount >= 0),

  -- Financials
  subtotal                  numeric(10,2) NOT NULL CHECK (subtotal >= 0),
  platform_fee              numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (platform_fee >= 0),
  total                     numeric(10,2) NOT NULL CHECK (total >= 0),

  -- Stripe
  stripe_payment_intent_id  text UNIQUE,
  stripe_session_id         text UNIQUE,

  -- pending → paid (on webhook) → cancelled | refunded | refund_failed (010)
  status                    text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'completed', 'refunded', 'cancelled', 'refund_failed')),

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- TICKETS
-- One row per individual ticket issued
-- Includes: tier_name snapshot (002), checked_in_at (003)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code           text NOT NULL UNIQUE,
  order_id              uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id              uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  tier_id               uuid NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE RESTRICT,

  -- Buyer snapshot
  buyer_name            text NOT NULL,
  buyer_email           text NOT NULL,

  -- Tier name snapshot so display works even if tier is deleted (002)
  tier_name             text,

  -- Price snapshot at time of purchase
  price_snapshot        numeric(10,2) NOT NULL CHECK (price_snapshot >= 0),

  -- QR & Wallet
  qr_code               text UNIQUE,
  apple_wallet_pass_url text,
  google_wallet_pass_url text,

  -- Status
  status                text NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'checked_in', 'cancelled', 'refunded')),
  checked_in_at         timestamptz,  -- 003

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- TICKET TRANSFERS (010)
-- Audit log for ticket ownership transfers (C5 fix)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ticket_transfers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_email     text NOT NULL,
  to_name        text NOT NULL,
  to_email       text NOT NULL,
  transferred_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- CHECK INS (003)
-- Door scan log — one row per scan attempt
-- =========================================================
CREATE TABLE IF NOT EXISTS public.check_ins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scanned_by  text,
  scanned_at  timestamptz NOT NULL DEFAULT now(),
  device_info text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- WAITLIST (006)
-- Per-event email waitlist with duplicate guard
-- =========================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text NOT NULL,
  notified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

-- =========================================================
-- PROMO CODES (006/008)
-- Organizer-scoped discount codes (percent or fixed)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id   uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  event_id       uuid REFERENCES public.events(id) ON DELETE CASCADE,  -- null = all events
  code           text NOT NULL,
  discount_type  text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(10,2) NOT NULL,
  max_uses       integer,   -- null = unlimited
  uses           integer NOT NULL DEFAULT 0,
  expires_at     timestamptz,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, code)
);

-- =========================================================
-- REFERRAL CODES (007)
-- Organizer referral tracking; ref_code stored on orders
-- =========================================================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  event_id     uuid REFERENCES public.events(id) ON DELETE SET NULL,
  code         text UNIQUE NOT NULL,
  name         text NOT NULL,
  uses         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- PLATFORM PAYOUTS (schema + 010)
-- Tracks Square Bidness application fee per paid order
-- amount = dollars (legacy), amount_cents = raw Stripe integer (010)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platform_payouts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount             numeric(10,2) NOT NULL CHECK (amount >= 0),
  amount_cents       integer,  -- raw Stripe application_fee_amount (010)
  stripe_transfer_id text,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- PUSH SUBSCRIPTIONS (009)
-- Web Push notification subscriptions per event/order
-- =========================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- INDEXES
-- =========================================================
-- events
CREATE INDEX IF NOT EXISTS idx_events_organizer_id    ON public.events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_slug            ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_starts_at       ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_status          ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_category        ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_is_featured     ON public.events(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_events_recurrence      ON public.events(recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;

-- ticket_tiers
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_id  ON public.ticket_tiers(event_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_event_id        ON public.orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_organizer_id    ON public.orders(organizer_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email     ON public.orders(buyer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_ref_code        ON public.orders(ref_code) WHERE ref_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_promo_id        ON public.orders(promo_id) WHERE promo_id IS NOT NULL;

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_order_id       ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id       ON public.tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tier_id        ON public.tickets(tier_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code    ON public.tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_buyer_email    ON public.tickets(buyer_email);
CREATE INDEX IF NOT EXISTS idx_tickets_status         ON public.tickets(status);

-- support tables
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id ON public.ticket_transfers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket_id    ON public.check_ins(ticket_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event_id     ON public.check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id      ON public.waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_event_id   ON public.promo_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_event_id ON public.push_subscriptions(event_id);

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizers_updated_at ON public.organizers;
CREATE TRIGGER trg_organizers_updated_at
  BEFORE UPDATE ON public.organizers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ticket_tiers_updated_at ON public.ticket_tiers;
CREATE TRIGGER trg_ticket_tiers_updated_at
  BEFORE UPDATE ON public.ticket_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.tickets;
CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PROMO USES — atomic increment RPC (007)
-- =========================================================
CREATE OR REPLACE FUNCTION public.increment_promo_uses(promo_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.promo_codes SET uses = uses + 1 WHERE id = promo_id;
$$;

-- =========================================================
-- quantity_sold AUTO-TRIGGERS
-- NOTE: The application manages quantity_sold explicitly using
-- atomic lte guards. These triggers provide a safety net for
-- direct DB inserts (e.g. admin tools, scripts).
-- =========================================================
CREATE OR REPLACE FUNCTION public.increment_tier_quantity_sold()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ticket_tiers
  SET quantity_sold = quantity_sold + 1
  WHERE id = NEW.tier_id;
  RETURN NEW;
END;
$$;

-- NOTE: Disable this trigger if the application is managing
-- quantity_sold itself (current approach uses explicit lte guards).
-- Leaving it off by default to avoid double-counting.
-- DROP TRIGGER IF EXISTS trg_increment_quantity_sold ON public.tickets;
-- CREATE TRIGGER trg_increment_quantity_sold
--   AFTER INSERT ON public.tickets
--   FOR EACH ROW EXECUTE FUNCTION public.increment_tier_quantity_sold();

CREATE OR REPLACE FUNCTION public.decrement_tier_quantity_sold()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Decrement when a ticket transitions from an active state (valid OR checked_in)
  -- to cancelled/refunded. Without 'checked_in' here, scanned tickets that are later
  -- refunded would never free their capacity slot (migration 011).
  IF NEW.status IN ('cancelled', 'refunded')
     AND OLD.status IN ('valid', 'checked_in') THEN
    UPDATE public.ticket_tiers
    SET quantity_sold = GREATEST(quantity_sold - 1, 0)
    WHERE id = NEW.tier_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_quantity_sold ON public.tickets;
CREATE TRIGGER trg_decrement_quantity_sold
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.decrement_tier_quantity_sold();

-- =========================================================
-- RLS (Row Level Security)
-- Service role bypasses RLS by default in Supabase.
-- All API routes use the service_role client, so RLS is not
-- strictly required for the API layer. Enable per table if
-- you add a Supabase Auth / anon key client in future.
-- =========================================================
-- ALTER TABLE public.organizers  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.events       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tickets      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.orders       ENABLE ROW LEVEL SECURITY;
