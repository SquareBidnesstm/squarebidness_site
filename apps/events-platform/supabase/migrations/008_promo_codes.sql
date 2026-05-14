-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text NOT NULL,
  notified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS waitlist_event_id_idx ON waitlist(event_id);

-- Promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_id        uuid REFERENCES events(id) ON DELETE CASCADE,
  code            text NOT NULL,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric(10,2) NOT NULL,
  max_uses        integer,
  uses            integer NOT NULL DEFAULT 0,
  expires_at      timestamptz,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, code)
);

CREATE INDEX IF NOT EXISTS promo_codes_event_id_idx ON promo_codes(event_id);

-- Refund policy on events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS refund_policy text NOT NULL DEFAULT 'no_refunds'
    CHECK (refund_policy IN ('no_refunds', 'up_to_24h', 'up_to_48h', 'up_to_7d', 'custom')),
  ADD COLUMN IF NOT EXISTS refund_policy_notes text;

-- RPC to increment promo uses atomically
CREATE OR REPLACE FUNCTION increment_promo_uses(promo_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE promo_codes SET uses = uses + 1 WHERE id = promo_id;
$$;
