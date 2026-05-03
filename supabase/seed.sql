-- Smash Courts Kuwait — seed data
-- Inserts the 4 fixed courts and generates 14 days × 15 slots per court,
-- starting from today in Asia/Kuwait. Idempotent: safe to re-run.

-- Courts ---------------------------------------------------------------------
insert into public.courts (name, sport, description, capacity, price_per_slot, slot_duration_minutes, image_url)
values
  ('Padel Court 1', 'padel',    'Outdoor padel court with panoramic glass walls.', 4,  8.000, 60, null),
  ('Padel Court 2', 'padel',    'Covered padel court with LED lighting.',          4,  8.000, 60, null),
  ('Tennis Court',  'tennis',   'Hard-surface tennis court, ITF-spec lighting.',   4,  6.000, 60, null),
  ('Football Pitch','football', '5-a-side artificial turf, full perimeter netting.',10, 15.000, 60, null)
on conflict (name) do nothing;

-- Slots ---------------------------------------------------------------------
-- 8:00 → 22:00 starts (15 starts/day) Asia/Kuwait, for 14 days starting today.
-- Stored as timestamptz in UTC; the date math is done in Asia/Kuwait so DST and
-- offset edge cases never bite us (Kuwait is UTC+3 with no DST).
insert into public.slots (court_id, start_time, end_time, status)
select
  c.id,
  ((d::date + (h || ' hours')::interval) at time zone 'Asia/Kuwait')                as start_time,
  ((d::date + ((h + 1) || ' hours')::interval) at time zone 'Asia/Kuwait')          as end_time,
  'open'                                                                            as status
from public.courts c
cross join generate_series(
  (now() at time zone 'Asia/Kuwait')::date,
  ((now() at time zone 'Asia/Kuwait')::date + interval '13 days')::date,
  interval '1 day'
) as d
cross join generate_series(8, 22) as h
on conflict (court_id, start_time) do nothing;
