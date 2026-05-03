# Session 02 — Public API: Courts & Slots

## Goal
Read-only public endpoints for courts, slots, and a 14-day availability summary, ready to power the customer UI.

## What was built
- `src/lib/types.ts` — `Court`, `Slot`, `Booking`, `Sport`, `SlotStatus`, `BookingStatus`
- `src/lib/time.ts` — Kuwait timezone helpers: `kuwaitTodayIso()`, `kuwaitDateToUtcRange()`, `isWithinBookingWindow()`, `nextNDaysIso()`, `BOOKING_WINDOW_DAYS`
- `src/lib/api.ts` — `jsonError`, `validateDateParam`, `isUuid`
- `GET /api/courts` — list active courts ordered by name
- `GET /api/courts/[id]` — single active court, 404 otherwise
- `GET /api/courts/[id]/slots?date=YYYY-MM-DD` — slots for that court on that Kuwait calendar date
- `GET /api/courts/[id]/availability` — 14-day open/total slot counts

## How to verify
With `npm run dev` running:
```sh
curl -s http://localhost:3000/api/courts | jq '.courts | length'
# → 4

curl -s http://localhost:3000/api/courts/<valid-id>
# → { "court": { ... } }

curl -s -o /dev/null -w '%{http_code}\n' \
  http://localhost:3000/api/courts/00000000-0000-0000-0000-000000000000
# → 404

curl -s "http://localhost:3000/api/courts/<id>/slots?date=$(date -u +%Y-%m-%d)" | jq '.slots | length'
# → 15

curl -s "http://localhost:3000/api/courts/<id>/slots?date=invalid" | jq
# → { "error": "date_invalid_format" } with status 400

curl -s "http://localhost:3000/api/courts/<id>/slots?date=2030-01-01" | jq
# → { "error": "date_out_of_window" } with status 400

curl -s "http://localhost:3000/api/courts/<id>/availability" | jq '.days | length'
# → 14
```

## Decisions & trade-offs
- **Native `Intl`/`Date` over `date-fns-tz`.** Asia/Kuwait is UTC+3 with no DST, so timezone math is a fixed-offset arithmetic problem. Pulling in a date library for a single offset constant was not worth the bundle weight.
- **Slot status returned raw, not "available."** Clients render `open` as bookable; `booked`/`closed` are visibly distinct. The server doesn't merge them so the admin UI in later sessions can distinguish "manually closed" from "already booked" without a second query.
- **Service-role server client** for all reads. RLS is permissive on courts/slots, but using the same client throughout means no surprises when these routes start checking auth-only data later.
- **Availability does one query, buckets in JS** — 14 × ~15 = 210 rows is trivial vs. 14 separate round trips.

## Known issues / TODO for later sessions
- POST `/api/bookings` arrives in Session 3
- Admin endpoints (Sessions 6–9)
- `/api/courts/[id]/availability` doesn't take a `from`/`to`; it always returns the next 14 days

## Files changed
- `src/lib/types.ts` (new)
- `src/lib/time.ts` (new)
- `src/lib/api.ts` (new)
- `src/app/api/courts/route.ts` (new)
- `src/app/api/courts/[id]/route.ts` (new)
- `src/app/api/courts/[id]/slots/route.ts` (new)
- `src/app/api/courts/[id]/availability/route.ts` (new)
- `docs/sessions/SESSION-02.md` (this file)
