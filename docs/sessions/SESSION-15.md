# Session 15 — Declined Status, Past Slots & Status-Split Chart

## Goal
Fix three correctness issues in the admin/payment surface that surfaced
once SESSION-14's MyFatoorah flow was working end-to-end:

1. Declined card attempts were polluting `/me` and the admin bookings
   list as if they were real cancellations.
2. The slot grid let customers click slots whose start time had already
   passed in Kuwait local time.
3. The dashboard week chart conflated confirmed and cancelled bookings
   into a single bar, so admins couldn't see refund volume at a glance.

## What was built

### Distinct `declined` status (separate from `cancelled`)
Cancelled now means *exactly* "was paid, then someone cancelled and got
refunded". Declined means *exactly* "the customer's card was rejected,
nothing was ever charged". They look the same in the DB schema but have
opposite product meaning, and the previous "cancel everything that
fails" approach broke that.
- **`supabase/migrations/011_declined_status.sql`** — widens
  `bookings_status_check` to allow `declined`. Applied to production
  Supabase via SQL editor.
- **`src/lib/types.ts`** — `BookingStatus` gains `"declined"`.
- **`src/app/(customer)/book/payment-result/page.tsx`** — on
  `live === "failed"` writes status `declined` (not `cancelled`) and
  releases the slot, still guarded on `pending_payment` so a late
  webhook can't downgrade a confirmed booking.
- **`src/lib/i18n/dict.{en,ar}.ts`** — `payment_result.failed_*`
  rewritten: "Your booking has failed. Your transaction was declined and
  the booking did not go through. Please try booking again." Customer
  doesn't see the word "cancelled" because nothing was paid.

### Hide `declined` everywhere it'd cause confusion
- `/me` page — `.neq("status", "declined")` on the bookings query.
- `/api/admin/bookings` — same filter, in both demo and Supabase paths.
- `/api/admin/bookings/today` — same filter; it also drops out of the
  4-card top stats (total / confirmed / completed / revenue).
- `/api/admin/stats/week` — declined and `pending_payment` skipped
  entirely from the chart counts and revenue total.
- `StatusBadge` and `MyBookingsList`'s `StatusPill` keep a defensive
  "muted slate" branch for `declined` so the type system is exhaustive,
  but rows never reach those components in practice.
- `/api/admin/bookings/[reference]/status` — `declined` added to
  `ALLOWED_TRANSITIONS` as terminal; admin can't transition a declined
  attempt anywhere.

### Past-time slots are unbookable + display as "Past"
Customers in Kuwait could previously click a slot for 8 AM at 9 AM and
hit the booking form. The fix is read-time, not cron-driven.
- **`/api/courts/[id]/slots`** — every slot in the response gets a
  derived `is_past: boolean` based on `new Date(start_time).getTime() <=
  Date.now()`. UTC is fine for "is this instant past?" — the conversion
  to Kuwait time only matters for *display*.
- **`/api/courts/[id]/availability`** — `open_count` excludes past slots
  so a day full of expired slots renders as "fully unavailable" on the
  date picker, not "open".
- **`/api/bookings`** — server-side reject with `slot_in_past` (409) if
  the slot's start time is already past. UI hint and security boundary
  stay independent.
- **`src/lib/demo/store.ts`** — `createBooking` mirrors the same check
  so demo mode behaves consistently.
- **Slot grid (`src/app/(customer)/book/[courtId]/page.tsx`)** — past
  slots render as a greyed-out tile with line-through clock and "Past"
  label, no click handler. Ranks above the `booked`/`closed` checks so
  it wins for in-progress past slots.
- **`src/lib/i18n/dict.{en,ar}.ts`** — added `book.past`, `past_aria`,
  `past_title`.

### Week chart split by status with distinct colors
- **`/api/admin/stats/week`** — response shape changed from
  `{ date, bookings, revenue_kwd }` to
  `{ date, confirmed, cancelled, bookings, revenue_kwd }`. `bookings` is
  kept as `confirmed + cancelled` so existing references don't break.
  Per-day revenue still sums confirmed + completed only.
- **`src/components/admin/WeekBarChart.tsx`** — stacked bars per day:
  brand-teal segment for confirmed/completed (bottom), red for cancelled
  (top). Today gets a brand-tinted ring instead of a fill swap so both
  segments stay visible. Header shows a small legend with totals
  (Confirmed N · Cancelled N).
- **`src/lib/i18n/dict.{en,ar}.ts`** — `chart_confirmed`,
  `chart_cancelled`.

## How to verify
1. Open `https://sport-booking-pi.vercel.app`. Pick any court and any
   day where one or more slots have already passed in Kuwait time —
   those slots show a greyed "Past" tile instead of being clickable.
2. Try booking a future slot with an obviously-invalid card. After
   redirect back, the page reads "Your booking has failed... please try
   booking again." Open `/me` — no row for that attempt. Open the admin
   bookings list — no row either.
3. Book the same slot again with a sandbox-valid card. `/me` shows it
   as confirmed. Admin's today list shows it. Revenue card includes
   its price.
4. From admin, cancel the same booking. Revenue card decrements by that
   price on next refresh. The chart's bar for today now has a thin red
   segment on top of the brand-teal segment.

## Decisions & trade-offs
- **`declined` as a stored status, not a derived "anything without
  paid_at = declined" filter.** Storing the state explicitly lets the
  bookings table double as an audit log of decline attempts (useful
  later for fraud-pattern review) without leaking them into the rest of
  the UI. Derived approaches would force every consumer to know the
  rule.
- **Past-time check is runtime, not a cron flipping `slots.status`.** A
  cron creates a window where a slot is "open in DB but past in real
  life", and the UI would be wrong for that window. Comparing
  `start_time` to `Date.now()` at read time is always correct, costs
  effectively nothing, and avoids any new scheduled job.
- **`is_past` is on the API response, not the slot grid client.** The
  client *could* compute it from `start_time` alone, but making the
  server the source of truth means the same boolean drives the
  availability counts and any future surfaces (admin slot manager,
  reminders) without re-implementing the rule.
- **Stacked bars instead of grouped bars in the chart.** With seven
  narrow weekday columns, stacking keeps each day's total volume legible
  at the top of the bar; grouping would have halved the bar widths and
  broken the visual ranking by total. Cancellations sit on top in red so
  they pop against the brand-teal base.
- **`bookings` field kept on the week response as
  `confirmed + cancelled`.** Slightly redundant but keeps the existing
  `chart_total` aria/legend strings working and avoids a churn-y rename.
- **StatusBadge / StatusPill keep a defensive `declined` branch.** Rows
  shouldn't reach them since every consumer filters declined out, but
  the exhaustive `Record<BookingStatus, ...>` type forces the branch and
  it costs ~2 lines.

## Known issues / TODO
- **Migration must be applied to any new environment** before declined
  bookings can be written. Production was applied this session; preview
  and any future fork need the same `011_declined_status.sql` run.
- **No "Refunded today" stat tile yet.** Cancellations affect revenue
  net (revenue auto-drops) but the dashboard doesn't surface a separate
  refund total. Easy add if useful.
- **Past-slot booking attempt returns the generic "slot taken" toast.**
  The 409 error JSON now distinguishes `slot_in_past` from
  `slot_not_available`, but the customer-facing toast doesn't yet
  branch. Acceptable because the slot grid refresh after the toast will
  show the slot as "Past" anyway.

## Files changed
- `supabase/migrations/011_declined_status.sql` (new)
- `src/lib/types.ts` — `BookingStatus` + `Slot.is_past`
- `src/app/(customer)/book/payment-result/page.tsx` — write `declined`
- `src/app/(customer)/me/page.tsx` — exclude declined
- `src/app/api/admin/bookings/route.ts` — exclude declined
- `src/app/api/admin/bookings/today/route.ts` — exclude declined
- `src/app/api/admin/bookings/[reference]/status/route.ts` — `declined`
  in `ALLOWED_TRANSITIONS`
- `src/app/api/admin/stats/week/route.ts` — split per status, exclude
  declined + `pending_payment`
- `src/app/api/courts/[id]/slots/route.ts` — derive `is_past`
- `src/app/api/courts/[id]/availability/route.ts` — exclude past from
  `open_count`
- `src/app/api/bookings/route.ts` — reject `slot_in_past`
- `src/lib/demo/store.ts` — same in `createBooking`
- `src/app/(customer)/book/[courtId]/page.tsx` — render past tile
- `src/components/admin/WeekBarChart.tsx` — stacked bars + legend
- `src/components/admin/StatusBadge.tsx` — declined branch (defensive)
- `src/components/customer/MyBookingsList.tsx` — declined branch
  (defensive)
- `src/app/(admin)/admin/page.tsx` — `WeekResponse` type updated
- `src/lib/i18n/dict.en.ts`, `src/lib/i18n/dict.ar.ts` — new strings
