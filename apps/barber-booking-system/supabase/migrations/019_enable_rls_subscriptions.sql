-- Migration 019: Enable RLS on subscriptions table
-- Added in migration 014 but omitted from 018_enable_rls.
-- All access goes through service_role (Next.js server routes).

alter table public.subscriptions enable row level security;
create policy "service_role_all" on public.subscriptions
  for all to service_role using (true) with check (true);
