-- Migration 018: Enable RLS on all public tables
-- All API access goes through service_role (Next.js server routes), so
-- service_role_all policies preserve existing behavior while blocking
-- unauthenticated direct access to the database.

alter table public.shops enable row level security;
create policy "service_role_all" on public.shops
  for all to service_role using (true) with check (true);

alter table public.barbers enable row level security;
create policy "service_role_all" on public.barbers
  for all to service_role using (true) with check (true);

alter table public.services enable row level security;
create policy "service_role_all" on public.services
  for all to service_role using (true) with check (true);

alter table public.barber_services enable row level security;
create policy "service_role_all" on public.barber_services
  for all to service_role using (true) with check (true);

alter table public.shop_hours enable row level security;
create policy "service_role_all" on public.shop_hours
  for all to service_role using (true) with check (true);

alter table public.barber_hours enable row level security;
create policy "service_role_all" on public.barber_hours
  for all to service_role using (true) with check (true);

alter table public.blocked_times enable row level security;
create policy "service_role_all" on public.blocked_times
  for all to service_role using (true) with check (true);

alter table public.customers enable row level security;
create policy "service_role_all" on public.customers
  for all to service_role using (true) with check (true);

alter table public.bookings enable row level security;
create policy "service_role_all" on public.bookings
  for all to service_role using (true) with check (true);

alter table public.payments enable row level security;
create policy "service_role_all" on public.payments
  for all to service_role using (true) with check (true);

alter table public.shop_settings enable row level security;
create policy "service_role_all" on public.shop_settings
  for all to service_role using (true) with check (true);

alter table public.sms_opt_outs enable row level security;
create policy "service_role_all" on public.sms_opt_outs
  for all to service_role using (true) with check (true);
