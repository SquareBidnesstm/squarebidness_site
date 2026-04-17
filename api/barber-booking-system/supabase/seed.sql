-- =========================================================
-- BARBER BOOKING SYSTEM SEED
-- DAPPER LOUNGE
-- =========================================================

-- SHOP
insert into public.shops (
  slug,
  name,
  owner_name,
  manager_title,
  city,
  state,
  timezone,
  booking_base_path,
  require_deposit,
  active
)
values (
  'dapper-lounge',
  'Dapper Lounge',
  'Josh Watkins',
  'Head Barber In Charge',
  'Orlando',
  'FL',
  'America/New_York',
  '/book',
  false,
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  owner_name = excluded.owner_name,
  manager_title = excluded.manager_title,
  city = excluded.city,
  state = excluded.state,
  timezone = excluded.timezone,
  booking_base_path = excluded.booking_base_path,
  require_deposit = excluded.require_deposit,
  active = excluded.active;

-- BARBERS
insert into public.barbers (shop_id, slug, name, display_name, role, active, sort_order)
select s.id, 'josh', 'Josh Watkins', 'Josh Watkins', 'Head Barber', true, 1
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  display_name = excluded.display_name,
  role = excluded.role,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.barbers (shop_id, slug, name, display_name, role, active, sort_order)
select s.id, 'jj', 'Jeramiah', 'Jeramiah (J.J.)', 'Barber', true, 2
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  display_name = excluded.display_name,
  role = excluded.role,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.barbers (shop_id, slug, name, display_name, role, active, sort_order)
select s.id, 'jmike', 'J-Mike', 'J-Mike', 'Barber', true, 3
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  display_name = excluded.display_name,
  role = excluded.role,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- SERVICES
insert into public.services (shop_id, slug, name, duration_minutes, price, deposit_eligible, active, sort_order)
select s.id, 'haircut', 'Haircut', 45, 35.00, false, true, 1
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  deposit_eligible = excluded.deposit_eligible,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.services (shop_id, slug, name, duration_minutes, price, deposit_eligible, active, sort_order)
select s.id, 'haircut-beard', 'Haircut + Beard', 60, 45.00, false, true, 2
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  deposit_eligible = excluded.deposit_eligible,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.services (shop_id, slug, name, duration_minutes, price, deposit_eligible, active, sort_order)
select s.id, 'kids-cut', 'Kids Cut', 30, 25.00, false, true, 3
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  deposit_eligible = excluded.deposit_eligible,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.services (shop_id, slug, name, duration_minutes, price, deposit_eligible, active, sort_order)
select s.id, 'enhancements', 'Cut + Enhancements', 60, 50.00, false, true, 4
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  deposit_eligible = excluded.deposit_eligible,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.services (shop_id, slug, name, duration_minutes, price, deposit_eligible, deposit_amount, active, sort_order)
select s.id, 'vip', 'VIP Appointment', 90, 75.00, true, 25.00, true, 5
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, slug) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price = excluded.price,
  deposit_eligible = excluded.deposit_eligible,
  deposit_amount = excluded.deposit_amount,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- ASSIGN ALL SERVICES TO ALL BARBERS
insert into public.barber_services (shop_id, barber_id, service_id, active)
select
  b.shop_id,
  b.id,
  sv.id,
  true
from public.barbers b
join public.services sv on sv.shop_id = b.shop_id
join public.shops s on s.id = b.shop_id
where s.slug = 'dapper-lounge'
on conflict (barber_id, service_id) do nothing;

-- SHOP HOURS
insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 0, true, null, null
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 1, false, '09:00', '18:00'
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 2, false, '09:00', '18:00'
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 3, false, '09:00', '18:00'
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 4, false, '09:00', '18:00'
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 5, false, '09:00', '19:00'
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

insert into public.shop_hours (shop_id, day_of_week, is_closed, open_time, close_time)
select s.id, 6, false, '08:00', '16:00'
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, day_of_week) do update
set
  is_closed = excluded.is_closed,
  open_time = excluded.open_time,
  close_time = excluded.close_time;

-- SHOP SETTINGS
insert into public.shop_settings (shop_id, key, value_json)
select s.id, 'booking_rules', '{"slot_interval_minutes": 30, "lead_time_minutes": 0, "max_days_out": 30}'::jsonb
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, key) do update
set value_json = excluded.value_json;

insert into public.shop_settings (shop_id, key, value_json)
select s.id, 'notifications', '{"sms_enabled": false, "email_enabled": false}'::jsonb
from public.shops s
where s.slug = 'dapper-lounge'
on conflict (shop_id, key) do update
set value_json = excluded.value_json;
