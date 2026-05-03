import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { isAdminEmail } from "@/lib/auth";

const LOGIN_PATH = "/admin/login";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login page itself must be reachable without a session.
  if (pathname === LOGIN_PATH) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

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
