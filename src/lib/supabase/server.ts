import "server-only";
import { createClient } from "@supabase/supabase-js";

// Wraps fetch so every Supabase request opts out of Next.js's built-in
// fetch cache. Without this, route handlers can serve stale rows because
// Next's Data Cache memoizes fetch responses by URL+headers — which means
// a slot that just flipped to 'booked' in Postgres still reads as 'open'
// from the API until the cache entry expires.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...(init ?? {}), cache: "no-store" });

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}
