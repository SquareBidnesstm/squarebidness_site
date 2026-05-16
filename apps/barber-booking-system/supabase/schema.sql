-- =========================================================
-- BARBER BOOKING SYSTEM
-- PRODUCTION STARTER SCHEMA — reflects migrations 001-006
-- Shared-account multi-barber shop model
-- =========================================================

-- Optional extension
create extension if not exists pgcrypto;
-- Required for no-overlap exclusion constraint (003)
create extension if not exists btree_gist;

-- =========================================================
-- SHOPS
-- One shop owns the account and manages multiple barbers
-- =========================================================
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_name text,
  manager_title text,
  city text,
  state text,
  timezone text not null default 'America/Chicago',
  booking_base_path text default '/book',
  require_deposit boolean not null default false,
  logo_url text,              -- 004
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- BARBERS
-- Each barber belongs to one shop
-- =========================================================
create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  slug text not null,
  name text not null,
  display_name text,
  role text,
  phone text,
  email text,
  bio text,
  photo_url text,             -- 004
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_barber_slug_per_shop unique (shop_id, slug)
);

-- =========================================================
-- SERVICES
-- Shop can define services once and allow barber assignment later
-- =========================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10,2) not null check (price >= 0),
  deposit_eligible boolean not null default false,
  deposit_amount numeric(10,2),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_service_slug_per_shop unique (shop_id, slug),
  constraint valid_deposit_amount check (
    deposit_amount is null or deposit_amount >= 0
  )
);

-- =========================================================
-- BARBER-SERVICE ASSIGNMENTS
-- Lets you control which barber offers which service
-- =========================================================
create table if not exists public.barber_services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint unique_barber_service unique (barber_id, service_id)
);

-- =========================================================
-- SHOP HOURS
-- Day-level business hours for the shop
-- day_of_week: 0=Sunday, 1=Monday ... 6=Saturday
-- =========================================================
create table if not exists public.shop_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_shop_day unique (shop_id, day_of_week),
  constraint valid_shop_hours check (
    (is_closed = true and open_time is null and close_time is null)
    or
    (is_closed = false and open_time is not null and close_time is not null and open_time < close_time)
  )
);

-- =========================================================
-- BARBER HOURS
-- Optional override if a barber has custom schedule
-- =========================================================
create table if not exists public.barber_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_barber_day unique (barber_id, day_of_week),
  constraint valid_barber_hours check (
    (is_closed = true and open_time is null and close_time is null)
    or
    (is_closed = false and open_time is not null and close_time is not null and open_time < close_time)
  )
);

-- =========================================================
-- BLOCKED TIMES
-- Manual blocks for barber vacations, breaks, custom blackouts, etc.
-- =========================================================
create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  title text,
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint valid_blocked_time check (starts_at < ends_at)
);

-- =========================================================
-- CUSTOMERS
-- Reusable client records across repeat bookings
-- =========================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- BOOKINGS
-- Core appointment record
-- =========================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  shop_id uuid not null references public.shops(id) on delete cascade,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,

  customer_name text not null,
  customer_phone text,
  customer_email text,

  appointment_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  price_snapshot numeric(10,2) not null check (price_snapshot >= 0),
  duration_snapshot_minutes integer not null check (duration_snapshot_minutes > 0),

  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),

  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'deposit_paid', 'paid', 'refunded', 'refund_failed')),

  source text default 'shop_booking_page',
  internal_notes text,
  client_notes text,

  reminder_sent_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,

  -- Cancellation tracking (001)
  cancel_token uuid default gen_random_uuid() unique,
  cancelled_by text check (cancelled_by in ('admin', 'client', 'system')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_booking_time check (starts_at < ends_at),

  -- No-overlap: prevents double-booking at DB level (003)
  -- Requires btree_gist extension
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

-- =========================================================
-- PAYMENTS
-- Stripe / cash / card / deposit tracking
-- =========================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  payment_type text not null
    check (payment_type in ('deposit', 'full', 'balance', 'refund')),
  provider text not null default 'manual'
    check (provider in ('manual', 'stripe', 'square', 'cashapp', 'cash', 'check', 'zelle', 'venmo', 'other')),
  provider_payment_id text,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- SHOP SETTINGS
-- Flexible config without changing schema every time
-- =========================================================
create table if not exists public.shop_settings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_shop_setting_key unique (shop_id, key)
);

-- =========================================================
-- PUSH SUBSCRIPTIONS (002)
-- Web Push subscriptions for barber + admin notifications
-- =========================================================
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid references public.barbers(id) on delete cascade,
  shop_id    uuid references public.shops(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique(barber_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
create policy if not exists "service_role_all" on public.push_subscriptions
  for all to service_role using (true) with check (true);

-- =========================================================
-- SMS OPT-OUTS (005)
-- Global STOP/UNSTOP tracking for Twilio compliance
-- =========================================================
create table if not exists public.sms_opt_outs (
  phone      text primary key,  -- E.164 e.g. +15551234567
  opted_out  boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.sms_opt_outs is
  'Tracks phones that have opted out (STOP) or back in (UNSTOP/START). '
  'Opt-out is global, not per-shop, because Twilio applies STOP to the sender number.';

-- =========================================================
-- INDEXES
-- =========================================================
create index if not exists idx_barbers_shop_id on public.barbers(shop_id);
create index if not exists idx_services_shop_id on public.services(shop_id);
create index if not exists idx_barber_services_barber_id on public.barber_services(barber_id);
create index if not exists idx_shop_hours_shop_id on public.shop_hours(shop_id);
create index if not exists idx_barber_hours_barber_id on public.barber_hours(barber_id);
create index if not exists idx_blocked_times_shop_id on public.blocked_times(shop_id);
create index if not exists idx_blocked_times_barber_id on public.blocked_times(barber_id);
create index if not exists idx_blocked_times_starts_at on public.blocked_times(starts_at);
create index if not exists idx_customers_shop_id on public.customers(shop_id);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_email on public.customers(email);
create index if not exists idx_bookings_shop_id on public.bookings(shop_id);
create index if not exists idx_bookings_barber_id on public.bookings(barber_id);
create index if not exists idx_bookings_service_id on public.bookings(service_id);
create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_bookings_appointment_date on public.bookings(appointment_date);
create index if not exists idx_bookings_starts_at on public.bookings(starts_at);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_payment_status on public.bookings(payment_status);
create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_shop_settings_shop_id on public.shop_settings(shop_id);
create index if not exists idx_push_subscriptions_barber_id on public.push_subscriptions(barber_id);
create index if not exists idx_push_subscriptions_shop_id on public.push_subscriptions(shop_id);
create index if not exists idx_bookings_cancel_token on public.bookings(cancel_token);

-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
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

-- =========================================================
-- APPLY UPDATED_AT TRIGGERS
-- =========================================================
drop trigger if exists trg_shops_updated_at on public.shops;
create trigger trg_shops_updated_at
before update on public.shops
for each row execute function public.set_updated_at();

drop trigger if exists trg_barbers_updated_at on public.barbers;
create trigger trg_barbers_updated_at
before update on public.barbers
for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists trg_shop_hours_updated_at on public.shop_hours;
create trigger trg_shop_hours_updated_at
before update on public.shop_hours
for each row execute function public.set_updated_at();

drop trigger if exists trg_barber_hours_updated_at on public.barber_hours;
create trigger trg_barber_hours_updated_at
before update on public.barber_hours
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists trg_shop_settings_updated_at on public.shop_settings;
create trigger trg_shop_settings_updated_at
before update on public.shop_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- BOOKING CODE GENERATOR
-- Example: DL-20260417-1A2B
-- =========================================================
create or replace function public.generate_booking_code(shop_slug text)
returns text
language plpgsql
as $$
declare
  cleaned_slug text;
  random_part text;
begin
  cleaned_slug := upper(left(regexp_replace(shop_slug, '[^a-zA-Z0-9]', '', 'g'), 2));
  if cleaned_slug = '' then
    cleaned_slug := 'BK';
  end if;

  random_part := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  return cleaned_slug || '-' || to_char(now(), 'YYYYMMDD') || '-' || random_part;
end;
$$;
