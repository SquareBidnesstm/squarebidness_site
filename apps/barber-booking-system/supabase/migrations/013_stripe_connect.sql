-- Add Stripe Connect account fields to shops
-- stripe_account_id: the connected account (acct_xxx) created at onboard time
-- stripe_financial_account_id: Treasury FA (fa_xxx) created alongside it

alter table public.shops
  add column if not exists stripe_account_id text,
  add column if not exists stripe_financial_account_id text;
