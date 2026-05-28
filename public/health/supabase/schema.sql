-- Square Bidness Health — Supabase Schema
-- Run in the events Supabase project (uwgssnrbeisdqdknpscu)

-- CNA Float Pool Applications
create table if not exists health_cna_applications (
  id               bigint generated always as identity primary key,
  full_name        text        not null,
  phone            text        not null,
  email            text,
  city             text,
  cert_number      text,
  cert_expiry      text,
  experience       text,
  availability     text,
  travel_range     text,
  preferred_shift  text,
  facility_types   text,
  notes            text,
  sms_ok           boolean     not null default false,
  status           text        not null default 'new',
  created_at       timestamptz not null default now()
);

-- Facility Staffing Inquiries
create table if not exists health_facility_inquiries (
  id               bigint generated always as identity primary key,
  facility_name    text        not null,
  contact_name     text        not null,
  title            text,
  phone            text        not null,
  email            text,
  facility_type    text,
  parish           text,
  shifts_needed    text,
  urgency          text,
  notes            text,
  status           text        not null default 'new',
  created_at       timestamptz not null default now()
);
