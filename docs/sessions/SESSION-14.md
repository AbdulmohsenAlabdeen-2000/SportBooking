# Session 14 — MyFatoorah Production Payment Fixes

## Goal
Get the MyFatoorah payment flow working end-to-end on the deployed Vercel
production app: customer redirected to a hosted payment page with a
choice of methods (KNET / Visa / MC / Apple Pay), booking flips to
`confirmed` after a successful payment, and the slot is released after a
failed/abandoned one — without depending on MyFatoorah's webhook
arriving.

## What was built

### Diagnostics that drove the fixes
- Production booking attempts were failing with `[bookings] ExecutePayment failed { error: 'The token is not valid or expired!' }` even though the env-check log reported `configured: true`. The check only verifies the env var is *present*, not *valid*.
- `vercel env pull .env.vercel.tmp --environment=production` revealed `MYFATOORAH_API_KEY len=2 prefix=""` — the production env vars were literally empty strings; only the local `.env.local` had a value, and that one was a placeholder.
- After fixing env vars, both newly-created `SK_KWT_*` SecretKey tokens from the merchant's `demo.myfatoorah.com` portal were also rejected. A direct `curl` to `/v2/ExecutePayment` reproduced the same 401 outside of Vercel — proving the token itself was the issue, not our integration.
- The merchant account hadn't been activated by MyFatoorah (no confirmation email arrived). MyFatoorah's **public sandbox token** (`SK_KWT_vVZl...`) returned `IsSuccess:true` against the same endpoint, confirming everything else was fine.

### MyFatoorah wrapper (`src/lib/payments/myfatoorah.ts`)
- **Switched `ExecutePayment` → `SendPayment`.** `ExecutePayment` with `PaymentMethodId: 2` was hard-routing customers to the MPGS Visa/MC gateway (`/PayInvoice/Mpgs2`), so KNET/Apple Pay were never offered. `SendPayment` with `NotificationOption: "LNK"` returns an `InvoiceURL` to the unified picker page where MyFatoorah surfaces every method enabled on the account.
- **Surfaced `ValidationErrors` in error logs.** The bare `Message: "Invalid data"` was useless — added `ValidationErrors` to the response type and concatenated each `Name: Error` pair into the returned error string. This is what then exposed the next bug.

### Booking creation (`src/app/api/bookings/route.ts`)
- **Stripped the leading `+` from `customerMobile` before sending to MyFatoorah.** Phones are stored canonically as `+96512345678` (12 chars); MyFatoorah caps `CustomerMobile` at 11 chars. Now sends `96512345678`. The DB representation stays unchanged.

### Payment-result page (`src/app/(customer)/book/payment-result/page.tsx`)
The webhook turned out to be unreliable in our sandbox setup — no `POST /api/payments/webhook` calls were appearing in Vercel logs after either successful or failed payments. So the page was promoted from "nice-to-have live check" to the **primary** state-transition path, with the webhook kept as a backup.
- **On `live === "paid"`**: atomically flip the booking to `confirmed` (with `paid_at`) using `.eq("status", "pending_payment")` + `.select("id")` so only one of {page, webhook} wins the race and sends the SMS. Then redirect to `/book/confirmed/[reference]`.
- **On `live === "failed"`**: cancel the booking and reopen the slot. Same `pending_payment` guard so a late-arriving webhook can't downgrade an already-confirmed booking.
- Expanded the booking query to join `slots` and `courts` so the SMS can be sent inline without a second round-trip.

### Schema migration applied
`supabase/migrations/010_payments.sql` had been written but never applied to the deployed Supabase project. Without it, every `pending_payment` status update silently failed (the `bookings_status_check` constraint didn't include the new state) and every `payment_invoice_id` write hit a non-existent column. Applied via the Supabase SQL editor on the production DB.

### Production env vars (Vercel)
- `MYFATOORAH_API_KEY` — currently the public sandbox token. Will be swapped for the real merchant token once MyFatoorah activates the account.
- `MYFATOORAH_BASE_URL` — `https://apitest.myfatoorah.com` (sandbox).
- `MYFATOORAH_WEBHOOK_SECRET` — set, but webhook deliveries themselves aren't reaching the endpoint yet (see TODO).

## How to verify
1. Open `https://sport-booking-pi.vercel.app`, pick any open slot, fill the booking form, submit.
2. You're redirected to a MyFatoorah hosted page showing **all** payment methods (KNET, Visa/MC, Apple Pay), not the bare card form.
3. **Successful path**: pay with a sandbox-valid card. Land on `/book/confirmed/[reference]`. Re-open `/me` — booking shows as confirmed (no "Pay now" button). Receive SMS confirmation.
4. **Failure path**: enter an obviously-invalid card. Land on `/book/payment-result?...&failed=1` showing "Payment Failed". Refresh the slot grid — the slot is open again. `/me` shows the booking as cancelled.
5. Check `npx vercel logs https://sport-booking-pi.vercel.app` for the booking attempt — you should see `[bookings] payment env check { configured: true }` followed by the redirect, with no `ExecutePayment failed` line.

## Decisions & trade-offs
- **Page-as-source-of-truth, webhook-as-backup.** Originally the webhook was the only writer of `confirmed` / `cancelled`. In practice MyFatoorah's sandbox didn't reliably emit a webhook for either case, leaving bookings stuck in `pending_payment`. Inverting the trust direction — page does the work, webhook idempotently applies the same transition if it ever arrives — is more resilient and matches the user's actual journey (they always hit the landing page; webhooks are external).
- **Atomic transition via `.eq("status", "pending_payment")` + returning row.** Avoids double-send of SMS in the page/webhook race without needing a transaction or advisory lock. Whichever caller succeeds in the row update sends the SMS; the loser sees no row returned and skips.
- **Switched to `SendPayment` instead of guessing the right `PaymentMethodId`.** Per-method IDs vary per MyFatoorah account and require an extra `/v2/InitiatePayment` round-trip to discover. The unified picker is what real customers want anyway, so the simpler endpoint also matches the product intent.
- **Used the public sandbox token rather than wait for activation.** The merchant account on `demo.myfatoorah.com` hasn't been activated yet (no email arrived; support contacted). The publicly-documented test token unblocks all integration testing today; swapping it for the real key once activated is a one-command change.
- **Did not implement a more aggressive cron sweep for stuck bookings.** The existing `expire-pending-payments` daily cron is enough belt-and-braces given that the page now handles both terminal states inline.

## Known issues / TODO
- **MyFatoorah merchant account activation pending.** Awaiting MyFatoorah support reply re: account activation. Once active, swap `MYFATOORAH_API_KEY` on Vercel for the real merchant token (sandbox or live, depending on go-live readiness).
- **Webhook deliveries not arriving at `/api/payments/webhook`** — and they *cannot* until the merchant account is activated. Webhook signing keys are per-account: MyFatoorah's shared public test token (what we're using now) processes payments on *MyFatoorah's* shared account, not on the merchant's account. The webhook configured in `demo.myfatoorah.com` portal only fires for transactions on the merchant's own account, which has zero traffic right now. Once the account is activated and we switch to the real merchant token, re-copy the **webhook secret** from the portal into `MYFATOORAH_WEBHOOK_SECRET` on Vercel and verify deliveries land in `vercel logs`. Not blocking — page handles both terminal states — but worth wiring up for refund events and as a backup signal.
- **MyFatoorah env vars only set on Production scope, not Preview.** Add to Preview if PR previews need to take real bookings.
- **Two real merchant `SK_KWT_*` tokens were pasted into chat during debugging.** Delete in MyFatoorah portal once the account is activated and a fresh key is generated for production use.

## Files changed
- `src/lib/payments/myfatoorah.ts` — `SendPayment` swap, `ValidationErrors` surfacing
- `src/app/api/bookings/route.ts` — strip `+` from `CustomerMobile`
- `src/app/(customer)/book/payment-result/page.tsx` — primary-path confirm/cancel + idempotent SMS
- `supabase/migrations/010_payments.sql` — applied to production DB (no file change; pre-existing migration)
