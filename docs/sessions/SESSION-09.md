# Session 09 — Slot Manager

## Goal
Full schedule control: open/close individual slots, bulk-close/open whole days, auto-fill the rolling 14-day window so admins never see gaps.

## What was built
- **`GET /api/admin/slots`** — `court_id`, `from`, `to` (max 14-day range, Kuwait dates). Joins the active booking (`reference`, `customer_name`) when status is `booked` so the manager UI can show whose booking is in that slot.
- **`PATCH /api/admin/slots/[id]`** — `{ status: "open" | "closed" }`. 404 if missing, 409 `slot_booked` if currently booked. Update is guarded `neq("status","booked")` so a concurrent booking cannot lose its slot to an admin flip mid-flight.
- **`POST /api/admin/slots/bulk-close`** — `{ court_id, date }`. Closes all `open` slots on that day, returns `{ closed, skipped: [{ id, start_time, reason: "already_booked" }] }`. Booked slots untouched.
- **`POST /api/admin/slots/bulk-open`** — symmetrical bulk operation, flips `closed` → `open`.
- **`POST /api/admin/slots/ensure`** — idempotent maintenance endpoint. For every active court, generates `08:00–22:00` hourly slots for each of the next 14 days, upserts with `onConflict: "court_id,start_time"` + `ignoreDuplicates: true` so existing `closed` / `booked` rows are NOT clobbered back to open. Used by the slot manager on mount to auto-fill rolling-window gaps; production should also call it from a daily cron.
- **`/admin/slots`** (`src/app/(admin)/admin/slots/page.tsx`) — Client Component. Toolbar (court segmented buttons + week navigator + refresh). Mobile presents a 7-chip date strip plus one vertical day panel; desktop renders the seven days as a horizontal grid. Each slot cell:
  - Open → emerald, tappable
  - Closed → slate, tappable
  - Booked → red-50 with the customer's first name + reference, **inert** (not a button); tap surfaces a toast pointing to `/admin/bookings`.
  - Toggle is **optimistic** — UI flips instantly, fires PATCH, rolls back on error, 409 triggers a refetch so the UI catches up.
  - Each day header has Close-all / Open-all buttons that delegate to the bulk endpoints via the `ConfirmModal` (danger variant for close).
  - Legend (Open / Closed / Booked) at the bottom.

## How to verify
1. Have at least 1 booked slot on a couple of different days plus the default open slots.
2. Visit `/admin/slots` while signed in. The first court is selected and the next 7 days render. A small "Refreshing schedule…" indicator briefly appears while `/ensure` runs.
3. Switch courts via the segmented buttons — slots refetch.
4. Use Prev / Next week to navigate; "This week" snaps back to today.
5. Tap an **open** cell — it flips to closed instantly, server confirms in the background. Tap again — flips back to open.
6. Tap a **booked** cell — toast: "Cancel via Bookings to free this slot." Cell does not change.
7. **Bulk close** a day — modal asks for confirmation, mentions the count of open slots and notes booked slots are not affected. After confirming, the open cells turn closed, booked stay red, and the toast reads `Closed N slots`. If any booked slots existed: `(M booked left untouched)`.
8. **Bulk open** symmetrically reopens closed cells.
9. **Customer side:** with the slot closed, hit `/api/courts/<court_id>/slots?date=YYYY-MM-DD` from the customer flow — that hour shows status `closed` and is rendered as `—` and not tappable in `/book/<courtId>`.
10. **Server protection:** `curl -X PATCH /api/admin/slots/<bookedSlotId> -d '{"status":"closed"}'` (with admin cookie) returns 409 `slot_booked`.
11. **Idempotency:** call `/api/admin/slots/ensure` twice — the first call inserts any missing rows, the second returns `inserted: 0`. Existing closed/booked rows are unchanged.
12. **Mobile (390px):** date strip + single-day vertical view, no horizontal scroll, 44px+ tap targets.
13. **Desktop (≥1280px):** 7-column week grid, all four courts toggleable from the segmented control.

## Decisions & trade-offs
- **One-day-at-a-time on mobile, week-grid on desktop.** A 7-day grid at 390px would either need horizontal scroll (bad ergonomics for tapping cells) or compress each column to ~50px wide, which is below comfortable tap-target size. The date strip + single panel pattern matches what the customer flow already uses, so admins on phones get a familiar interaction model.
- **`/ensure` server-only and idempotent.** Generating future slots lazily on every page load is cheap because of the `(court_id, start_time)` unique index — `ignoreDuplicates` makes it a no-op when nothing's missing. A scheduled cron is still recommended for production so admins who never visit `/admin/slots` don't end up with rolling-window gaps.
- **Optimistic toggle with rollback.** The PATCH itself is fast, but optimistic UI feels instant and lets the admin keep clicking through 4–5 cells in quick succession without spinner-induced hesitation. Server rejection (mostly the booked-under-you 409) rolls back the cell + refetches.
- **Booked slots are inert in the UI and 409 server-side.** Two layers because either alone has a problem: UI-only protection is insufficient (anyone can curl), server-only protection makes "tap to discover the slot is locked" the primary affordance, which is slow.
- **Day buckets computed by Kuwait wall-clock**, not the UTC date prefix. The 22:00 Kuwait slot maps to 19:00 UTC, which falls on the same UTC date most of the year, but bucketing on the explicit Kuwait-offset arithmetic avoids a class of edge cases the moment we ever touch DST or country settings.
- **Bulk-close returns `skipped`** rather than failing on the first booked slot. Admins want to see "I closed 13 of 15, 2 are booked" not "Operation failed because 1 slot was booked."

## Production cron note
Add a scheduled job (Supabase Edge Function, GitHub Actions, or external cron) that calls `POST /api/admin/slots/ensure` once per day at ~03:00 Kuwait so the rolling window is always full even if no admin touches the dashboard.

## Known issues / TODO for later sessions
- Polish + Lighthouse pass + deployment readiness — Session 10.
- No "open every Tuesday 4–7 pm for the next month" recurring rule yet (bonus track only).
- `/ensure` not on a cron yet — manual or page-load-triggered.
- The list view shows the next 7 days. Past dates can be navigated to, but bulk actions on past days are unusual; keeping the action buttons enabled is acceptable for now (admins can mark a past day closed for accounting reasons).

## Files changed
- `src/app/api/admin/slots/route.ts` (new)
- `src/app/api/admin/slots/[id]/route.ts` (new)
- `src/app/api/admin/slots/bulk-close/route.ts` (new)
- `src/app/api/admin/slots/bulk-open/route.ts` (new)
- `src/app/api/admin/slots/ensure/route.ts` (new)
- `src/app/(admin)/admin/slots/page.tsx` (new)
