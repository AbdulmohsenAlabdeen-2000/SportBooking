-- 011_declined_status.sql
-- Distinguish "payment never succeeded" from "was paid then cancelled".
--
-- Before: pending_payment → cancelled when MyFatoorah declined a card.
-- That made declined attempts look like real cancellations in /me, in
-- the admin bookings list, and in stats — they're not. They're abandoned
-- attempts that should be invisible to both sides.
--
-- After: pending_payment → declined when payment fails. Reserved for
-- "the customer never paid". Cancelled stays for "was paid, then someone
-- cancelled and got refunded".

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'bookings_status_check'
  ) then
    alter table bookings drop constraint bookings_status_check;
  end if;
end$$;

alter table bookings
  add constraint bookings_status_check
  check (status in (
    'pending_payment',
    'confirmed',
    'completed',
    'cancelled',
    'declined'
  ));
