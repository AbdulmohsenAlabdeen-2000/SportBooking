import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { jsonError } from "@/lib/api";
import { createCookieClient } from "@/lib/supabase/route";
import { createServerClient } from "@/lib/supabase/server";
import {
  getRelyingParty,
  setChallengeCookie,
} from "@/lib/webauthn/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("not_signed_in", 401);

  const supabase = createServerClient();
  const { data: existing, error: existingErr } = await supabase
    .from("passkey_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);
  if (existingErr) {
    if (existingErr.message.toLowerCase().includes("does not exist")) {
      return jsonError("passkey_table_missing", 500);
    }
    return jsonError(existingErr.message, 500);
  }

  const rp = getRelyingParty();

  // Decode the credential IDs we already have so the browser can skip
  // them — prevents enrolling the same authenticator twice.
  const excludeCredentials = (existing ?? []).map((row) => ({
    id: row.credential_id,
    transports: (row.transports ?? []) as AuthenticatorTransport[],
  }));

  const options = await generateRegistrationOptions({
    rpID: rp.rpId,
    rpName: rp.rpName,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.phone ?? user.id,
    userDisplayName: (user.user_metadata?.name as string | undefined) ?? "",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials,
  });

  setChallengeCookie("register", {
    challenge: options.challenge,
    userId: user.id,
  });

  return NextResponse.json(options);
}
