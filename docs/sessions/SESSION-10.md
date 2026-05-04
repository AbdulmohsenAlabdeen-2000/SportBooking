# Session 10 — Polish, QA & Deployment

## Goal
Take the working app from "demo-ready" to **production-ready**: error pages, loading skeletons, accessibility/SEO polish, a daily slot-ensure cron, and the docs / env scaffolding for a Vercel deploy.

## What was built
- **Error boundaries**:
  - `src/app/error.tsx` — global client error boundary, branded card with `reset()` retry, "Back to home" link, surfaces `error.digest` for support triage in production.
  - `src/app/not-found.tsx` — branded 404 with "Book a court" + "Home" CTAs. `robots: noindex`.
  - `src/app/(admin)/admin/error.tsx` — admin-scoped boundary in slate aesthetic.
- **Loading skeletons** for the slow routes:
  - `src/app/(customer)/book/loading.tsx`
  - `src/app/(admin)/admin/loading.tsx`
  - `src/app/(admin)/admin/bookings/loading.tsx`
  - The slot manager and detail pages use Suspense / inline skeletons inside the page component instead.
- **SEO + sharing**:
  - `src/app/robots.ts` — allows `/`, `/book`; disallows `/admin`, `/api`. Sitemap pointer.
  - `src/app/sitemap.ts` — public pages with `lastModified` + `changeFrequency` + `priority`. Reads `NEXT_PUBLIC_SITE_URL` so previews and production each get correct absolute URLs.
  - `src/app/opengraph-image.tsx` — Edge-runtime `ImageResponse` rendering a 1200×630 brand-teal-gradient OG card with the logo, headline, and tagline.
  - `/book/confirmed/[reference]` declares `robots: { index: false, follow: false }` so private confirmation URLs aren't crawled.
- **Cron + deploy**:
  - `src/app/api/cron/ensure-slots/route.ts` — same idempotent slot-fill logic as `/api/admin/slots/ensure`, but auth is a `CRON_SECRET` bearer (`Authorization: Bearer ${CRON_SECRET}`) instead of an admin session, so the cron job runs without a logged-in user.
  - `vercel.json` — `0 1 * * *` daily cron on `/api/cron/ensure-slots`.
  - `.env.local.example` documents `CRON_SECRET` and `NEXT_PUBLIC_SITE_URL` alongside the existing Supabase keys, with notes on how to generate the secret.
- **README** rewritten as the project's front door: the locked stack, brand, courts; full local setup walkthrough; ASCII architecture diagram; concurrency guarantees of the two RPCs; production deployment steps; index linking each `SESSION-XX.md`.

## QA results
Walked the app at 390×844 (iPhone 14) and at 1280px desktop with Supabase configured locally.

- All 14 routes built and reachable. Build output:
  ```
  /                                          187 B / 94.7 kB
  /book                                      190 B / 94.7 kB
  /book/[courtId]                          3.81 kB / 98.3 kB
  /book/[courtId]/details                  4.91 kB / 99.4 kB
  /book/confirmed/[reference]              1.03 kB / 95.6 kB
  /admin                                  ƒ dynamic
  /admin/login                            2.25 kB / 150 kB
  /admin/bookings                         ƒ dynamic
  /admin/bookings/[reference]             ƒ dynamic
  /admin/slots                            ƒ dynamic
  /api/...                                ƒ all dynamic
  /robots.txt /sitemap.xml /opengraph-image  ✓
  Middleware                              83.8 kB
  ```
- `npm run typecheck` clean.
- `npm run build` clean.
- `npm run test:concurrency` (Session 3 script) — 1 success / 19 conflicts on a contested slot, slot ends `booked`, exactly one row in `bookings`. Cleanup leaves the slot back to `open` so the test re-runs.
- Smoke test on a running dev server confirms `/`, `/book`, `/admin/login`, `/robots.txt`, `/sitemap.xml`, and `/api/cron/ensure-slots` (correctly 401 without bearer) all serve as expected.

## Security audit
- **Service role key is server-only.** `src/lib/supabase/server.ts` and `src/lib/auth.ts` both `import "server-only"`. `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/` matches only those two files plus `scripts/seed.ts` (Node script, not bundled). The browser client (`src/lib/supabase/browser.ts`) only reads the anon key.
- **Middleware gates `/admin/*` and `/api/admin/*`.** Login page is exempted explicitly. API matcher returns JSON 401 (not redirect).
- **Page-level `requireAdmin()`** runs in the admin layout as defence in depth — even a misconfigured matcher would still redirect.
- **Booking creation enforces server-side price.** `POST /api/bookings` reads `courts.price_per_slot` from the DB; the client cannot supply a price.
- **Phone normalization** to canonical `+96512345678` happens in `src/lib/booking.ts` before the row is inserted, so the DB never stores wildly different formats.
- **RLS:** courts and slots have public read policies; bookings have **no policies** (server-only via service role). `admin_emails` similarly RLS-on with no public policies.
- **Rate limiter** on `POST /api/bookings` at 5/min/IP (loopback exempt for the concurrency test). Cron endpoint is bearer-protected.
- **No secrets logged.** `console.log` is only used inside `error.tsx` boundaries in non-production mode.
- **CORS** — Next.js API routes default to same-origin only. No headers added that loosen this.

## Production deployment (steps for you to run)
The code and the `vercel.json` cron are ready, but the deploy itself touches your Vercel + Supabase accounts and your DNS, so it's a manual step:

1. **Push the repo to GitHub** (if not already): the `main` branch is what Vercel will track.
2. **Import the repo into Vercel** → "New Project" → leave defaults.
3. **Add env vars** in Vercel _Settings → Environment Variables_:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only set on the server runtime)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-domain>`
   - `CRON_SECRET` = `openssl rand -hex 32`
4. **Deploy.** First build will pick up `vercel.json` and schedule the daily cron at 01:00 UTC.
5. **Run the migrations + seed** against the production Supabase project (same SQL files as local).
6. **Add a production admin user** in Supabase Auth, insert their email into `admin_emails`.
7. **Smoke test on the live URL:**
   - Customer flow: `/` → `/book` → pick a court + slot → fill the form → confirmation page with a `BK-YYYY-XXXXX` reference. Refresh the confirmation — booking still there, no resubmit.
   - Admin flow: `/admin/login` → dashboard shows the booking → mark as done → cancel another → verify the cancelled slot is bookable on the customer side.
   - Cron: in Vercel _Logs_, the next 01:00 UTC run should report `inserted: 0` after the first day (or N when the rolling window advances).

## Decisions & trade-offs
- **Vercel Cron over Supabase pg_cron.** Same Vercel dashboard for code and schedule, no extra extension to enable, and the cron path can use the same Next runtime + env vars as the rest of the app. pg_cron would couple infra to Supabase forever; Vercel Cron leaves the door open to swap hosting later.
- **Bearer-token cron auth, not IP allowlist.** Vercel doesn't promise a stable IP range for cron invocations; a shared secret is portable to GitHub Actions or any other scheduler if we ever migrate.
- **Per-route loading.tsx, not a global one.** Each surface needs a different skeleton (court cards vs admin stat cards vs filter list). A single global skeleton would feel wrong on at least one of them.
- **OG image via `next/og`, not a static PNG.** No image-tooling dependency, and the gradient + headline can be tweaked by editing TSX. The Edge runtime keeps generation fast.
- **No CSP header** added in `next.config.mjs`. The threat model here is small (no third-party scripts, no UGC iframes), and a strict CSP would interfere with Vercel's preview-deploy banner. Easy to add if needed later.

## Known issues / Future work (bonus track)
- **Payments** (MyFatoorah) — booking would stay `pending_payment` until a webhook confirms. Schema change (add `pending_payment` to status enum), webhook route, and a payment-redirect flow on the form page.
- **OTP via SMS** — server-side 4-digit code, 5-min TTL, max 3 attempts.
- **Email/SMS confirmations** (Resend or Supabase email).
- **Recurring weekly bookings** for regulars.
- **AI slot rules** ("open every Tuesday 4–7 pm for the next month" → preview → commit).
- **Analytics** (Vercel Web Analytics or PostHog) — none yet.
- **Auto-refresh on `/admin`** — the dashboard has a Refresh button but doesn't poll. Easy to add, deferred until there's a concrete need.

## Final demo checklist
- [x] Customer can pick a court and slot from the landing page.
- [x] Booking form collects name + phone (Kuwait normalized).
- [x] Submitting → confirmation page with a `BK-YYYY-XXXXX` reference.
- [x] `/admin` dashboard shows the bookings that were submitted.
- [x] Admin can mark a booking as done and cancel it (which frees the slot atomically).
- [x] Brand name + colour appear on both views; admin uses slate so the surfaces are visually distinct.
- [x] No horizontal scrolling at 390px on any route.
- [x] **Data persists across refresh and server restart** (Supabase Postgres).
- [x] **No double-bookings possible** — `create_booking()` row-lock + `bookings.slot_id UNIQUE` index. Verified by `npm run test:concurrency`.
- [ ] **Production deployment is live** — code and cron config are ready; the deploy itself is a manual step you run on your Vercel + Supabase accounts (see the "Production deployment" section above).

## Files changed
- `src/app/error.tsx` (new)
- `src/app/not-found.tsx` (new)
- `src/app/(admin)/admin/error.tsx` (new)
- `src/app/(customer)/book/loading.tsx` (new)
- `src/app/(admin)/admin/loading.tsx` (new)
- `src/app/(admin)/admin/bookings/loading.tsx` (new)
- `src/app/robots.ts` (new)
- `src/app/sitemap.ts` (new)
- `src/app/opengraph-image.tsx` (new)
- `src/app/(customer)/book/confirmed/[reference]/page.tsx` (modified — robots noindex)
- `src/app/api/cron/ensure-slots/route.ts` (new)
- `vercel.json` (new)
- `.env.local.example` (modified — CRON_SECRET, NEXT_PUBLIC_SITE_URL)
- `README.md` (rewritten — project front door)
- `docs/sessions/SESSION-10.md` (this file)
