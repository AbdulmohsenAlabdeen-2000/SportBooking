# Session 11 — Admin Courts CRUD + Slot Add/Delete

## Goal
Give the admin full lifecycle control of courts and slots without touching SQL: add a new court, edit any court, soft-delete (deactivate), reactivate, plus add custom-hour slots and delete unused slots from the manager UI.

## What was built

### Courts API
- **`GET /api/admin/courts`** — lists all courts (active + inactive), sorted active-first then by name. The customer-facing `/api/courts` strips inactive; admins need both.
- **`POST /api/admin/courts`** — create. Validates name (2–80, unique), sport (padel/tennis/football), capacity (1–100), price (≥0, 3-decimal), `slot_duration_minutes` (30/45/60/90/120), `is_active` (default true). On success, **auto-generates the next 14 days × 15 hourly slots** for the new court so it's immediately bookable. Maps the unique-name violation to `409 name_taken`.
- **`GET /api/admin/courts/[id]`** — single read.
- **`PATCH /api/admin/courts/[id]`** — partial update of any of the same fields plus `is_active`. Same `409 name_taken`.
- **`DELETE /api/admin/courts/[id]`** — soft-delete: sets `is_active = false`. Hard-delete is impossible because `bookings.court_id` has no `on delete cascade` — soft is the only safe story. Slots stay in place; they're invisible via the customer-facing API. Reactivation is a `PATCH { is_active: true }`.

### Courts UI — `/admin/courts`
- List of all courts: sport icon + name, sport tag, capacity + price + duration, description (line-clamped). Active/Inactive badge per row.
- **Add court** button opens `CourtForm` (modal). Same form is reused for edit, pre-populated.
- **Edit** per row.
- **Deactivate** (red) per active row → `ConfirmModal` with copy explaining bookings stay intact and you can reactivate any time. **Reactivate** (green) replaces the button when inactive.
- "Refresh" + optimistic re-fetch after every save / deactivate / reactivate.
- "Courts" link added to `AdminSidebar` and to `AdminBottomNav` (now `grid-cols-4`).

### Slot CRUD additions
- **`POST /api/admin/slots`** — create one custom slot at any `start_time`/`end_time` (ISO 8601). Validates the time range, confirms court exists, returns `409 slot_exists` on `(court_id, start_time)` collision.
- **`DELETE /api/admin/slots/[id]`** — hard-delete an unused slot. Refuses if the slot is `booked` OR if any booking row references it (the FK has no cascade, so a naive delete would crash the request — pre-checking yields a clean `409 slot_has_booking`).

### Slot manager UI
- Each day header gets a small **"+"** button → opens `AddSlotModal`. Hour picker shows 00–23, already-taken hours disabled, defaulting to the latest free hour (so the common 23:00 special-event case is one click).
- Each non-booked slot cell now exposes a hover-revealed trash icon (top-right corner). Click → `ConfirmModal`. On confirm, fires DELETE.
- Booked cells stay inert — no delete affordance, ever. Cancellation must go through the bookings detail page first.

## How to verify

**Courts:**
1. Sign in as admin → `/admin/courts`. See the four seeded courts with Active badges.
2. **Add court** → name "Squash Court", sport tennis (closest available), capacity 4, price 5.000 KWD, save. Confirm it appears in the list. Confirm `/api/courts` returns 5 courts. Confirm `/book` shows it.
3. **Edit** the new court — change price to 7.000 KWD. Save. Refresh. New price shows.
4. **Deactivate** it. Confirm in modal. Row turns Inactive. `/api/courts` drops back to the original 4. `/book` doesn't show it. Existing bookings (if any) are unchanged in `/admin/bookings`.
5. **Reactivate** — green button → it's bookable again.

**Slots:**
1. Go to `/admin/slots`. Pick any court, pick today.
2. Click the **"+"** in the day header → modal defaults to 23:00 (since the seed only goes to 22). Click Add. Toast "Added slot at 23:00." The new cell appears in the grid as Open.
3. Customer side: visit `/book/<that court>?date=<today>` — 23:00 now appears in the slot grid.
4. Hover the new 23:00 cell on desktop → trash icon appears. Click → confirm → cell disappears. `/book/<court>?date=<today>` no longer shows it.
5. Try deleting a default 08:00 slot that has no booking — works. Try deleting one that has a booking — toast "Can't delete — slot has a booking on it" and the row stays.

## Decisions & trade-offs
- **Soft-delete on courts, hard-delete on slots.** Courts are referenced by bookings (no cascade) — losing a court would mean losing booking history. Slots are also referenced by bookings, but deletion is gated by an "any booking?" check, so the only deletable slots are ones that never received a booking.
- **Auto-generate slots when a court is created.** Without this, a brand-new court would show in the picker but have no times — and the next 24 hours of customer traffic would see "no slots for this day" until the daily `/api/admin/slots/ensure` cron ran. Auto-generation makes the new court instantly bookable.
- **Slot creation is one-at-a-time, not bulk.** A bulk "extend hours from 22:00 to 24:00" workflow would be nice, but the use case is rare (special events) and the existing per-hour add covers it. The existing `/api/admin/slots/ensure` keeps the default 08–22 window topped up.
- **Hover-revealed delete instead of always-visible.** A persistent ✕ on every cell would clutter the grid, especially on the desktop week view (~210 cells per court per week). Hover-only on desktop, focus-visible on keyboard, and tap-and-hold (via the modal confirm) on mobile keeps the primary action — toggle — uncluttered.
- **Validation duplicated in form + API.** The CourtForm has its own client-side checks for fast feedback, but the API also runs `validateCourtInput` server-side because client-side validation is a courtesy, not a guarantee.

## Known issues / TODO
- No image upload yet (`image_url` field exists on courts but the form doesn't expose it). A drag-drop image step + Supabase storage bucket would be the next ergonomic win.
- "Courts" route doesn't yet have a per-court detail page — list-only with inline edit is enough for the current scale (4–10 courts). Becomes useful at 50+.
- Slot extension is one hour at a time. Could add a "extend hours by N" bulk action later.
- Customer accounts + phone-OTP auth is the next session — no work on that yet.

## Files changed
- `src/lib/court.ts` (new) — `validateCourtInput`
- `src/app/api/admin/courts/route.ts` (new) — GET list / POST create
- `src/app/api/admin/courts/[id]/route.ts` (new) — GET / PATCH / DELETE (soft)
- `src/components/admin/CourtForm.tsx` (new) — create+edit modal
- `src/components/admin/CourtsManager.tsx` (new) — list + actions
- `src/app/(admin)/admin/courts/page.tsx` (new)
- `src/components/admin/AdminNav.tsx` (modified) — Courts link, bottom nav grid-cols-4
- `src/lib/types.ts` (modified) — `Court.is_active?` optional
- `src/app/api/admin/slots/route.ts` (modified) — added POST
- `src/app/api/admin/slots/[id]/route.ts` (modified) — added DELETE
- `src/app/(admin)/admin/slots/page.tsx` (modified) — Add slot button + Trash on cells + AddSlotModal
