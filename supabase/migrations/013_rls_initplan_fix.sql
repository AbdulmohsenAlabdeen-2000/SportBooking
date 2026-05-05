-- 013_rls_initplan_fix.sql
-- Performance + scale-hardening fix for RLS policies.
--
-- Supabase's database advisor flagged 9 RLS policies that call
-- `auth.uid()` directly. Postgres re-evaluates these per row scanned,
-- which on large tables (slots, bookings) becomes a hot loop. Wrapping
-- the call in a scalar subquery `(select auth.uid())` lets the planner
-- evaluate it once and reuse the result.
--
-- This is a DROP+CREATE on the same policies — the predicate logic is
-- identical. No behavior change for callers; just faster at scale.
-- Listed by table for easier review.

-- ─── customers ───────────────────────────────────────────────────────────────
drop policy if exists "customer reads own row"   on public.customers;
drop policy if exists "customer inserts own row" on public.customers;
drop policy if exists "customer updates own row" on public.customers;

create policy "customer reads own row"
  on public.customers for select
  using ((select auth.uid()) = user_id);

create policy "customer inserts own row"
  on public.customers for insert
  with check ((select auth.uid()) = user_id);

create policy "customer updates own row"
  on public.customers for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── bookings ────────────────────────────────────────────────────────────────
drop policy if exists "customer reads own bookings" on public.bookings;

create policy "customer reads own bookings"
  on public.bookings for select
  using ((select auth.uid()) = user_id);

-- ─── reviews ─────────────────────────────────────────────────────────────────
drop policy if exists "customer inserts own review" on public.reviews;
drop policy if exists "customer deletes own review" on public.reviews;

create policy "customer inserts own review"
  on public.reviews for insert
  with check ((select auth.uid()) = user_id);

create policy "customer deletes own review"
  on public.reviews for delete
  using ((select auth.uid()) = user_id);

-- ─── passkey_credentials ─────────────────────────────────────────────────────
drop policy if exists "passkeys_select_own" on public.passkey_credentials;
drop policy if exists "passkeys_insert_own" on public.passkey_credentials;
drop policy if exists "passkeys_update_own" on public.passkey_credentials;
drop policy if exists "passkeys_delete_own" on public.passkey_credentials;

create policy "passkeys_select_own"
  on public.passkey_credentials for select
  using (user_id = (select auth.uid()));

create policy "passkeys_insert_own"
  on public.passkey_credentials for insert
  with check (user_id = (select auth.uid()));

create policy "passkeys_update_own"
  on public.passkey_credentials for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "passkeys_delete_own"
  on public.passkey_credentials for delete
  using (user_id = (select auth.uid()));
