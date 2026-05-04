-- Smash Courts Kuwait — customer reviews (Session 14)
-- One review per booking. The reviewer must own the booking; the booking
-- must be confirmed or completed and have already started (you can't
-- review a court you haven't played on yet).
--
-- Run AFTER 004_customer_accounts.sql.

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Denormalized so the per-court average rating is one cheap query
  -- instead of a join through bookings every time the landing renders.
  court_id    uuid not null references public.courts(id),
  rating      integer not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reviews_court   on public.reviews (court_id);
create index if not exists idx_reviews_user    on public.reviews (user_id);
create index if not exists idx_reviews_created on public.reviews (created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "public read reviews"        on public.reviews;
drop policy if exists "customer inserts own review" on public.reviews;
drop policy if exists "customer deletes own review" on public.reviews;

-- Reviews are publicly readable so the court-rating display on the
-- landing page works through the anon role.
create policy "public read reviews"
  on public.reviews for select
  using (true);

-- Customers can only insert reviews under their own user_id. The API
-- additionally enforces ownership of the linked booking + that the
-- booking has actually started — RLS alone can't reach across to the
-- bookings table without a function.
create policy "customer inserts own review"
  on public.reviews for insert
  with check (auth.uid() = user_id);

-- Customers can delete (effectively retract) their own reviews. Useful
-- for accidental submissions; we don't expose a UI for editing yet.
create policy "customer deletes own review"
  on public.reviews for delete
  using (auth.uid() = user_id);
