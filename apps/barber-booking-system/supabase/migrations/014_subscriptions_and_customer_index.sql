-- ── subscriptions table ──────────────────────────────────────────────────────
-- Tracks each shop's billing plan and Stripe subscription state.
-- Referenced by billing/checkout, billing/portal, billing/webhook, and auth.ts.

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan            text not null default 'free',   -- 'free' | 'solo' | 'pro' | 'enterprise'
  status          text not null default 'free',   -- 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete'
  current_period_end     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint subscriptions_shop_id_unique unique (shop_id)
);

create index if not exists idx_subscriptions_shop_id
  on public.subscriptions(shop_id);

create index if not exists idx_subscriptions_stripe_customer_id
  on public.subscriptions(stripe_customer_id);

create index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions(stripe_subscription_id);

-- Keep updated_at current
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function set_updated_at();

-- ── idx_customers_shop_phone_unique ──────────────────────────────────────────
-- Required by the deposit confirm route's upsert on (shop_id, phone).
-- Without this index the upsert has no conflict target and throws a 400 error.

create unique index if not exists idx_customers_shop_phone_unique
  on public.customers(shop_id, phone)
  where phone is not null;
