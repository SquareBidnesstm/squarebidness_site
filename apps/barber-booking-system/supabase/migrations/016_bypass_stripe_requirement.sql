-- Allow platform admin to bypass the Stripe-required-for-booking gate
-- for shops that are onboarding or need manual override.
alter table public.shops
  add column if not exists bypass_stripe_requirement boolean not null default false;
