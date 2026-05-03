# Session 03 — Booking Creation API (atomic)

## Goal
Ship `POST /api/bookings` so a customer's submission either creates a confirmed booking or returns a precise reason it failed — and so two clients racing for the same slot cannot both win.

## What was built
- `src/lib/booking.ts` — `validateBookingInput()` (slot_id UUID, name 2–100, phone 6–20 with `[0-9+\-\s()]` only, optional email/notes) and `generateReference()` returning `SC-XXXXXXXX` from a 32-symbol unambiguous alphabet (no `0/1/I/O`).
- `POST /api/bookings` route at `src/app/api/bookings/route.ts`:
  - Parses + validates the body. 400 with `{ error: "validation_failed", details: [{ field, error }] }` on bad input.
  - Pre-checks the slot exists and `status = 'open'`. 404 / 409 short-circuits avoid pointless RPC round trips.
  - Reads `price_per_slot` from the court so the price stored on the booking is server-authoritative — the client never gets to pick it.
  - Calls the `create_booking` RPC, which holds the slot row lock, flips its status to `'booked'`, and inserts the booking in one transaction.
  - Maps the RPC's `slot_not_available` exception to **409**, references collisions to a retry loop (3 attempts), all other errors to 500.

## How to verify
With `npm run dev` running and a fresh `npm run seed`:

```sh
# Pick any open slot
SLOT=$(curl -s "http://localhost:3000/api/courts/$COURT/slots?date=$(date -u +%Y-%m-%d)" \
  | jq -r '.slots[] | select(.status=="open") | .id' | head -1)

# Happy path — 201, returns the booking with a reference
curl -s -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' \
  -d "{\"slot_id\":\"$SLOT\",\"customer_name\":\"Ahmed Test\",\"customer_phone\":\"+96599998888\"}" | jq

# Same slot again — 409 slot_not_available
curl -s -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' \
  -d "{\"slot_id\":\"$SLOT\",\"customer_name\":\"Ahmed Test\",\"customer_phone\":\"+96599998888\"}" \
  -w '\nHTTP %{http_code}\n'

# Validation — 400 with details
curl -s -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' -d '{"slot_id":"not-a-uuid"}' | jq

# Concurrent race — both shells fire at the same open slot; exactly one
# returns 201, the other returns 409.
( curl -s -X POST http://localhost:3000/api/bookings \
    -H 'content-type: application/json' \
    -d "{\"slot_id\":\"$NEW_SLOT\",\"customer_name\":\"A\",\"customer_phone\":\"99998888\"}" \
    -w 'A: %{http_code}\n' &
  curl -s -X POST http://localhost:3000/api/bookings \
    -H 'content-type: application/json' \
    -d "{\"slot_id\":\"$NEW_SLOT\",\"customer_name\":\"B\",\"customer_phone\":\"99998888\"}" \
    -w 'B: %{http_code}\n' &
  wait )
```

Then confirm in Supabase Studio: exactly one row in `bookings` for that slot, and the slot's `status = 'booked'`.

## Decisions & trade-offs
- **Atomicity in Postgres, not in Node.** A Node-side mutex would only serialize one server instance; pushing the guard into the SQL function (`update slots set status='booked' where id=? and status='open'` then `get diagnostics`) means even a horizontally scaled deploy is safe.
- **Server-authoritative price.** The client cannot send `total_price` — we read `courts.price_per_slot` and pass it to the RPC. This blocks a trivially obvious tampering vector before any auth lands.
- **Pre-check + RPC.** The pre-check is for fast UX (clear 404/409 without entering the RPC), but the RPC's row-lock guard is the actual correctness layer. The pre-check can lie under concurrency; the RPC cannot.
- **Reference format `SC-XXXXXXXX`.** 8 chars from a 32-symbol alphabet (≈40 bits) — collision probability is negligible, but the unique index on `bookings.reference` will reject any that slip through and we retry.
- **No idempotency key yet.** A double-submit from the customer form will produce a 409 on the second attempt (slot already booked) — good enough until the customer flow lands in Session 5; we'll revisit if duplicate-create reports come up.

## Known issues / TODO for later sessions
- No `GET /api/bookings/[reference]` endpoint yet — Session 5's confirmation page will need it.
- No cancellation endpoint — Session 8 (admin) will add cancel + the slot-restoration logic.
- No rate limiting on POST `/api/bookings`. Trivial to add at the edge later; out of scope here.

## Files changed
- `src/lib/booking.ts` (new) — input validation + reference generator
- `src/app/api/bookings/route.ts` (new) — POST handler
- `docs/sessions/SESSION-03.md` (this file)
