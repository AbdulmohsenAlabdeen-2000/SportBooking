import "server-only";
import { cookies } from "next/headers";
import {
  createServerClient as createSsrServerClient,
  type CookieOptions,
} from "@supabase/ssr";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

// Cookie-bound Supabase client for App Router Server Components and Route
// Handlers. Uses the **anon** key + the visitor's session cookies — i.e. it
// represents the logged-in user, not the service role.
export function createCookieClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  const store = cookies();
  return createSsrServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet: CookieEntry[]) {
        // In Server Components, set/remove are no-ops (Next forbids them).
        // In Route Handlers, they propagate to the response.
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component context — Next disallows mutation; safe to skip.
        }
      },
    },
  });
}
