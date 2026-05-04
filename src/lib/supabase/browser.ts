import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

// Cookie-backed browser client. Critical that this uses @supabase/ssr (not
// @supabase/supabase-js's plain createClient) — ssr writes the session to
// cookies, which is the same store the Next middleware reads via
// createMiddlewareClient. Mixing the two means signInWithPassword would
// succeed but middleware would see no session and bounce the user back to
// /admin/login, leaving the form stuck on "Signing in…".
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }

  return createSsrBrowserClient(url, key);
}
