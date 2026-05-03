import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import {
  createServerClient as createSsrServerClient,
  type CookieOptions,
} from "@supabase/ssr";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

// Builds a Supabase client wired to the middleware's request/response cookies
// so calls like getUser() refresh the session token and write the new cookies
// onto the outgoing response. Returns both the client and the response so
// callers can keep mutating headers/redirecting before returning.
export function createMiddlewareClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }

  let response = NextResponse.next({ request: req });

  const supabase = createSsrServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: CookieEntry[]) {
        for (const { name, value, options } of cookiesToSet) {
          req.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return { supabase, response };
}
