-- Migration 007: Fix payments table constraints to match app usage
-- The collect-balance API endpoint writes:
--   payment_type = 'balance'   (not in original constraint)
--   provider = 'cash' | 'check' | 'zelle' | 'venmo' | 'other'
--   (original provider constraint only had 'manual', 'stripe', 'square', 'cashapp', 'other')

-- payment_type: add 'balance'
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_type_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('deposit', 'full', 'balance', 'refund'));

-- provider: add in-person payment methods
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_provider_check
  CHECK (provider IN (
    'manual', 'stripe', 'square', 'cashapp',
    'cash', 'check', 'zelle', 'venmo', 'other'
  ));
