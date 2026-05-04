-- 008_booking_reminders.sql
-- Per-booking state for the daily reminder SMS:
--   reminded_at  — set once we've attempted the reminder; cron skips
--                  rows where this is non-null (single-shot dedupe).
--   locale       — captured at booking time so the reminder is sent in
--                  the same language the customer just saw on screen.
--                  Defaults to 'en' for legacy rows.

alter table bookings
  add column if not exists reminded_at timestamptz;

alter table bookings
  add column if not exists locale text not null default 'en';

-- Constrain locale to supported values. `not valid` lets the migration
-- run on databases with rows already inserted before this column existed
-- (those rows take the default 'en' which satisfies the check).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_locale_check'
  ) then
    alter table bookings
      add constraint bookings_locale_check check (locale in ('en', 'ar'));
  end if;
end$$;

-- Partial index so the cron's "find unreminded confirmed bookings" scan
-- doesn't have to walk the whole table every hour.
create index if not exists bookings_unreminded_idx
  on bookings (reminded_at)
  where reminded_at is null;
