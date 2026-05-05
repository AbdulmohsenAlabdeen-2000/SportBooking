import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { isAdminEmail } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/mode";

const LOGIN_PATH = "/admin/login";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login page itself must be reachable without a session.
  if (pathname === LOGIN_PATH) return NextResponse.next();

  // Demo mode skips all auth — there's no Supabase to talk to. The admin
  // pages render their own "Demo mode" notice instead of real data.
  if (isDemoMode()) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  // Admin MCP server: API-only Bearer-token bypass. Skips Supabase
  // entirely. The token is matched constant-time using a pure-JS XOR
  // compare so it works in Next.js' Edge runtime (which forbids
  // node:crypto). Mismatch returns 401 directly — no fall-through to
  // the cookie path, so we don't reveal whether the token is "wrong"
  // versus "missing".
  if (isApi) {
    const header = req.headers.get("authorization") ?? "";
    if (header.startsWith("Bearer ")) {
      const presented = header.slice("Bearer ".length).trim();
      const expected = process.env.ADMIN_MCP_TOKEN ?? "";
      if (expected.length > 0 && constantTimeEqual(presented, expected)) {
        return NextResponse.next();
      }
      return json401();
    }
  }

  const { supabase, response } = createMiddlewareClient(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return isApi ? json401() : redirectToLogin(req, pathname);
  }

  // Defence in depth: even with a valid session, only allowlisted emails get
  // through. The page-level requireAdmin() does this again on the server.
  const ok = await isAdminEmail(user.email);
  if (!ok) {
    if (isApi) return json401();
    await supabase.auth.signOut();
    return redirectToLogin(req, pathname, "not_authorized");
  }

  return response;
}

function json401() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// Length-checked XOR-OR compare. Same idea as node:crypto's
// timingSafeEqual but works in the Edge runtime (no node:* imports).
// Length mismatch returns false immediately — that itself leaks the
// length of the presented token, but the token's length is fixed and
// public anyway.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function redirectToLogin(
  req: NextRequest,
  intendedPath: string,
  errorCode?: string,
) {
  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = "";
  if (intendedPath && intendedPath !== "/admin") {
    url.searchParams.set("next", intendedPath);
  }
  if (errorCode) url.searchParams.set("error", errorCode);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
