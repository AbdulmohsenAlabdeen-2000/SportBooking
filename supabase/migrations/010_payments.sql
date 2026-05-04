-- 010_payments.sql
-- MyFatoorah payment integration. Bookings now move through a payment
-- lifecycle before becoming confirmed:
--
--   pending_payment  → waiting for the customer to complete payment on
--                      the MyFatoorah hosted page. Slot is reserved.
--   confirmed        → MyFatoorah webhook reported success, slot stays
--                      booked, SMS confirmation goes out.
--   completed        → unchanged
--   cancelled        → either customer cancelled (refunded) or payment
--                      failed/timed out (slot released).
--
-- Existing rows keep their current `confirmed` status. New bookings
-- start as `pending_payment` and only transition to `confirmed` after
-- the webhook fires.

-- 1. Widen the status check to include the new state.
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
  check (status in ('pending_payment', 'confirmed', 'completed', 'cancelled'));

-- 2. Payment-tracking columns. Nullable on existing rows; new rows
-- always populate the invoice + payment fields.
alter table bookings
  add column if not exists payment_invoice_id text,
  add column if not exists payment_id text,
  add column if not exists payment_url text,
  add column if not exists paid_at timestamptz,
  add column if not exists refund_id text,
  add column if not exists refunded_at timestamptz;

-- Lookup index for the webhook (it arrives with the invoice id).
create index if not exists bookings_payment_invoice_id_idx
  on bookings (payment_invoice_id);

-- 3. Cleanup helper: which bookings are stuck in pending_payment
-- past their TTL? The cleanup cron uses this index.
create index if not exists bookings_pending_payment_idx
  on bookings (created_at)
  where status = 'pending_payment';
