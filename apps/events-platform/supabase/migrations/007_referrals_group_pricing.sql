-- Referral codes
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid REFERENCES organizers(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ref_code text;

-- Group / bulk pricing on ticket tiers
ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS group_min_qty integer;
ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS group_discount_pct numeric(5,2);
