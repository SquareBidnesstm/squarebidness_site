-- Each barber gets their own Stripe connected account instead of one per shop.
alter table public.barbers
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false;
