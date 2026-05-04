# 🏟️ Smash Courts Kuwait — Booking System

A production-grade sports-court booking system for **Smash Courts Kuwait** in Salmiya. Customers book padel / tennis / football slots in under a minute on their phone. Admins manage bookings and the schedule from the same app.

Built across **10 incremental sessions** — see [`docs/sessions/SESSION-01.md`](docs/sessions/SESSION-01.md) through [`docs/sessions/SESSION-10.md`](docs/sessions/SESSION-10.md) for the full history, decisions, and trade-offs of every step.

## Stack

- **Framework:** Next.js 14+ (App Router, TypeScript, src dir)
- **Styling:** Tailwind CSS, mobile-first (390px design target)
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Auth:** Supabase email/password + DB allowlist for admin
- **Hosting:** Vercel (with Vercel Cron for the daily slot-ensure job)

## Brand

- Primary `#0F766E` (deep teal) · Accent `#F59E0B` (amber) · Background `#F8FAFC` · Inter
- Customer surface uses brand teal + amber CTAs.
- Admin surface uses slate (no amber) so the two are visually distinct.

## Courts (locked seed data)

| Court          | Sport    | Capacity | Price/slot |
| -------------- | -------- | -------- | ---------- |
| Padel Court 1  | padel    | 4        | 8.000 KWD  |
| Padel Court 2  | padel    | 4        | 8.000 KWD  |
| Tennis Court   | tennis   | 4        | 6.000 KWD  |
| Football Pitch | football | 10       | 15.000 KWD |

Operating hours: 8 AM – 11 PM daily · Slot duration: 60 min · Booking window: 14 days.

## Local setup

1. Clone the repo.
2. `npm install`.
3. **Create a Supabase project** (free tier is fine). From _Project Settings → API_, copy the project URL, `anon` key, and `service_role` key.
4. Copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   CRON_SECRET=<openssl rand -hex 32>
   ```
5. **Run migrations** in the Supabase SQL editor in order:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_admin_emails.sql`
   - `supabase/migrations/003_cancel_booking.sql`
6. **Add an admin user**: Supabase Dashboard → _Authentication → Users → Add user_ (email + password). Then in the SQL editor:
   ```sql
   insert into admin_emails (email) values ('your@email');
   ```
7. **Seed** the courts and 14 days of slots: `npm run seed`.
8. `npm run dev` → http://localhost:3000.
9. Sign in at http://localhost:3000/admin/login.

### Useful scripts

- `npm run dev` — start the Next dev server.
- `npm run build` — production build.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — Next ESLint.
- `npm run seed` — idempotent seed (`scripts/seed.ts`).
- `npm run test:concurrency` — fires 20 parallel POSTs at one slot to verify the atomic `create_booking` (requires `npm run dev` running).

## Architecture (one screen)

```
Customer (mobile-first)              Admin (slate, distinct)
─────────────────────────            ─────────────────────────
/                                    /admin/login          ↘
/book           (court picker)       /admin                 ↘
/book/[id]      (date+slot)          /admin/bookings        — same Next app,
/book/[id]/details (form)            /admin/bookings/[ref]    middleware-gated
/book/confirmed/[ref]                /admin/slots          ↗
                                                            ↗
                  Public APIs                Admin APIs
                  ──────────                 ──────────
                  GET  /api/courts           GET   /api/admin/bookings
                  GET  /api/courts/[id]      GET   /api/admin/bookings/[ref]
                  GET  .../slots             PATCH /api/admin/bookings/[ref]/status
                  GET  .../availability      GET   /api/admin/slots
                  POST /api/bookings         PATCH /api/admin/slots/[id]
                  GET  /api/bookings/[ref]   POST  /api/admin/slots/{bulk-close,bulk-open,ensure}
                                             GET   /api/admin/stats/week
                                             GET   /api/admin/bookings/today

                                             Cron
                                             ────
                                             GET   /api/cron/ensure-slots  (Bearer CRON_SECRET)
```

Concurrency-critical writes are Postgres functions:

- **`create_booking()`** — flips slot to booked + inserts the booking under one row lock; concurrent attempts on the same slot deterministically resolve to one 201 + one 409. See [SESSION-03.md](docs/sessions/SESSION-03.md).
- **`cancel_booking()`** — flips booking to cancelled + frees the slot in a single transaction. See [SESSION-08.md](docs/sessions/SESSION-08.md).

## Production deployment (Vercel)

1. Push the repo to GitHub.
2. In Vercel: _New Project_ → import the repo → leave defaults.
3. Add the same env vars from `.env.local.example` in the Vercel dashboard. **Set `NEXT_PUBLIC_SITE_URL` to your production domain.**
4. Deploy. The first build will pick up `vercel.json` and schedule the daily cron at 01:00 UTC.
5. Run the migrations + seed against the production Supabase project the same way as local setup.
6. Add a production admin user via Supabase Auth + insert their email into `admin_emails`.
7. **Smoke test:**
   - Visit `/` on a real phone, walk through `/book` end to end.
   - Sign in to `/admin`, see the booking you just made.
   - Cancel it, refresh `/book/<court>` — slot is bookable again.

## Sessions

This app was built in 10 incremental sessions. Each `SESSION-XX.md` documents what was built, how to verify it, and the decisions / trade-offs of that session.

| #  | Topic                                | Doc                                         |
| -- | ------------------------------------ | ------------------------------------------- |
| 01 | Project setup & Supabase schema      | [SESSION-01.md](docs/sessions/SESSION-01.md)|
| 02 | Public API: courts & slots           | [SESSION-02.md](docs/sessions/SESSION-02.md)|
| 03 | Booking creation API (atomic)        | [SESSION-03.md](docs/sessions/SESSION-03.md)|
| 04 | Customer landing page                | [SESSION-04.md](docs/sessions/SESSION-04.md)|
| 05 | Customer booking flow UI             | [SESSION-05.md](docs/sessions/SESSION-05.md)|
| 06 | Admin authentication                 | [SESSION-06.md](docs/sessions/SESSION-06.md)|
| 07 | Admin dashboard                      | [SESSION-07.md](docs/sessions/SESSION-07.md)|
| 08 | Admin bookings list & detail         | [SESSION-08.md](docs/sessions/SESSION-08.md)|
| 09 | Slot manager                         | [SESSION-09.md](docs/sessions/SESSION-09.md)|
| 10 | Polish, QA & deployment              | [SESSION-10.md](docs/sessions/SESSION-10.md)|

## Out of scope (bonus track)

These are deliberately deferred and live in their own follow-up sessions:

- **Payments** (MyFatoorah)
- **OTP verification** (4-digit SMS code)
- **Email/SMS booking confirmations** (Resend or Supabase email)
- **Recurring weekly bookings** for regulars
- **AI-driven slot rules** ("open every Tuesday 4–7 pm for the next month")
