-- Run this in Supabase Dashboard → SQL Editor

-- Single-row presence table for the kiosk room
create table if not exists room_presence (
  id          text primary key default 'mom',
  participants integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- Seed the single row
insert into room_presence (id, participants)
values ('mom', 0)
on conflict (id) do nothing;

-- Enable Realtime on this table
alter publication supabase_realtime add table room_presence;

-- Atomic increment (never goes below 0)
create or replace function increment_participants()
returns void language sql as $$
  update room_presence
  set participants = greatest(participants + 1, 0),
      updated_at   = now()
  where id = 'mom';
$$;

-- Atomic decrement (never goes below 0)
create or replace function decrement_participants()
returns void language sql as $$
  update room_presence
  set participants = greatest(participants - 1, 0),
      updated_at   = now()
  where id = 'mom';
$$;

-- Helper to reset to zero (useful if things get out of sync)
create or replace function reset_participants()
returns void language sql as $$
  update room_presence
  set participants = 0,
      updated_at   = now()
  where id = 'mom';
$$;
