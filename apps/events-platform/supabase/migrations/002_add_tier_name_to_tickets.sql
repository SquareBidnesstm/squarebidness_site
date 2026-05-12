-- Migration 002: Add tier_name snapshot to tickets
alter table public.tickets
  add column if not exists tier_name text;
