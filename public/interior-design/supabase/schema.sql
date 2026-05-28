-- interior_design_consultations
-- Run in the Supabase SQL Editor (events project: uwgssnrbeisdqdknpscu)

create table if not exists interior_design_consultations (
  id                     bigint generated always as identity primary key,
  name                   text        not null,
  phone                  text        not null,
  email                  text,
  city                   text,
  project_type           text,
  property_type          text,
  preferred_timeline     text,
  estimated_budget       text,
  address                text,
  project_details        text,
  referrer               text,
  photo_link             text,
  ready_for_consultation boolean     not null default false,
  interested_in_deposit  boolean     not null default false,
  sms_ok                 boolean     not null default false,
  status                 text        not null default 'new',
  created_at             timestamptz not null default now()
);
