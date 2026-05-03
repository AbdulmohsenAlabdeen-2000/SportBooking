-- Smash Courts Kuwait — initial schema (Session 01)
-- Run in the Supabase SQL editor, or via the Supabase CLI.

create extension if not exists "pgcrypto";

-- Courts ----------------------------------------------------------------------
create table if not exists public.courts (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  sport                 text not null check (sport in ('padel', 'tennis', 'football')),
  description           text,
  capacity              integer not null check (capacity > 0),
  price_per_slot        numeric(10, 3) not null check (price_per_slot >= 0),
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes > 0),
  is_active             boolean not null default true,
  image_url             text,
  created_at            timestamptz not null default now()
);

-- Slots -----------------------------------------------------------------------
create table if not exists public.slots (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid not null references public.courts(id) on delete cascade,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  status     text not null default 'open' check (status in ('open', 'closed', 'booked')),
  unique (court_id, start_time)
);

create index if not exists idx_slots_court_start on public.slots (court_id, start_time);

-- Bookings --------------------------------------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  court_id        uuid not null references public.courts(id),
  slot_id         uuid not null references public.slots(id),
  customer_name   text not null,
  customer_phone  text not null,
  customer_email  text,
  notes           text,
  total_price     numeric(10, 3) not null check (total_price >= 0),
  status          text not null default 'confirmed'
                  check (status in ('confirmed', 'completed', 'cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_bookings_created on public.bookings (created_at desc);
create index if not exists idx_bookings_slot    on public.bookings (slot_id);

-- Row-level security ---------------------------------------------------------
-- Public read on courts and slots, no public access on bookings (server-side
-- only, via the service role key which bypasses RLS).
alter table public.courts   enable row level security;
alter table public.slots    enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "public read courts" on public.courts;
drop policy if exists "public read slots"  on public.slots;

create policy "public read courts" on public.courts for select using (true);
create policy "public read slots"  on public.slots  for select using (true);
-- bookings: no policies = no public access.

-- Atomic booking function ----------------------------------------------------
-- Locks the slot row, verifies it is still open, marks it booked, and inserts
-- the booking — all in one transaction. Concurrent attempts on the same slot
-- get serialized by the row lock; the loser raises 'slot_not_available'.
create or replace function public.create_booking(
  p_slot_id   uuid,
  p_court_id  uuid,
  p_name      text,
  p_phone     text,
  p_email     text,
  p_notes     text,
  p_price     numeric,
  p_reference text
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_updated integer;
begin
  update public.slots
     set status = 'booked'
   where id = p_slot_id
     and status = 'open';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'slot_not_available';
  end if;

  insert into public.bookings (
    reference, court_id, slot_id,
    customer_name, customer_phone, customer_email,
    notes, total_price
  )
  values (
    p_reference, p_court_id, p_slot_id,
    p_name, p_phone, p_email,
    p_notes, p_price
  )
  returning * into v_booking;

  return v_booking;
end;
$$;
