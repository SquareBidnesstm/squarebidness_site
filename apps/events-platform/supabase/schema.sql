-- =========================================================
-- SQUARE BIDNESS EVENTS PLATFORM
-- events.squarebidness.com
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- ORGANIZERS
-- Self-serve organizer accounts with Stripe Connect
-- =========================================================
create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  email text not null unique,
  phone text,
  bio text,
  logo_url text,
  website text,

  -- Stripe Connect
  stripe_account_id text unique,
  stripe_onboarding_complete boolean not null default false,

  -- Admin fallback
  is_admin boolean not null default false,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- EVENTS
-- Core event record
-- =========================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  organizer_id uuid not null references public.organizers(id) on delete cascade,

  title text not null,
  description text,
  category text check (category in (
    'comedy', 'trail_ride', 'concert', 'meetup',
    'pop_up', 'community', 'sports', 'other'
  )),

  -- Location
  venue_name text,
  address text,
  city text,
  state text,
  zip text,
  location_notes text,

  -- Date & Time
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Chicago',

  -- Media
  cover_image_url text,

  -- Visibility
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
  is_public boolean not null default true,

  -- Capacity (total across all tiers)
  total_capacity integer check (total_capacity > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_event_time check (starts_at < ends_at)
);

-- =========================================================
-- TICKET TIERS
-- Multiple tiers per event (GA, VIP, Early Bird, etc.)
-- =========================================================
create table if not exists public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,

  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  quantity integer not null check (quantity > 0),
  quantity_sold integer not null default 0,

  -- Sale window
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,

  sort_order integer not null default 0,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_tier_sale_window check (
    sale_starts_at is null or sale_ends_at is null or sale_starts_at < sale_ends_at
  ),
  constraint quantity_sold_valid check (quantity_sold >= 0 and quantity_sold <= quantity)
);

-- =========================================================
-- ORDERS
-- One order per checkout session (can have multiple tickets)
-- =========================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  event_id uuid not null references public.events(id) on delete restrict,
  organizer_id uuid not null references public.organizers(id) on delete restrict,

  -- Buyer info
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,

  -- Financials
  subtotal numeric(10,2) not null check (subtotal >= 0),
  platform_fee numeric(10,2) not null default 0.00 check (platform_fee >= 0),
  total numeric(10,2) not null check (total >= 0),

  -- Stripe
  stripe_payment_intent_id text unique,
  stripe_session_id text unique,

  status text not null default 'pending'
    check (status in ('pending', 'completed', 'refunded', 'cancelled')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- TICKETS
-- One row per individual ticket issued
-- =========================================================
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  tier_id uuid not null references public.ticket_tiers(id) on delete restrict,

  -- Buyer snapshot
  buyer_name text not null,
  buyer_email text not null,

  -- Price snapshot at time of purchase
  price_snapshot numeric(10,2) not null check (price_snapshot >= 0),

  -- QR & Wallet
  qr_code text unique,
  apple_wallet_pass_url text,
  google_wallet_pass_url text,

  -- Status
  status text not null default 'valid'
    check (status in ('valid', 'checked_in', 'cancelled', 'refunded')),

  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CHECK INS
-- Door scan log per ticket
-- =========================================================
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  scanned_by text,
  scanned_at timestamptz not null default now(),
  device_info text
);

-- =========================================================
-- PLATFORM PAYOUTS
-- Track Square Bidness $1.00 fee collection per order
-- =========================================================
create table if not exists public.platform_payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  stripe_transfer_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================
create index if not exists idx_events_organizer_id on public.events(organizer_id);
create index if not exists idx_events_slug on public.events(slug);
create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_status on public.events(status);
create index if not exists idx_events_category on public.events(category);
create index if not exists idx_ticket_tiers_event_id on public.ticket_tiers(event_id);
create index if not exists idx_orders_event_id on public.orders(event_id);
create index if not exists idx_orders_organizer_id on public.orders(organizer_id);
create index if not exists idx_orders_buyer_email on public.orders(buyer_email);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_tickets_order_id on public.tickets(order_id);
create index if not exists idx_tickets_event_id on public.tickets(event_id);
create index if not exists idx_tickets_tier_id on public.tickets(tier_id);
create index if not exists idx_tickets_ticket_code on public.tickets(ticket_code);
create index if not exists idx_tickets_qr_code on public.tickets(qr_code);
create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_check_ins_ticket_id on public.check_ins(ticket_id);
create index if not exists idx_check_ins_event_id on public.check_ins(event_id);

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organizers_updated_at on public.organizers;
create trigger trg_organizers_updated_at
before update on public.organizers
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_ticket_tiers_updated_at on public.ticket_tiers;
create trigger trg_ticket_tiers_updated_at
before update on public.ticket_tiers
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- =========================================================
-- ORDER CODE GENERATOR
-- Example: SBE-20260512-A1B2
-- =========================================================
create or replace function public.generate_order_code()
returns text
language plpgsql
as $$
declare
  random_part text;
begin
  random_part := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  return 'SBE-' || to_char(now(), 'YYYYMMDD') || '-' || random_part;
end;
$$;

-- =========================================================
-- TICKET CODE GENERATOR
-- Example: TKT-A1B2C3D4
-- =========================================================
create or replace function public.generate_ticket_code()
returns text
language plpgsql
as $$
begin
  return 'TKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$;

-- =========================================================
-- AUTO-INCREMENT quantity_sold ON TICKET INSERT
-- =========================================================
create or replace function public.increment_tier_quantity_sold()
returns trigger
language plpgsql
as $$
begin
  update public.ticket_tiers
  set quantity_sold = quantity_sold + 1
  where id = new.tier_id;
  return new;
end;
$$;

drop trigger if exists trg_increment_quantity_sold on public.tickets;
create trigger trg_increment_quantity_sold
after insert on public.tickets
for each row execute function public.increment_tier_quantity_sold();

-- =========================================================
-- AUTO-DECREMENT quantity_sold ON TICKET CANCEL/REFUND
-- =========================================================
create or replace function public.decrement_tier_quantity_sold()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('cancelled', 'refunded') and old.status = 'valid' then
    update public.ticket_tiers
    set quantity_sold = greatest(quantity_sold - 1, 0)
    where id = new.tier_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_decrement_quantity_sold on public.tickets;
create trigger trg_decrement_quantity_sold
after update on public.tickets
for each row execute function public.decrement_tier_quantity_sold();
