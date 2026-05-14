CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid REFERENCES orders(id) ON DELETE CASCADE,
  event_id   uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_event_id_idx ON push_subscriptions(event_id);
