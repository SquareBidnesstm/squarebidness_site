-- Migration 004: Password reset tokens for organizers
alter table public.organizers
  add column if not exists reset_token text,
  add column if not exists reset_token_expires_at timestamptz;
