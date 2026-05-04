-- Smash Courts Kuwait — atomic booking cancellation (Session 08)
-- Cancelling a confirmed booking has to flip its status AND release the slot
-- back to 'open' in one transaction. Doing it in two API calls would leave a
-- window where the booking is cancelled but the slot is still 'booked', which
-- the customer-facing slot grid would render as unavailable.

create or replace function public.cancel_booking(p_reference text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
     set status = 'cancelled'
   where reference = p_reference
     and status = 'confirmed'
   returning * into v_booking;

  if not found then
    -- Either no such reference, or already finalized. The API maps this
    -- to 404 / 409 respectively after looking the row up.
    raise exception 'booking_not_cancellable';
  end if;

  update public.slots
     set status = 'open'
   where id = v_booking.slot_id;

  return v_booking;
end;
$$;
