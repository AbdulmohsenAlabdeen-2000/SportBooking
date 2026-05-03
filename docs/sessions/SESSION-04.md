# Session 04 — Customer Landing Page

## Goal
Branded, mobile-first landing page at `/` showing the 4 courts as live data from `/api/courts`. No booking flow yet — that's Session 5.

## What was built
- **Route groups**: `src/app/(customer)/` and `src/app/(admin)/` — both groups don't appear in URLs, so the customer landing still serves `/` and Sessions 6-9 will build under `/admin/*` from `(admin)`.
- **Root layout** (`src/app/layout.tsx`) — `<html>`, `<body className="bg-bg font-sans">`, Inter wired via `--font-inter` (Tailwind's `font-sans` reads the variable so utility classes also pick up Inter), full metadata + openGraph.
- **Customer layout** (`src/app/(customer)/layout.tsx`):
  - Sticky 64px header with white/95 background and a backdrop blur, brand logo (teal disc + "S") on the left, a tap-target phone link on the right (icon-only on mobile, full `+965 9999 8888` on `md+`).
  - Footer in `bg-brand-dark` with address, phone, `@smashcourtskw`, and copyright.
- **Admin layout** (`src/app/(admin)/layout.tsx`) — placeholder so the route group is reserved before Sessions 6-9.
- **UI primitives** (`src/components/ui/`):
  - `Button.tsx` — `primary` (amber), `secondary` (brand-fill), `ghost` (white outline). Min-height 44px, focus ring. Companion `ButtonLink` emits a Next `<Link>` with the same styling.
  - `Card.tsx` — `rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70`.
  - `Container.tsx` — `mx-auto w-full max-w-6xl px-4 md:px-6`.
- **Landing page sections** (`src/components/landing/`):
  - `Hero.tsx` — brand-teal gradient, decorative court-line SVG, big H1, full-width amber CTA on mobile / auto-width on `md+`, → `/book`.
  - `WhySmash.tsx` — three feature cards (Zap / Trophy / Calendar).
  - `OurCourts.tsx` — Server Component fetching `/api/courts` with `cache: 'no-store'`. Wrapped in `<Suspense>` with a 4-card skeleton; gracefully falls back to a "Courts loading…" card if the fetch errors. Each card is a `<Link>` to `/book?court=<id>`. Sport icon (Activity / CircleDot / LandPlot) on a soft teal block.
  - `HowItWorks.tsx` — three numbered steps in brand-teal circles.
  - `FinalCTA.tsx` — amber section, "Ready to play?" + Book button.
- **Page** (`src/app/(customer)/page.tsx`) — composition only.
- **Favicon** at `src/app/icon.svg` — teal disc with white "S".
- **Tailwind tweak** (`tailwind.config.ts`) — `fontFamily.sans` now starts with `var(--font-inter)` so utilities use Inter when the layout sets the variable.

## How to verify
1. `npm run dev` → http://localhost:3000.
2. Open DevTools, set device to iPhone 14 (390×844). Confirm:
   - Hero headline + subhead + amber CTA all visible without scrolling.
   - No horizontal scroll on any section as you drag the resizer.
   - Tap targets ≥ 44px (header phone, CTAs, court cards).
3. With `.env.local` set and the migration + seed run (Session 1):
   - The "Our Courts" section shows the four real courts.
   - Change a court name in Supabase Studio → refresh → the new name appears (proves `cache: 'no-store'`).
4. With Supabase down or env missing: page still renders. The Courts section shows "Courts loading…" instead of crashing.
5. Resize past 768px (tablet) and 1280px (desktop) — features go from stacked to 3-up, courts from 1-up → 2-up → 4-up.

## Decisions & trade-offs
- **Server Component fetch over direct Supabase call.** The Session 4 spec calls for `fetch('/api/courts', { cache: 'no-store' })`, so `OurCourts` builds an absolute URL from `next/headers` (`x-forwarded-host` / `x-forwarded-proto` aware) and goes through the public API. Slight overhead vs. importing the server client directly, but the route is the contract Session 5's date picker will already need to consume.
- **Route groups, not subdomains or separate apps.** One Next app, one deploy. The `(customer)` and `(admin)` groups give us isolated layouts without duplicating the build pipeline. Auth in Session 6 will gate `(admin)` via middleware, not via a separate process.
- **SVG icons (lucide-react) over photography.** Keeps the design consistent at every breakpoint, ships nothing in the image budget, and skips the licensing decision until we have real photos. Soft brand-teal blocks behind each icon stand in for sport-specific imagery.
- **Inter via CSS variable, not `inter.className` on the body.** Setting `--font-inter` on `<html>` lets Tailwind's `font-sans` pick it up (config references `var(--font-inter)`), so any component using `font-sans` utilities also gets Inter.
- **Graceful fallback inside the component, not via `error.tsx`.** A page-wide error boundary would replace everything below the hero with the error UI. Catching the fetch failure inside `<CourtsList>` keeps Hero + Why + How + Final CTA on screen even when the API is down.

## Known issues / TODO for later sessions
- `/book` returns 404 — Session 5 builds the booking flow (date picker → slot grid → form → confirmation).
- `/admin` returns 404 — Session 6 wires the admin auth wall on top of `(admin)`.
- No real court images yet — Session 10 polish.
- Lighthouse not yet measured. The build is dynamic-rendered (`/api/courts` is `cache: 'no-store'`) so the score will depend on Supabase latency in the deployed environment.

## Files changed
- `src/app/layout.tsx` (modified) — body classes + metadata + Inter variable
- `src/app/(customer)/layout.tsx` (new) — header + footer
- `src/app/(customer)/page.tsx` (moved + rewritten) — section composition
- `src/app/(admin)/layout.tsx` (new) — placeholder
- `src/app/icon.svg` (new) — favicon
- `src/components/ui/Button.tsx`, `Card.tsx`, `Container.tsx` (new)
- `src/components/landing/Hero.tsx`, `WhySmash.tsx`, `OurCourts.tsx`, `HowItWorks.tsx`, `FinalCTA.tsx` (new)
- `tailwind.config.ts` (modified) — `var(--font-inter)` first in `fontFamily.sans`
- `package.json` (modified) — added `lucide-react`
