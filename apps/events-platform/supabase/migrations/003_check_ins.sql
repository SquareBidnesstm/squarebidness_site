-- Migration 003: Check-in support

-- Add checked_in_at to tickets
alter table public.tickets
  add column if not exists checked_in_at timestamptz;

-- Check-ins audit log
create table if not exists public.check_ins (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid references public.tickets(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

grant all on public.check_ins to service_role;
