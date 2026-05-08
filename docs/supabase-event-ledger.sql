create table if not exists public.event_ledger (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  system text not null,
  event_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'squarebidness_site',
  created_at timestamptz not null default now()
);

create index if not exists event_ledger_brand_system_created_at_idx
  on public.event_ledger (brand, system, created_at desc);

create index if not exists event_ledger_event_type_created_at_idx
  on public.event_ledger (event_type, created_at desc);

create index if not exists event_ledger_entity_id_idx
  on public.event_ledger (entity_id);

alter table public.event_ledger enable row level security;
