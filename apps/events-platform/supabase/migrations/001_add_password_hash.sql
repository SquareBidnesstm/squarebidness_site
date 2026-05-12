-- Migration 001: Add password_hash to organizers
-- Run in Supabase SQL Editor

alter table public.organizers
  add column if not exists password_hash text;
