import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { jsonError } from "@/lib/api";
import {
  getRelyingParty,
  setChallengeCookie,
} from "@/lib/webauthn/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// No auth required: this is the start of a sign-in flow. We don't pin
// allowCredentials so the browser shows the user any passkey enrolled
// for this site (discoverable / "passkeys" UX). The browser asks the
// user, then signs the challenge with the chosen credential.
export async function POST() {
  const rp = getRelyingParty();

  let options;
  try {
    options = await generateAuthenticationOptions({
      rpID: rp.rpId,
      userVerification: "preferred",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "options_failed", 500);
  }

  setChallengeCookie("auth", { challenge: options.challenge });
  return NextResponse.json(options);
}
