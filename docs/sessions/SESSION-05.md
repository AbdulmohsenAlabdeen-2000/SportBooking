# Session 05 — Customer Booking Flow UI

## Goal
End-to-end customer flow from `/` → court → date+slot → details → confirmed, persisted booking.

## What was built
- **Step 1 — `/book`** (`src/app/(customer)/book/page.tsx`): Server Component, fetches `/api/courts`, renders 4 tappable cards. `?court=<uuid>` deep-links straight to step 2.
- **Step 2 — `/book/[courtId]`** (`src/app/(customer)/book/[courtId]/page.tsx`): Client Component.
  - URL state for date (`?date=YYYY-MM-DD`) — `router.replace` on change, so back/refresh restore the same view.
  - Three independent fetches: court (once), 14-day availability summary (once), slots for the selected date (refetched on date change with a 12-cell skeleton).
  - Date strip: 14 horizontally scrolling 64×80 chips with weekday/day/open-count, today outlined, selected filled, 0-open disabled, selected chip auto-scrolls into view.
  - Slot grid: 3 cols mobile / 4 cols `md+`, 56px cells. Open cells brand-bordered, selected brand-filled with an accent ring, booked line-through, closed shown as `—`.
  - Sticky bottom bar: "Selected: HH:MM–HH:MM" + amber Continue button labelled with KWD price; disabled until a slot is picked.
- **Step 3 — `/book/[courtId]/details`** (`src/app/(customer)/book/[courtId]/details/page.tsx`): Client Component.
  - Refetches court + the target slot for the read-only summary card (court name, sport icon, formatted Kuwait date, time range, total KWD).
  - Form fields: name (2–80), Kuwait phone (fixed `+965` prefix UI + 8-digit numeric input that strips non-digits as you type), optional email (regex), optional notes (500-char counter).
  - Sticky Confirm button uses HTML5 `form="booking-form"` so the fixed-position button still drives the form submit cleanly.
  - Submit goes through `fetch('/api/bookings', { method: 'POST' })`:
    - **201** → `router.replace('/book/confirmed/<reference>')` so refresh on confirmation does **not** retrigger the POST.
    - **409** → toast + `router.push` back to step 2 with the same date preserved.
    - **400** → maps server's per-field details to inline errors.
    - **429** → toast about rate-limit.
    - **500/network** → toast.
- **Step 4 — `/book/confirmed/[reference]`** (`src/app/(customer)/book/confirmed/[reference]/page.tsx`): Server Component fetching `/api/bookings/[reference]`. 404 → friendly "Booking not found"; ok → green check, monospace `BK-YYYY-XXXXX` reference, details card (court+sport, formatted date and time, total KWD, customer name+phone), reminder strip, "Book another court" + "Done" CTAs.
- **`<CopyReference>`** (`src/components/book/CopyReference.tsx`): tiny client island, `navigator.clipboard.writeText`, swaps to "Copied" for 2s.
- **Toast** (`src/components/ui/Toast.tsx`): in-house provider used by step 3's error paths. Auto-dismiss 4.5s, `aria-live="polite"`.
- **Time formatters** added to `src/lib/time.ts`: `formatKuwaitWeekday`, `formatKuwaitDayOfMonth`, `formatKuwaitFullDate`, `formatKuwaitClock`, `formatKuwaitTimeRange`, `formatKwd`. All `Intl.DateTimeFormat` with `timeZone: 'Asia/Kuwait'` so wall-clock display is correct regardless of the visitor's locale.

## How to verify
With `npm run dev` running, `.env.local` set, and Session 1's seed run.

**Happy path at 390px (iPhone 14):**
1. `/` → tap "Book a Court" → `/book` shows 4 stacked court cards.
2. Tap a court → `/book/<id>?date=<today>`. Today is auto-selected, slots load.
3. Drag the date strip — no horizontal page scroll, only the strip scrolls.
4. Tap a different date → URL updates, slot grid refetches with the skeleton, then renders.
5. Booked/closed slots are visibly disabled and don't respond to taps.
6. Tap an open slot → bottom bar shows the time range + price, Continue lights up amber.
7. Continue → details page with the matching summary card.
8. Submit with valid name/phone → spinner "Booking…" → confirmation page with the reference.
9. **Refresh the confirmation page — booking is still there, no resubmit.**

**Race-condition test:**
- Open the same slot in two tabs.
- Submit both forms within ~500ms.
- One returns 201 → confirmation page. The other returns 409 → toast + redirect to step 2 with the same date.
- The slot now shows as `booked` in step 2.

**Validation errors:**
- Submit with phone `abc` → inline error "Enter your 8-digit Kuwait phone number." before any network call.
- Server-side rejection (e.g. malformed email slipping past client): inline field error from the API's `details` array.

**Network failure:**
- Stop the dev server mid-submit → toast "Network error. Check your connection and try again."

## Decisions & trade-offs
- **Client fetch over server actions for the booking submit.** The endpoint already exists from Session 3 with a JSON contract that emits per-field validation details, distinct 409/429/500 statuses, and a stable 201 shape. A server action would force re-implementing that mapping in two places (action result vs API response) and would couple the form to the same Next runtime as the rest of the page. Direct `fetch` keeps the form using the same contract any future native client (e.g. WhatsApp bot, mobile app) will rely on.
- **URL state for date, component state for slot.** Date is something a returning customer might bookmark or share ("here's a free time on Friday"). Slot is ephemeral until the user commits — pushing it to the URL on every tap would clutter history. Slot only appears in the URL on the **transition to step 3**, where it's needed to render the summary.
- **`router.replace` after success.** A `router.push` would let the back button send the user back to the form, where their hooks would re-fire the POST. Replace removes the form from history and the confirmation URL is the canonical post-submit page.
- **In-house toast over `sonner`.** The needs are tiny (3 variants, auto-dismiss, aria-live), and we already pay a small bundle for `lucide-react`. A 70-line context-based toast keeps the dep tree shallow.
- **HTML5 `form="booking-form"`** instead of imperatively dispatching a synthetic submit event. The Confirm button is in a sticky bar outside the `<form>`, but the form attribute lets the browser handle submission natively — keyboard, validation, focus, all automatic.
- **Server-authoritative pricing on the summary card.** The price shown on step 3 comes from `/api/courts/[id]`, not from a query param. Even if a user tampered with the URL, the server still re-reads the price during the booking insert (Session 3 design).

## Known issues / TODO for later sessions
- No payment gate yet — booking confirms immediately.
- No SMS / email confirmation is sent — Session 10's polish wishlist.
- Admin can't see these bookings yet — Sessions 7–8 build the admin dashboard and detail pages.
- The slot grid does not yet auto-refresh if a slot becomes booked while the user is staring at it. Polling or a Supabase realtime subscription would close that window — a Session 10 concern.
- The "Book another court" button on confirmation does not preserve any state — fresh start by design.

## Files changed
- `src/app/(customer)/book/page.tsx` (new) — court picker
- `src/app/(customer)/book/[courtId]/page.tsx` (new) — date + slot picker
- `src/app/(customer)/book/[courtId]/details/page.tsx` (new) — booking form
- `src/app/(customer)/book/confirmed/[reference]/page.tsx` (new) — confirmation
- `src/components/book/CopyReference.tsx` (new) — copy-to-clipboard island
- `src/components/ui/Toast.tsx` (new) — toast provider + hook
- `src/app/(customer)/layout.tsx` (modified) — wraps children in `<ToastProvider>`
- `src/lib/time.ts` (modified) — added Kuwait formatters
