# Session 01 — Project Setup & Supabase Schema

## Goal
Stand up Next.js 14 + Supabase, create the database schema, and seed 4 courts + 14 days of hourly slots. No UI.

## What was built
- `package.json` — Next.js 14 (App Router, TypeScript, src dir), `@supabase/supabase-js`, `@supabase/ssr`, `server-only`
- `tailwind.config.ts` — brand palette (`brand`, `accent`, `bg`) + Inter
- `tsconfig.json` — `@/*` path alias to `./src/*`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` — minimal shell
- `src/lib/supabase/server.ts` — service-role client wrapped in `import 'server-only'`
- `src/lib/supabase/browser.ts` — anon-key browser client
- `src/app/api/health/route.ts` — `{ ok, courts, slots }` smoke-test endpoint
- `supabase/migrations/001_init.sql` — `courts`, `slots`, `bookings` tables; indexes; RLS (public read on courts/slots, no public access on bookings); `create_booking()` SECURITY DEFINER function
- `scripts/seed.ts` + `npm run seed` — idempotent seed for 4 courts and 14 × 15 = 210 slots per court (840 total)
- `.env.local.example` listing the three Supabase keys; `.env.local` gitignored

## How to verify
1. `npm install`
2. Fill `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Run `supabase/migrations/001_init.sql` in the Supabase SQL editor
4. `npm run seed` → expect `Seeded 4 courts and 840 slots`
5. `npm run dev` → `curl http://localhost:3000/api/health` → `{ "ok": true, "courts": 4, "slots": 840 }`

## Decisions & trade-offs
- **Service role on the server only.** `src/lib/supabase/server.ts` is wrapped with `import 'server-only'` so it can never accidentally land in a client bundle. RLS protects `bookings` for anyone going through the anon client.
- **Slots are pre-generated**, not computed on-the-fly. Simpler queries, easy to mark individual slots `closed`/`booked`, and the seed is idempotent on `(court_id, start_time)`.
- **Slot timestamps are stored in UTC** but represent Kuwait wall-clock hours (UTC+3, no DST). The seed converts a Kuwait date+hour to a UTC ISO string explicitly.
- **No external date library yet** — Session 2 will introduce one when timezone-aware date filtering is needed.

## Known issues / TODO for later sessions
- No public read APIs for courts/slots (Session 2)
- No booking creation API (Session 3)
- No customer UI (Session 4+)
- No admin auth or admin pages (Session 6+)
- Session 1 was committed without this MD — backfilled at the start of Session 2.

## Files changed
- `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`
- `src/app/api/health/route.ts`
- `supabase/migrations/001_init.sql`
- `scripts/seed.ts`
- `.env.local.example`, `.gitignore`
