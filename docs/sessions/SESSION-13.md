# Session 13 — Motion Polish + Fantastic Welcome

## Goal
Bring the customer surfaces to life with tasteful motion (drifting sports glyphs, scroll reveals, button micro-interactions, animated stat counters), keep admin pages tool-first with only subtle hover polish, and re-cast the landing page as a real welcome moment.

## What was built

### Motion primitives
- **Tailwind config** — added keyframes/animations: `float-slow / float-medium / float-fast` (decorative drifting), `reveal-up` (section entrance). All consumer-side use `motion-reduce:` overrides.
- **`FloatingSportsBg`** — pure-SVG decorative background. Five sports glyphs (two padel rackets, tennis ball, football, badminton shuttle) absolute-positioned with staggered `animation-delay` so they drift independently. Hidden under `motion-reduce` so accessibility-conscious users see a static gradient.
- **`RevealOnScroll`** — wraps children in an opacity-0/translate-y-4 starting state, flips `data-revealed=true` once 15% of the wrapper hits the viewport (via `IntersectionObserver`, no scroll listener). Optional `delay` prop. Respects `prefers-reduced-motion` by skipping the observer entirely.

### "Fantastic" welcome (hero + stats)
- **`Hero` rebuilt:**
  - Top badge: ⚡-stamped "Open daily · 8 AM – 11 PM" pill on translucent glass.
  - 4xl → 7xl gradient headline ("Play today." in accent→amber-300 gradient).
  - Sub-copy widened (Salmiya, sport list, 1-min booking).
  - Sport pills row: Padel / Tennis / Football / Open till 11 PM.
  - Two CTAs: amber primary "Book a Court" with `shadow-lg` + accent glow, plus a quiet "I have an account" → `/login`.
  - Off-screen blurred halo top-right for depth.
  - Every element animates in with staggered `animate-reveal-up` delays (0/80/160/240/320 ms).
- **`StatsStrip` (new section)** — sits between Hero and Why. Four tiles with brand-tinted icons:
  - 4 Pro courts
  - 14d booking window
  - 15h open per day
  - 60s average booking
- Each value **counts up from 0** with cubic-easing once the strip enters view; skips the count-up under reduced motion. Hover lift + `shadow-md` per tile.

### Customer landing motion
- `WhySmash` feature cards: hover lift + icon scales `110%` on hover.
- `OurCourts` cards: hover lift `-translate-y-1` + `shadow-lg`, sport-icon block scales `105%` on hover, press-in `scale-[0.99]` on click.
- `FinalCTA`: arrow nudges right via `group-hover:translate-x-0.5`, button lifts on hover and presses in on click.

### Customer-wide button primitive
- `Button` / `ButtonLink`: every primary/secondary/ghost variant now lifts (`hover:-translate-y-0.5 hover:shadow-md`) and presses in (`active:scale-[0.98]`). Booking-flow forms inherit this for free.

### Scroll reveals
- `WhySmash`, `OurCourts`, `HowItWorks`, `FinalCTA` each wrapped in `<RevealOnScroll>` so they fade in as the visitor scrolls past.

### Admin subtle polish
Kept deliberately quiet — admin is a tool. Only:
- Dashboard `StatCard`: `hover:shadow-md` transition. **No** transforms, no decorative backgrounds, no scroll reveals, no entrance animations on tables. The slot grid, bookings table, and forms remain untouched.

### Accessibility
- Every animation is paired with `motion-reduce:transform-none` or `motion-reduce:transition-none`.
- `RevealOnScroll` and `useCountOnVisible` both check `prefers-reduced-motion` and short-circuit.
- Floating sports background uses `motion-reduce:hidden` so the static gradient remains.

## How to verify
1. Hard-reload http://localhost:3000.
2. **Hero**: badge fades in first, then headline (gradient on "Play today."), sub-copy, sport pills, CTAs. Sports icons drift in the background.
3. **StatsStrip**: four numbers count from 0 to their target as the strip scrolls into view.
4. **Sections fade up** (Why, Courts, How, Final CTA) one by one as you scroll.
5. **Hover the Book a Court CTA** — lifts, glow brightens. **Press it** — presses in slightly. Same on the Final CTA and any Button primitive in the booking flow.
6. **Court cards on landing** — lift on hover, sport-icon block scales up; click presses in.
7. **Admin (`/admin`)** — stat cards get a subtle shadow on hover. No floating sports, no scroll reveals — admin stays tool-first.
8. **Reduced motion test**: in macOS System Settings → Accessibility → Display → "Reduce motion" ON. Reload `/`. Floating bg disappears, hero animates instantly without staging, scroll reveals are immediate, stats show final values without counting, buttons keep color transitions only.

## Decisions & trade-offs
- **Motion only on customer-facing pages.** Admins are working — decoration would distract. The dashboard gets only a hover shadow on stat tiles, nothing more.
- **Pure CSS + IntersectionObserver, no Framer Motion.** Adding ~30 KB of motion library for what we needed (entrance reveals, scale on hover, count-up) wasn't justified. Tailwind's keyframes plus a 30-line `RevealOnScroll` component does the job.
- **`prefers-reduced-motion` everywhere.** Every keyframe has a `motion-reduce:` escape hatch. The floating background uses `motion-reduce:hidden` (static gradient stays); reveals fall back to immediate render; counters jump to the final value.
- **Hero gets two CTAs now.** Adding "I have an account" → `/login` reduces the friction for returning customers who'd otherwise have to scroll, click "Book", then log in mid-flow.
- **Stats are static-coded, not DB-driven.** "14d booking window" / "15h open" / "4 courts" come from `BOOKING_WINDOW_DAYS`, the slot hours range, and the seeded courts. Hard-coding for now; once admin courts CRUD lets the count vary, we can fetch `count(*)` from `/api/courts` and bind the stat tile to it.
- **No "Trusted by N players" social proof yet.** Genuine numbers only when there are genuine numbers. We could fake-pad ("hundreds of bookings") but that's the kind of trust-eroding shortcut I'd rather skip.

## Known issues / TODO
- Real photos for courts (still icon placeholders) — biggest remaining visual upgrade.
- The bouncing-out reveal animation could ease back slightly for "playful" feel; current is straight ease-out for trust.
- `Button` primitive is now used by the booking-flow form CTAs but `/me`'s sticky bottom bar uses inline classes — could refactor to use `Button` everywhere for consistency.

## Files changed
- `tailwind.config.ts` — keyframes + animations
- `src/components/landing/FloatingSportsBg.tsx` (new)
- `src/components/RevealOnScroll.tsx` (new)
- `src/components/landing/StatsStrip.tsx` (new)
- `src/components/landing/Hero.tsx` — full rebuild
- `src/components/landing/WhySmash.tsx` — hover polish
- `src/components/landing/OurCourts.tsx` — hover polish
- `src/components/landing/FinalCTA.tsx` — button polish
- `src/components/ui/Button.tsx` — base classes get lift + press
- `src/app/(customer)/page.tsx` — `<StatsStrip />` + reveal wrappers
- `src/app/(admin)/admin/page.tsx` — StatCard hover:shadow-md
