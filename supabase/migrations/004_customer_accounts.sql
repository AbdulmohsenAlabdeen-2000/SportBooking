-- Smash Courts Kuwait — customer accounts (Session 12)
-- Customers sign up with phone + name. The unique identity is the phone
-- number (enforced by auth.users at the Supabase Auth layer). Bookings now
-- carry an optional user_id so signed-in customers can see and cancel their
-- own bookings.
--
-- Run AFTER 003_cancel_booking.sql.

-- ─── customers table ────────────────────────────────────────────────────────
-- One row per signed-in customer. Linked 1:1 to auth.users; the user_id is
-- both PK and FK. When the auth user is deleted (admin action), the customer
-- profile cascades.

create table if not exists public.customers (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone       text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_customers_phone on public.customers (phone);

alter table public.customers enable row level security;

drop policy if exists "customer reads own row"   on public.customers;
drop policy if exists "customer updates own row" on public.customers;

-- Each authenticated user can read and update only their own customer row.
-- Server (service role) bypasses RLS for backfill, signup, etc.
create policy "customer reads own row"
  on public.customers for select
  using (auth.uid() = user_id);

create policy "customer updates own row"
  on public.customers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── bookings.user_id ───────────────────────────────────────────────────────
-- Nullable to keep historical bookings (made before customers existed)
-- valid. New bookings created by signed-in customers carry this; anonymous
-- bookings (admin-created or pre-account) leave it null.
alter table public.bookings
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_bookings_user on public.bookings (user_id);

-- Allow signed-in customers to read their own bookings via the anon key.
-- Service role still has unrestricted read for the admin tooling.
drop policy if exists "customer reads own bookings" on public.bookings;
create policy "customer reads own bookings"
  on public.bookings for select
  using (auth.uid() is not null and auth.uid() = user_id);

-- ─── Signup trigger ─────────────────────────────────────────────────────────
-- When a new auth.users row is created, materialize a customers row using
-- the name from raw_user_meta_data and the phone from auth.users.phone.
-- Idempotent: ON CONFLICT DO NOTHING.

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_phone text;
begin
  -- Only act on phone signups; email-only users (admins) are skipped so
  -- we don't accidentally create customer rows for the admin login.
  if new.phone is null or new.phone = '' then
    return new;
  end if;

  v_phone := new.phone;
  -- Supabase normalizes phone without the leading '+'. Re-add it so the
  -- customers.phone column matches the canonical +965XXXXXXXX format we
  -- use elsewhere in the app.
  if v_phone is not null and left(v_phone, 1) <> '+' then
    v_phone := '+' || v_phone;
  end if;

  v_name := coalesce(new.raw_user_meta_data ->> 'name', 'Customer');

  insert into public.customers (user_id, name, phone)
  values (new.id, v_name, v_phone)
  on conflict (user_id) do nothing;

  -- Backfill: any existing bookings with the same phone get linked.
  update public.bookings
     set user_id = new.id
   where user_id is null
     and customer_phone = v_phone;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_customer();
