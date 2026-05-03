# Session 06 — Admin Authentication

## Goal
Lock `/admin/*` behind Supabase Auth + a DB allowlist; build the admin shell layout.

## What was built
- **Migration** `supabase/migrations/002_admin_emails.sql` — `admin_emails(email pk, created_at)`. RLS enabled with no policies; only the service-role client can read. Seed instruction included.
- **Cookie-bound Supabase clients** for App Router contexts:
  - `src/lib/supabase/route.ts` — server client for Server Components and Route Handlers (`createCookieClient()`).
  - `src/lib/supabase/middleware.ts` — request/response-cookie-bound client for middleware (`createMiddlewareClient(req)`).
- **`src/lib/auth.ts`**:
  - `requireAdmin()` — redirects to `/admin/login` if not authorized.
  - `getCurrentAdmin()` — soft variant; returns null instead of redirecting.
  - `isAdminEmail(email)` — service-role lookup against `admin_emails`.
- **`src/middleware.ts`** — matcher `/admin/:path*`, lets `/admin/login` pass through, redirects to `/admin/login?next=…` when no session, signs the user out and redirects with `?error=not_authorized` when the session belongs to a non-allowlisted email.
- **`/admin/login`** at `src/app/admin/login/page.tsx` — deliberately outside the `(admin)` route group so it doesn't inherit the admin shell. Dark slate background, centered white card, slate-800 sign-in button (no amber). Uses `supabase.auth.signInWithPassword` then `router.replace`. Generic "Invalid login" message for bad credentials. Surfaces `?error=not_authorized` from the middleware as a banner. Wraps `useSearchParams` in `<Suspense>` so the page's prerender doesn't bail.
- **`(admin)/layout.tsx`** — server-side `requireAdmin()` check, sticky white top bar with the user's email and a `<SignOutButton>`, sidebar nav on `≥md`, fixed bottom nav on `<md`. `dynamic = "force-dynamic"` because the layout depends on the cookie session.
- **`(admin)/admin/page.tsx`** — placeholder dashboard at `/admin`. Shows "Welcome, {email}". Real dashboard ships in Session 7.
- **`AdminNav`** (`src/components/admin/AdminNav.tsx`) — `<AdminSidebar>` + `<AdminBottomNav>` client components reading `usePathname` to highlight the active link.
- **`SignOutButton`** (`src/components/admin/SignOutButton.tsx`) — calls `supabase.auth.signOut()` then `router.replace('/admin/login')` + `router.refresh()` so the middleware reruns and the back-button cache can't sneak you back into `/admin`.

## How to verify
1. **One-time Supabase setup:**
   - Authentication → Users → Add user → email + password.
   - SQL editor: `insert into admin_emails (email) values ('your@email');`
2. `npm run dev`, visit `http://localhost:3000/admin`. Expect a redirect to `/admin/login?next=/admin`.
3. Sign in. Expect `/admin` showing "Welcome, {email}", with the admin shell (top bar + sidebar / bottom nav).
4. Refresh `/admin` — still logged in (cookies persist).
5. Click **Sign out** — back to `/admin/login`. Visit `/admin` again — redirect.
6. Sign in with a Supabase Auth user whose email is **not** in `admin_emails` — expect `/admin/login?error=not_authorized` with the banner.
7. Visit `/admin/login` while already signed in — currently this still renders the login form (acceptable per the spec; future improvement: redirect to `/admin`).
8. Mobile (390px): sidebar hidden, bottom nav fixed. Desktop (`≥md`): sidebar visible, top bar shows email + Sign out.
9. Customer flow (`/`, `/book`, etc.) is unchanged.
10. `npm run build` is clean. `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/` only matches `src/lib/supabase/server.ts` and `src/lib/auth.ts`, both `import "server-only"`.

## Decisions & trade-offs
- **DB allowlist over env-var allowlist (Option B).** A `ADMIN_EMAILS` env split is fine for one admin, but adding a second admin requires a redeploy. The DB table lets the existing admin grant access to a teammate without touching code, and integrates naturally with the slot/booking-management UIs in Sessions 7–9.
- **Middleware + page-level `requireAdmin()`.** Defence-in-depth: if a future matcher tweak accidentally exposes a route, the page's server-side `requireAdmin()` still bounces. Two checks for one log-in is cheap (it's a single indexed lookup) and the cost of a leaked admin page is high.
- **Sidebar on desktop, bottom nav on mobile.** A sidebar at 390px would steal half the viewport. Bottom nav matches what the customer flow already uses (sticky bottom bars in steps 2 and 3), so admins on a phone get a familiar pattern.
- **Login page outside `(admin)` route group.** Keeps it from inheriting the admin shell layout. Trying to do this with conditional rendering inside the shell would force the layout to read pathname (only available client-side or via `headers()`), and would still cost a `requireAdmin()` redirect.
- **`signInWithPassword` on the client.** Simpler than implementing a `/api/admin/login` route. The cookie set by `@supabase/ssr` is httpOnly + secure, so the credentials never leave the page boundary as a long-lived token.

## Known issues / TODO for later sessions
- The dashboard is a placeholder — Session 7 fills it.
- Bookings list & detail — Session 8.
- Slot manager — Session 9.
- A logged-in admin visiting `/admin/login` still sees the login page; should redirect to `/admin`. Trivial follow-up.
- No password reset flow yet (Supabase has built-in if needed later).
- No CSRF on the sign-out POST (Supabase uses cookies, the action is idempotent, low blast radius — fine for now).

## Files changed
- `supabase/migrations/002_admin_emails.sql` (new)
- `src/lib/supabase/route.ts` (new)
- `src/lib/supabase/middleware.ts` (new)
- `src/lib/auth.ts` (new)
- `src/middleware.ts` (new)
- `src/app/admin/login/page.tsx` (new)
- `src/app/(admin)/layout.tsx` (rewritten — was placeholder)
- `src/app/(admin)/admin/page.tsx` (new)
- `src/components/admin/AdminNav.tsx` (new)
- `src/components/admin/SignOutButton.tsx` (new)
