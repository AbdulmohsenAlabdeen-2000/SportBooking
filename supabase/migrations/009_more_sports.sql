-- 009_more_sports.sql
-- Widen the courts.sport CHECK constraint to cover sports common in
-- Kuwait beyond the original three. The column stays text — we just
-- replace the constraint, no data migration needed.

alter table courts drop constraint if exists courts_sport_check;

alter table courts
  add constraint courts_sport_check
  check (sport in (
    'padel',
    'tennis',
    'football',
    'squash',
    'basketball',
    'volleyball',
    'cricket',
    'pickleball',
    'badminton',
    'futsal'
  ));
