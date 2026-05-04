# Session 12 — Customer Phone Accounts (OTP + Password)

## Goal
Customers must have an account before booking. Identity is the Kuwait phone number; sign-in is **OTP or password** (user picks). Booking flow gated; signed-in customers can see and **cancel their own bookings**, freeing the slot back to other customers.

## What was built

### Migration `004_customer_accounts.sql`
- `customers(user_id PK FK auth.users on delete cascade, name, phone, created_at)` — one row per phone-signup user; phone indexed for the backfill match.
- `bookings.user_id` — nullable FK to `auth.users`. New bookings made by signed-in customers carry this; legacy bookings (pre-accounts) stay null.
- RLS: customers can SELECT/UPDATE only their own row; bookings get an extra "customer reads own bookings" policy keyed on `auth.uid() = user_id` so `/me` works via the anon key.
- `handle_new_customer()` trigger fires on `auth.users` insert. Skips email-only signups (admins). Inserts the customers row with the name from `raw_user_meta_data` and the canonical `+965`-prefixed phone, then **backfills** any pre-existing bookings whose `customer_phone` matches the new user's phone.

### Auth helpers
- **`requireCustomer(redirectTo)`** — Server Component throw-style; redirects to `/login` if no session, `/signup` if session but no profile (rare).
- **`getCurrentCustomer()`** — soft variant returning `null` for the customer header to branch on.
- Demo-mode short-circuits with a fixed demo customer so the customer flow stays usable without Supabase.

### `/signup` (`(customer)/signup`)
Two-stage flow on a single page:
1. **Details** — full name (2-80), Kuwait phone (`+965` prefix UI + 8-digit numeric), optional password (≥8 chars). On submit: `signInWithOtp({ shouldCreateUser:true, options.data:{name} })` so the auth user carries the name in `raw_user_meta_data` for the trigger to read.
2. **Code** — 6-digit `verifyOtp`. On success, optional `updateUser({password})` if user supplied one. Then `router.replace(next)` + `router.refresh()`.

### `/login` (`(customer)/login`)
Two tabs sharing one phone input:
- **Code** — `signInWithOtp({ shouldCreateUser:false })` then 6-digit verify. False so a stranger can't accidentally create an account by typing a wrong number; surfaces "No account found for that number. Sign up first."
- **Password** — `signInWithPassword({phone, password})`. Works for any user who set a password during signup or later via /me.

`?next=` is honored on success (with a `safeRedirect` guard against open redirects).

### `/me` (`(customer)/me`)
Server-rendered profile page:
- **Header**: avatar + name + phone, with a `CustomerSignOut` button (browser `signOut()` then `router.replace('/')`).
- **My bookings**: server-fetched `bookings.user_id = auth.uid()` via service role (bypasses RLS for the join). Grouped into **Upcoming** (confirmed + future) and **Past**. Upcoming gets a per-row Cancel booking button → `ConfirmModal` → `POST /api/bookings/[ref]/cancel`.
- **Sign-in options**: `SetPasswordForm` to set or change the password (`updateUser({password})`).

### `POST /api/bookings/[reference]/cancel`
Customer self-service cancellation. Auth-required, ownership-checked (returns 404 for both "doesn't exist" and "not yours" so references can't be enumerated). Calls the existing `cancel_booking` RPC for the atomic flip + slot release. Returns 409 `already_finalized` for completed/cancelled bookings.

### Booking POST attaches `user_id`
After `create_booking` RPC inserts the row, the route reads the cookie session and runs `UPDATE bookings SET user_id = auth.uid() WHERE reference = ...` if signed in. Best-effort: a failure here doesn't fail the booking.

### `/book/[courtId]/details` is now auth-gated
On mount, the form calls `supabase.auth.getUser()`:
- No user → `router.replace('/login?next=<this URL>')` (URL-encoded, lands back on the same slot+date after sign-in).
- Signed in but no `customers` row → `router.replace('/signup?next=…')`.
- Signed in with profile → prefill name + phone, **hide the input fields**, render a **"Booking under {name} / {phone}"** summary card. Email + notes stay editable.

While the auth check is in flight, the page renders a centered spinner so the unauth'd form doesn't briefly flash.

### Customer header
`(customer)/layout.tsx`'s `<Header />` is now an async Server Component:
- Signed in: brand-tinted "Account" pill with the user's first name → `/me`.
- Anonymous: a quiet "Sign in" link (desktop) + the phone-call CTA.

## How to verify

**Run migration first:** in Supabase SQL Editor, paste and run the contents of `supabase/migrations/004_customer_accounts.sql`. Then:

1. Visit `http://localhost:3000/signup`. Enter name `Test Customer`, phone `94490924` (test number), no password. Click **Send code**. Enter `123456`. Lands on `/me` showing the new account.
2. Visit `/me` directly — see profile + empty "No bookings yet" state.
3. Visit `/book` → pick Football Pitch → pick a slot → Continue. **Auth gate fires**: form renders with a "Booking under Test Customer / +96594490924" card and Email/Notes fields. Submit. Confirmation page shows the new reference.
4. Refresh `/me` — the booking now appears under **Upcoming**.
5. Click **Cancel booking** → confirm → toast "Booking cancelled. Slot is open again." Reload — booking moves under **Past** with a Cancelled pill.
6. Open `/book/<court>` — the same time slot is back to Open and bookable.
7. Sign out via `/me`. Visit `/login` → switch to **Password** tab. Try `94490924` + the password you set in step 1 (skip if you didn't set one). Should land on `/me`.
8. Code-tab also works: `94490924` → Send code → `123456` → in.

**Backfill check:** sign up with the same phone you used for an earlier anonymous booking. After verify, `/me` should show that booking under your account (the trigger ran the backfill).

## Decisions & trade-offs
- **Phone is identity, password is alternative.** OTP is the canonical flow (every customer can use it). Password is convenience for repeat users. Either path lands the same Supabase session.
- **Trigger-backed customer creation.** Doing it in DB instead of an API route means we can't accidentally forget to insert a profile row when a new auth user appears (e.g., from a future webhook or admin tool). Reads `raw_user_meta_data.name` set by `signInWithOtp` options.data.
- **Soft auth gate on the form, not middleware.** Middleware is global; gating `/book/*` there would block anonymous browsing of the slot grid (which we explicitly want to keep for first-time visitors). Gating only `/details` matches the "must have an account at payment time" intent.
- **404 on cancel-not-yours.** Returning 403 would leak that the reference exists but isn't yours. 404 is consistent with "doesn't exist" — better against enumeration.
- **`user_id` updated post-RPC instead of in the RPC.** Modifying `create_booking` would require a migration drop + recreate, plus changing every existing call site. The post-insert `UPDATE` is one extra round trip but additive.
- **Face ID deferred.** WebAuthn passkeys require server-side challenge generation, a credentials table, and a custom session-mint path (Supabase doesn't expose admin-create-session). Done properly that's its own session — Session 13.

## Known issues / TODO
- **Face ID / passkeys** — Session 13 (or sooner if you say go).
- No "forgot password" flow yet — customers who set a password and forget it can fall back to OTP and then change the password via `/me`. Adequate for now.
- Anonymous bookings (admin-created) still possible via the admin path — they just won't be linked to a `user_id`. The trigger backfills if/when that phone signs up later.
- `/me` "Sign-in options" doesn't show the *current* password state (security — Supabase doesn't expose whether a password is set). Setting a new one always works.

## Files changed
- `supabase/migrations/004_customer_accounts.sql` (new) — schema + trigger
- `src/lib/customer.ts` (new) — `requireCustomer` / `getCurrentCustomer`
- `src/app/(customer)/signup/page.tsx` (new)
- `src/app/(customer)/login/page.tsx` (new)
- `src/app/(customer)/me/page.tsx` (new)
- `src/components/customer/MyBookingsList.tsx` (new)
- `src/components/customer/CustomerSignOut.tsx` (new)
- `src/components/customer/SetPasswordForm.tsx` (new)
- `src/app/api/bookings/[reference]/cancel/route.ts` (new)
- `src/app/api/bookings/route.ts` (modified) — links user_id post-insert
- `src/app/(customer)/book/[courtId]/details/page.tsx` (modified) — auth gate + profile prefill
- `src/app/(customer)/layout.tsx` (modified) — signed-in vs anonymous header
