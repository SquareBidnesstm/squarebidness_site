-- SB Network schema
-- Run this in your Supabase SQL editor to create the network tables

create type network_category as enum (
  'community', 'business', 'culture', 'health', 'events', 'technology'
);

-- Shows (series / recurring programs)
create table if not exists network_shows (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text not null default '',
  category      network_category not null default 'community',
  cover_image   text,
  episode_count integer not null default 0,
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Episodes
create table if not exists network_episodes (
  id              uuid primary key default gen_random_uuid(),
  show_id         uuid not null references network_shows(id) on delete cascade,
  slug            text unique not null,
  title           text not null,
  description     text not null default '',
  thumbnail       text,
  video_url       text,
  duration_seconds integer,
  episode_number  integer not null default 1,
  published       boolean not null default false,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Articles / editorial
create table if not exists network_articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text not null default '',
  body         text not null default '',
  cover_image  text,
  category     network_category not null default 'community',
  author       text not null default 'SB Network',
  published    boolean not null default false,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-update episode_count on shows when episodes change
create or replace function sync_episode_count()
returns trigger language plpgsql as $$
begin
  update network_shows
  set episode_count = (
    select count(*) from network_episodes
    where show_id = coalesce(new.show_id, old.show_id)
    and published = true
  )
  where id = coalesce(new.show_id, old.show_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_episode_count on network_episodes;
create trigger trg_episode_count
after insert or update or delete on network_episodes
for each row execute function sync_episode_count();

-- RLS: public read on published content
alter table network_shows enable row level security;
alter table network_episodes enable row level security;
alter table network_articles enable row level security;

create policy "public can read published shows"
  on network_shows for select using (published = true);

create policy "public can read published episodes"
  on network_episodes for select using (published = true);

create policy "public can read published articles"
  on network_articles for select using (published = true);

-- Service role bypasses RLS (used by server-side queries)
