-- 012_lockdown_rpcs.sql
-- Critical security fix: lock down SECURITY DEFINER RPCs from public
-- REST exposure.
--
-- Background. Supabase auto-exposes every public-schema function via
-- PostgREST at `/rest/v1/rpc/<name>`. By default Postgres grants
-- EXECUTE on functions to PUBLIC, which means the `anon` role (with
-- the publishable key, visible in any browser bundle) can call our
-- internal SECURITY DEFINER helpers directly — bypassing the entire
-- Next.js API surface that wraps them with rate limiting, validation,
-- ownership checks, and the MyFatoorah payment flow.
--
-- Concretely, before this migration:
--   * `create_booking`  could be called via the anon key to create a
--     booking row without paying. The function flips a slot to
--     `booked` and inserts the booking row in one transaction; nothing
--     in the function checks for payment. This is a free-bookings
--     exploit.
--   * `cancel_booking`  could be called by anyone who knows or guesses
--     a booking reference, regardless of who owns it. This is both a
--     denial-of-service vector and (for paid bookings) a refund
--     trigger. Owner check happens in /api/bookings/[reference]/cancel,
--     but PostgREST goes straight to the function.
--   * `handle_new_customer` is a trigger function and not directly
--     useful via REST, but exposed for the same reason. Lock it down
--     for defense in depth.
--
-- The Next.js API routes call these functions with the **service role**
-- key, which bypasses these grants by design. Triggers on `auth.users`
-- still fire because they run under the role doing the insert
-- (Supabase Auth uses service_role internally), not via PostgREST.

revoke execute on function public.create_booking(uuid, uuid, text, text, text, text, numeric, text)
  from anon, authenticated, public;

revoke execute on function public.cancel_booking(text)
  from anon, authenticated, public;

revoke execute on function public.handle_new_customer()
  from anon, authenticated, public;
