-- Track whether the shop's Stripe Connect account has completed identity verification.
-- Set true when payouts_enabled=true on the Stripe account (via return URL or webhook).
alter table public.shops
  add column if not exists stripe_onboarding_complete boolean not null default false;
