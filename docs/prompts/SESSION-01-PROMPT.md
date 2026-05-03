# 🏗️ Session 01 — Project Setup & Supabase Schema

> **Paste this entire prompt into a fresh AI thread to start Session 1.**

## Context

I'm building a **sports court booking system** called **Smash Courts Kuwait** across 10 incremental sessions. This is **Session 1 of 10**. Each session ships one task and writes a markdown progress file.

**Tech stack (locked):** Next.js 14+ (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres + Auth)

**Brand (locked):**
- Primary `#0F766E` · Accent `#F59E0B` · Background `#F8FAFC` · Font Inter
- Business: Smash Courts Kuwait, Salmiya · Owner: Ahmed Al-Rashid

**Courts (seed):**
| Court | Sport | Capacity | Price/slot (KWD) |
|---|---|---|---|
| Padel Court 1 | padel | 4 | 8.000 |
| Padel Court 2 | padel | 4 | 8.000 |
| Tennis Court | tennis | 4 | 6.000 |
| Football Pitch | football | 10 | 15.000 |

Operating hours: 8 AM – 11 PM · Slot duration: 60 min · Booking window: 14 days.

---

## 🎯 Goal of Session 1

Stand up the Next.js project, connect Supabase, create the database schema, and seed the courts + 14 days of slots. **No UI yet.** By the end of this session, I can query courts and slots from the database and the schema is ready for every later session.

---

## ✅ Tasks

### 1. Scaffold the Next.js project
- `npx create-next-app@latest smash-courts --typescript --tailwind --app --eslint --src-dir`
- Install dependencies: `@supabase/supabase-js @supabase/ssr server-only`
- Configure Tailwind theme with brand colors in `tailwind.config.ts`:
  ```ts
  colors: {
    brand: { DEFAULT: '#0F766E', dark: '#0D5F58' },
    accent: { DEFAULT: '#F59E0B', dark: '#D97706' },
    bg: '#F8FAFC',
  }
  ```
- Add Inter font via `next/font` in `src/app/layout.tsx`

### 2. Set up Supabase
- Create a new Supabase project (instruct me clearly how to do this in the Supabase dashboard)
- Add `.env.local` with:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- Add `.env.local` to `.gitignore` (verify it's there)
- Create `src/lib/supabase/server.ts` (server client using service role) — wrap with `import 'server-only'`
- Create `src/lib/supabase/browser.ts` (browser client using anon key)

### 3. Run the database schema
Provide a single SQL migration file at `supabase/migrations/001_init.sql` containing:

```sql
-- Courts
create table courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null check (sport in ('padel', 'tennis', 'football')),
  description text,
  capacity int not null,
  price_per_slot numeric(10, 3) not null,
  slot_duration_minutes int default 60,
  is_active boolean default true,
  image_url text,
  created_at timestamptz default now()
);

-- Slots
create table slots (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed', 'booked')),
  unique(court_id, start_time)
);

-- Bookings
create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  court_id uuid not null references courts(id),
  slot_id uuid not null references slots(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  notes text,
  total_price numeric(10, 3) not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'completed', 'cancelled')),
  created_at timestamptz default now()
);

create index idx_slots_court_start on slots(court_id, start_time);
create index idx_bookings_created on bookings(created_at desc);
create index idx_bookings_slot on bookings(slot_id);

-- RLS
alter table courts enable row level security;
alter table slots enable row level security;
alter table bookings enable row level security;

-- Public read on courts and slots, no public access on bookings
create policy "public read courts" on courts for select using (true);
create policy "public read slots" on slots for select using (true);
-- bookings: no policies = no public access. Server uses service role.
```

### 4. Atomic booking function
Add to the same migration:

```sql
create or replace function create_booking(
  p_slot_id uuid,
  p_court_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_price numeric,
  p_reference text
) returns bookings as $$
declare
  v_booking bookings;
  v_updated int;
begin
  update slots set status = 'booked'
   where id = p_slot_id and status = 'open';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'slot_not_available';
  end if;

  insert into bookings (reference, court_id, slot_id, customer_name,
                        customer_phone, customer_email, notes, total_price)
  values (p_reference, p_court_id, p_slot_id, p_name, p_phone, p_email, p_notes, p_price)
  returning * into v_booking;

  return v_booking;
end;
$$ language plpgsql security definer;
```

### 5. Seed script
Create `scripts/seed.ts` that:
- Inserts the 4 courts above (idempotent — skip if already exist)
- Generates slots for the next 14 days, every hour from 08:00 to 22:00 inclusive (last slot 22:00 → 23:00) for every court
- All slots default to `status = 'open'`
- Logs `Seeded N courts and M slots`

Add `npm run seed` script in `package.json`.

### 6. Smoke-test API
Create one tiny test route `src/app/api/health/route.ts` that returns:
```json
{ "ok": true, "courts": <count>, "slots": <count> }
```
This proves the server can talk to Supabase.

---

## ✅ Acceptance criteria

- [ ] `npm run dev` starts the Next.js app on port 3000 with no errors
- [ ] `.env.local` exists with all three Supabase keys, and is gitignored
- [ ] Running the migration in Supabase SQL editor creates all 3 tables, indexes, RLS policies, and the `create_booking` function with no errors
- [ ] `npm run seed` populates 4 courts and ~840 slots (4 courts × 14 days × 15 slots), idempotent on re-run
- [ ] Visiting `http://localhost:3000/api/health` returns `{ "ok": true, "courts": 4, "slots": 840 }`
- [ ] Tailwind brand colors work: a test page using `bg-brand text-accent` renders correctly
- [ ] No service role key is imported into any client component (verify with grep)

---

## 📝 Deliverable: write `docs/sessions/SESSION-01.md`

After completing the tasks, create `docs/sessions/SESSION-01.md` with this exact structure:

```md
# Session 01 — Project Setup & Supabase Schema

## Goal
Stand up Next.js + Supabase, create schema, seed data.

## What was built
- [list every file/folder created]
- [list every Supabase table, function, policy]

## How to verify
1. `npm install`
2. Fill in `.env.local` with Supabase keys
3. Run migration `supabase/migrations/001_init.sql` in Supabase SQL editor
4. `npm run seed`
5. `npm run dev` → visit `/api/health` → expect `{ "ok": true, "courts": 4, "slots": 840 }`

## Decisions & trade-offs
[Why service role on server only, why slots are pre-generated vs computed on-the-fly, etc.]

## Known issues / TODO for later sessions
- No public APIs yet (Session 2)
- No booking creation API yet (Session 3)
- No UI yet (Session 4+)

## Files changed
[Full list]
```

---

## 🚫 Out of scope for this session
- Any UI components or pages beyond `/api/health`
- Booking creation logic in code (the SQL function is enough; the API route comes in Session 3)
- Auth (Session 6)
- Styling beyond Tailwind config

**When everything above is done and the MD file is written, stop and tell me Session 1 is complete.**
