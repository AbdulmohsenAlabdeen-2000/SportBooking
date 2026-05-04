import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/supabase/route";

// After WebAuthn verifies a user, we still need a Supabase session
// (cookies the @supabase/ssr server clients can read) so the rest of
// the app — /me, requireCustomer(), bookings linking — keeps working
// unchanged.
//
// Approach: ask Supabase to mint us a session for this user via the
// admin generateLink API. Supabase v2 only lets `magiclink` take an
// email, so phone-only accounts get a stable stub email written to
// auth.users on first passkey login. The action_link redirects with
// access_token + refresh_token in the fragment; we parse them and
// hand them to setSession() which writes the cookies on the response.

type BridgeResult =
  | { ok: true }
  | { ok: false; error: string };

const STUB_EMAIL_DOMAIN = "passkey.smashcourts.kw";

function stubEmailFor(userId: string): string {
  return `${userId}@${STUB_EMAIL_DOMAIN}`;
}

export async function bridgeToSupabaseSession(
  userId: string,
): Promise<BridgeResult> {
  const supabase = createServerClient();

  // Look up the user. If they don't have an email, set a stub so the
  // magiclink generator has something to bind to. The stub never reaches
  // a real inbox — generateLink returns the link directly to us, the
  // client never navigates to it via email.
  const { data: userData, error: userErr } =
    await supabase.auth.admin.getUserById(userId);
  if (userErr || !userData.user) {
    return { ok: false, error: userErr?.message ?? "user_not_found" };
  }

  let email = userData.user.email ?? "";
  if (!email) {
    email = stubEmailFor(userId);
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (updErr) {
      return { ok: false, error: `set_stub_email_failed: ${updErr.message}` };
    }
  }

  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  if (linkErr || !linkData?.properties?.action_link) {
    return {
      ok: false,
      error: linkErr?.message ?? "no_action_link",
    };
  }

  // Follow the action_link manually so we can grab the redirect URL
  // out of the Location header. The redirect target carries the tokens
  // in the URL fragment (#access_token=...&refresh_token=...).
  let redirectLocation: string | null = null;
  try {
    const verifyRes = await fetch(linkData.properties.action_link, {
      redirect: "manual",
    });
    redirectLocation = verifyRes.headers.get("location");
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "verify_fetch_failed",
    };
  }
  if (!redirectLocation) {
    return { ok: false, error: "no_redirect_location" };
  }

  const fragmentIndex = redirectLocation.indexOf("#");
  if (fragmentIndex === -1) {
    return { ok: false, error: "no_token_fragment" };
  }
  const params = new URLSearchParams(redirectLocation.slice(fragmentIndex + 1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    const err = params.get("error_description") ?? params.get("error");
    return { ok: false, error: err ?? "tokens_missing" };
  }

  // setSession writes the auth cookies onto the outgoing Response.
  const cookieClient = createCookieClient();
  const { error: setErr } = await cookieClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (setErr) {
    return { ok: false, error: setErr.message };
  }

  return { ok: true };
}
