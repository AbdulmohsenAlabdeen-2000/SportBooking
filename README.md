# 🏟️ Sports Court Booking System — 10-Session Build Plan

A production-grade booking system for **Smash Courts Kuwait** built incrementally across 10 focused sessions. Each session has one clear task, ships working code, and produces a markdown progress file.

## Tech Stack (locked across all sessions)
- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Styling:** Tailwind CSS, mobile-first (390px design target)
- **Backend:** Supabase (Postgres + Auth + RLS)
- **Hosting-ready:** environment variables for all secrets

## Brand (locked across all sessions)
- **Business:** Smash Courts Kuwait (Salmiya)
- **Owner:** Ahmed Al-Rashid
- **Primary color:** `#0F766E` (deep teal)
- **Accent color:** `#F59E0B` (amber)
- **Background:** `#F8FAFC`
- **Font:** Inter

## Courts (seed data, locked)
| Court | Sport | Capacity | Price/slot |
|---|---|---|---|
| Padel Court 1 | padel | 4 | 8.000 KWD |
| Padel Court 2 | padel | 4 | 8.000 KWD |
| Tennis Court | tennis | 4 | 6.000 KWD |
| Football Pitch | football | 10 | 15.000 KWD |

**Operating hours:** 8 AM – 11 PM daily · **Slot duration:** 60 min · **Booking window:** 14 days

---

## The 10 Sessions

| # | Session | Deliverable |
|---|---|---|
| 1 | Project setup & Supabase schema | DB live, seeded, `SESSION-01.md` |
| 2 | Public API: courts & slots | Read endpoints work via curl, `SESSION-02.md` |
| 3 | Booking creation API (atomic) | No double-bookings possible, `SESSION-03.md` |
| 4 | Customer landing page | Branded `/` at 390px, `SESSION-04.md` |
| 5 | Customer booking flow UI | Full picker → form → confirmation, `SESSION-05.md` |
| 6 | Admin auth | Login wall on `/admin`, `SESSION-06.md` |
| 7 | Admin dashboard | Today's bookings view, `SESSION-07.md` |
| 8 | Admin booking list & detail | Full bookings management, `SESSION-08.md` |
| 9 | Slot manager | Open/close/bulk-close slots, `SESSION-09.md` |
| 10 | Polish, QA & deployment | Mobile QA passed, deploy-ready, `SESSION-10.md` |

---

## Rules for every session
1. **Read the previous `SESSION-XX.md` file before starting** to understand what's already built.
2. **Do not break previous sessions' work.** If something needs changing, document why in the new MD.
3. **Persistence is mandatory.** Bookings must survive refresh and server restart.
4. **Mobile-first.** Verify at 390px in DevTools before declaring anything done.
5. **One session = one task.** Don't pull work forward from later sessions.
6. **Always end the session by writing `docs/sessions/SESSION-XX.md`** following the template at the bottom of each session prompt.

---

## Session MD file structure (every session writes one of these)

Path: `docs/sessions/SESSION-XX.md`

```md
# Session XX — [Session Title]

## Goal
[One sentence — what this session ships]

## What was built
- [Bullet list of files created/modified]
- [New routes, new components, new tables, new functions]

## How to verify
[Step-by-step manual test the next session can run to confirm this works]

## Decisions & trade-offs
[Anything non-obvious — why a library was chosen, why a shortcut was taken]

## Known issues / TODO for later sessions
[Things deliberately left for a later session]

## Files changed
[List of all files touched, with one-line descriptions]
```
