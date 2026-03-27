-- Run this in Supabase Dashboard → SQL Editor

-- Single-row presence table for the kiosk room
create table if not exists room_presence (
  id           text primary key default 'kiosk',
  room_name    text not null default 'default',
  participants integer not null default 0,
  initials     jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Seed the single row
insert into room_presence (id, room_name, participants, initials)
values ('kiosk', 'default', 0, '[]'::jsonb)
on conflict (id) do nothing;

-- Enable Realtime on this table
alter publication supabase_realtime add table room_presence;

-- Add a participant with their initial
create or replace function add_participant(p_initial text)
returns void language sql as $$
  update room_presence
  set participants = participants + 1,
      initials     = initials || jsonb_build_array(p_initial),
      updated_at   = now()
  where id = 'kiosk';
$$;

-- Remove a participant, dropping the first matching initial
create or replace function remove_participant(p_initial text)
returns void language plpgsql as $$
declare
  arr jsonb;
  idx int;
begin
  select initials into arr from room_presence where id = 'kiosk';

  select ordinality - 1 into idx
  from jsonb_array_elements_text(arr) with ordinality
  where value = p_initial
  limit 1;

  if idx is not null then
    update room_presence
    set participants = greatest(participants - 1, 0),
        initials     = arr - idx,
        updated_at   = now()
    where id = 'kiosk';
  else
    update room_presence
    set participants = greatest(participants - 1, 0),
        updated_at   = now()
    where id = 'kiosk';
  end if;
end;
$$;

-- Helper to reset to zero (useful if things get out of sync)
create or replace function reset_participants()
returns void language sql as $$
  update room_presence
  set participants = 0,
      initials     = '[]'::jsonb,
      updated_at   = now()
  where id = 'kiosk';
$$;
