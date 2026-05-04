# Session 08 — Admin Booking List & Detail

## Goal
Searchable, filterable bookings list at `/admin/bookings`, plus a detail page with status actions (Mark as Done, Cancel) where Cancel atomically frees the slot.

## What was built
- **Migration** `supabase/migrations/003_cancel_booking.sql` — `cancel_booking(p_reference text)` SECURITY DEFINER plpgsql function. Flips `bookings.status='cancelled'` (only when current is `confirmed`) and `slots.status='open'` for the linked slot in one transaction. Raises `booking_not_cancellable` if the booking doesn't exist or is already finalized.
- **API** `GET /api/admin/bookings` — query params `from`, `to`, `court_id`, `status`, `q`, `page`, `pageSize`. Sorts by `slot.start_time DESC` via PostgREST foreign-table ordering, with a stable secondary `created_at DESC`. Free-text `q` does a `ilike` over `reference / customer_name / customer_phone` (escaping `%` and `_`). Returns the rows plus `pagination: { page, pageSize, total, totalPages }` and `filters` echoed back. Default range is today → today+30 in Kuwait dates.
- **API** `GET /api/admin/bookings/[reference]` — single booking, court + slot joined, with reference shape sanity check.
- **API** `PATCH /api/admin/bookings/[reference]/status` — body `{ status: "completed" | "cancelled" }`.
  - 404 if reference doesn't exist.
  - 409 `already_finalized` if current status is anything but `confirmed`.
  - 400 `invalid_status` if body is missing or not in the allowed set.
  - `cancelled` → calls `cancel_booking` RPC for the atomic flip + slot release; re-mapping the RPC's `booking_not_cancellable` to 409 covers the TOCTOU race.
  - `completed` → simple `update bookings set status='completed' where reference=? and status='confirmed'`; the `status='confirmed'` guard means a concurrent cancellation still resolves to 409 instead of corrupting state.
- **`ConfirmModal`** (`src/components/admin/ConfirmModal.tsx`) — reusable danger/default modal. Body-scroll lock, focus trap into the dialog, Escape and backdrop dismiss (skipped while busy so an in-flight action can't be aborted halfway).
- **`ToastProvider`** added to the admin layout so the booking-action islands can surface success/error toasts the same way the customer flow does.
- **`BookingsFilters`** (`src/components/admin/BookingsFilters.tsx`) — client island that drives the URL: free-text search, 4-state status pills (single select), date-range pickers, court select. On `<md` the date+court inputs collapse into a togglable accordion to save vertical space.
- **`BookingActions`** (`src/components/admin/BookingActions.tsx`) — client island for the detail page's action bar. Fires the PATCH, shows a spinner inside the active button, toasts on outcome, calls `router.refresh()` so the server-rendered StatusBadge re-pulls.
- **`/admin/bookings`** (`src/app/(admin)/admin/bookings/page.tsx`) — Server Component. Forwards searchParams to `/api/admin/bookings`, fetches courts in parallel for the dropdown. Renders stacked cards on `<md`, a real `<table>` on `≥md`, and a prev/next paginator that preserves all filters in the link.
- **`/admin/bookings/[reference]`** (`src/app/(admin)/admin/bookings/[reference]/page.tsx`) — Server Component. Two-column on `md+`: customer card (name, `tel:` link, `https://wa.me/{intl-digits}` deep-link, optional `mailto:`, notes block) and booking card (court+sport, formatted date, time range, duration, total, relative-time created_at). Action bar at the bottom switches between live actions and a "finalized" notice depending on status.

## How to verify
Set up: have ~10 bookings spread across the next 14 days, several courts, mixed statuses.

1. **List default view:** visit `/admin/bookings` while signed in — bookings within today → +30 days, sorted by start time descending.
2. **Date filter:** narrow `from`/`to` — list updates after Apply.
3. **Court filter:** pick one court — list narrows.
4. **Status pills:** click `Confirmed`, then `Completed`, etc. — URL updates, list refetches.
5. **Search:** type the customer's first name → matches. Type the full reference (e.g. `BK-2026-A4F92`) → exact match.
6. **Pagination:** with > 20 bookings in range, prev/next preserve the filters.
7. **Detail page:** tap a row → reference + status badge in the header, customer + booking cards, action bar.
8. **Mark as Done:** flip a `confirmed` booking → button shows spinner → toast "Marked as done." → badge swaps to `Completed`. Verify in Supabase.
9. **Cancel:** click Cancel Booking → modal appears → confirm. After: toast "Booking cancelled. Slot is now open." Verify in Supabase: `bookings.status = 'cancelled'` AND the linked `slots.status = 'open'`. Also verify on the customer side — the slot now shows as bookable.
10. **Already-finalized:** open a `completed` or `cancelled` booking — the action bar shows "This booking is finalized." with no live buttons.
11. **Race conditions:**
    - Two tabs on the same booking → click Mark as Done in both. One returns 200, the other 409 → toast + refresh. No corruption.
    - Cancel in tab A while tab B has the modal open — confirming in tab B 409s gracefully.
12. **Auth:** sign out, hit any `/api/admin/bookings*` URL — JSON 401, not data.
13. **Mobile (390px):** filters card collapses, list renders as cards, action buttons stack full-width. **Desktop (≥1280px):** real table, two-column detail.
14. **Customer flow** still works; dashboard still reflects the same data.

## Decisions & trade-offs
- **`cancel_booking` as a Postgres function, not two API calls.** A two-step API (cancel booking, then update slot) leaves a window where the booking is cancelled but the slot is still booked. Pushing both updates into one SECURITY DEFINER function makes cancellation transactional and cheap. Same pattern Session 3 used for `create_booking`.
- **Server-rendered list with searchParams.** The whole point of the URL is to be the source of truth — refresh, share-link, browser back all keep the same view. The filters component pushes URL changes; the page re-renders on the server. No SWR-style client cache to keep in sync.
- **Offset pagination over cursor.** Bookings are not high-cardinality (a few hundred per month at peak), filters are stable, and the UX wants "Page 3 of 7" not "Load more." Cursor would buy us nothing here. If write throughput ever justifies it, the schema supports it (the `created_at` index makes `where created_at < cursor` cheap).
- **WhatsApp deep-link via `https://wa.me/{intl}`.** `wa.me` is the universal mobile-and-desktop link. Stripping non-digits + auto-prepending `965` for stored 8-digit local numbers covers Session 5's normalized canonical (`+96512345678`) and any pre-Session-5 rows that might still be local-only.
- **Mark-as-Done update with a `status='confirmed'` WHERE guard.** Even outside the cancel RPC, the simple update has a TOCTOU race with cancel. Adding the guard means the update is a no-op if someone else just cancelled — Supabase reports zero rows, we 409, the UI refreshes. No transaction boundary, no surprises.

## Known issues / TODO for later sessions
- Slot manager — Session 9 (open/close slots, bulk-close).
- No bulk actions (e.g. select 10 bookings → mark all as done) — out of scope for Day 1.
- No CSV export — defer.
- Booking edits beyond status (rename, change time) — not currently planned.
- The list defaults to today→+30 days — viewing past bookings requires changing the From date manually. Adding a "Past 30 days" preset is a polish item.

## Files changed
- `supabase/migrations/003_cancel_booking.sql` (new)
- `src/app/api/admin/bookings/route.ts` (new) — list with filters + pagination
- `src/app/api/admin/bookings/[reference]/route.ts` (new) — single fetch
- `src/app/api/admin/bookings/[reference]/status/route.ts` (new) — PATCH
- `src/components/admin/ConfirmModal.tsx` (new)
- `src/components/admin/BookingsFilters.tsx` (new)
- `src/components/admin/BookingActions.tsx` (new)
- `src/app/(admin)/admin/bookings/page.tsx` (new) — list page
- `src/app/(admin)/admin/bookings/[reference]/page.tsx` (new) — detail page
- `src/app/(admin)/layout.tsx` (modified) — wrapped in ToastProvider
