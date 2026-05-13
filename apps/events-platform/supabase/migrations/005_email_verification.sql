-- Migration 005: Email verification for organizers
alter table public.organizers
  add column if not exists email_verified boolean not null default true,
  add column if not exists verification_token text;

-- Existing organizers stay verified; new ones will be set to false on signup
