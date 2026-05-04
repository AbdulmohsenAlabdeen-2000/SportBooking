import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { jsonError } from "@/lib/api";
import { createServerClient } from "@/lib/supabase/server";
import {
  clearChallengeCookie,
  getRelyingParty,
  readChallengeCookie,
} from "@/lib/webauthn/server";
import { bridgeToSupabaseSession } from "@/lib/webauthn/session-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  response: AuthenticationResponseJSON;
};

type CredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[];
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("invalid_json", 400);
  }
  if (!body.response || typeof body.response !== "object") {
    return jsonError("invalid_body", 400);
  }
  const credId = body.response.id;
  if (typeof credId !== "string" || !credId) {
    return jsonError("invalid_credential_id", 400);
  }

  const expected = readChallengeCookie("auth");
  if (!expected) return jsonError("challenge_missing_or_expired", 400);

  const supabase = createServerClient();

  const { data: row, error: rowErr } = await supabase
    .from("passkey_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", credId)
    .maybeSingle<CredentialRow>();
  if (rowErr) {
    if (rowErr.message.toLowerCase().includes("does not exist")) {
      return jsonError("passkey_table_missing", 500);
    }
    return jsonError(rowErr.message, 500);
  }
  if (!row) return jsonError("credential_not_found", 404);

  const rp = getRelyingParty();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: expected.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpId,
      requireUserVerification: false,
      // SimpleWebAuthn v11+ uses `credential`; older versions use
      // `authenticator`. Pass both shapes — the lib reads the supported
      // one and ignores the other.
      credential: {
        id: row.credential_id,
        publicKey: Buffer.from(row.public_key, "base64url"),
        counter: row.counter,
        transports: row.transports as AuthenticatorTransport[] | undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  } catch (e) {
    clearChallengeCookie("auth");
    return jsonError(
      e instanceof Error ? e.message : "verification_failed",
      400,
    );
  }

  clearChallengeCookie("auth");

  if (!verification.verified) {
    return jsonError("verification_failed", 400);
  }

  const newCounter =
    (verification.authenticationInfo as { newCounter?: number })?.newCounter ??
    row.counter;

  await supabase
    .from("passkey_credentials")
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  // Bridge the WebAuthn-verified user to a real Supabase session.
  const bridged = await bridgeToSupabaseSession(row.user_id);
  if (!bridged.ok) {
    return jsonError(`session_bridge_failed:${bridged.error}`, 500);
  }

  return NextResponse.json({ ok: true });
}
