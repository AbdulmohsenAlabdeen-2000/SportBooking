-- Smash Courts Kuwait — schema
-- Run in the Supabase SQL editor (or via `supabase db reset` if using local CLI).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- courts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.courts (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  sport                 text not null check (sport in ('padel', 'tennis', 'football')),
  description           text,
  capacity              integer not null check (capacity > 0),
  price_per_slot        numeric(8, 3) not null check (price_per_slot >= 0),
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes > 0),
  image_url             text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- slots
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.slots (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid not null references public.courts(id) on delete cascade,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  status     text not null default 'open' check (status in ('open', 'closed', 'booked')),
  created_at timestamptz not null default now(),
  unique (court_id, start_time)
);

create index if not exists slots_court_start_idx
  on public.slots (court_id, start_time);

-- ─────────────────────────────────────────────────────────────────────────────
-- bookings
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null unique references public.slots(id) on delete restrict,
  customer_name text not null,
  phone         text not null,
  email         text,
  party_size    integer not null check (party_size > 0),
  total_kwd     numeric(8, 3) not null check (total_kwd >= 0),
  status        text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — locked down by default; service role bypasses RLS automatically.
-- Public read policies are added in Session 6 alongside auth.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.courts   enable row level security;
alter table public.slots    enable row level security;
alter table public.bookings enable row level security;
