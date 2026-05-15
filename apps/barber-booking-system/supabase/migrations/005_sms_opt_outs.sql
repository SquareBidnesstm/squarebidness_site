-- SMS opt-out tracking
-- Phone numbers that have texted STOP to our Twilio number/service.
-- Opt-out is global (not per-shop) because Twilio STOP applies to the sender number,
-- not a specific shop.

CREATE TABLE IF NOT EXISTS sms_opt_outs (
  phone       text        PRIMARY KEY,        -- E.164 normalized, e.g. +15551234567
  opted_out   boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sms_opt_outs IS
  'Tracks phones that have opted out of SMS (via STOP) or back in (via UNSTOP/START).';
