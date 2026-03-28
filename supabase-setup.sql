-- ══ vintercom database setup ══
-- Run this in the Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────
-- 1. meeting_rooms: defines valid rooms and caller passwords
-- ─────────────────────────────────────────────────────────
create table if not exists meeting_rooms (
  room_name       text primary key,      -- human-readable key entered by users, e.g. "home"
  password        text not null,         -- callers must provide this to start a video call
  daily_room_name text not null,         -- Daily.co room name (from your Daily dashboard)
  created_at      timestamptz not null default now()
);

-- Add rooms manually via the Supabase Table Editor or SQL, e.g.:
-- insert into meeting_rooms (room_name, password, daily_room_name)
-- values ('home', 'your-password', 'your-daily-room-name');

-- ─────────────────────────────────────────────────────────
-- 2. room_presence: per-room live participant tracking
--    id = meeting_rooms.room_name
-- ─────────────────────────────────────────────────────────
create table if not exists room_presence (
  id           text primary key,            -- = meeting_rooms.room_name
  participants integer not null default 0,
  initials     jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Enable Realtime on this table
alter publication supabase_realtime add table room_presence;

-- ─────────────────────────────────────────────────────────
-- 3. Stored functions
-- ─────────────────────────────────────────────────────────

-- Add a participant (upserts the presence row so no manual seeding required)
create or replace function add_participant(p_room text, p_initial text)
returns void language plpgsql as $$
begin
  insert into room_presence (id, participants, initials)
  values (p_room, 1, jsonb_build_array(p_initial))
  on conflict (id) do update
  set participants = room_presence.participants + 1,
      initials     = room_presence.initials || jsonb_build_array(p_initial),
      updated_at   = now();
end;
$$;

-- Remove a participant, dropping the first matching initial
create or replace function remove_participant(p_room text, p_initial text)
returns void language plpgsql as $$
declare
  arr jsonb;
  idx int;
begin
  select initials into arr from room_presence where id = p_room;
  if arr is null then return; end if;

  select ordinality - 1 into idx
  from jsonb_array_elements_text(arr) with ordinality
  where value = p_initial
  limit 1;

  if idx is not null then
    update room_presence
    set participants = greatest(participants - 1, 0),
        initials     = arr - idx,
        updated_at   = now()
    where id = p_room;
  else
    update room_presence
    set participants = greatest(participants - 1, 0),
        updated_at   = now()
    where id = p_room;
  end if;
end;
$$;

-- Helper to reset a room to zero (useful if things get out of sync)
create or replace function reset_participants(p_room text)
returns void language sql as $$
  update room_presence
  set participants = 0,
      initials     = '[]'::jsonb,
      updated_at   = now()
  where id = p_room;
$$;
