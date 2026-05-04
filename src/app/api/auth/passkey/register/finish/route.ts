import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { jsonError } from "@/lib/api";
import { createCookieClient } from "@/lib/supabase/route";
import { createServerClient } from "@/lib/supabase/server";
import {
  clearChallengeCookie,
  getRelyingParty,
  readChallengeCookie,
} from "@/lib/webauthn/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  response: RegistrationResponseJSON;
  // Optional friendly name. Falls back to a UA-derived stub.
  name?: string;
};

export async function POST(req: Request) {
  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("not_signed_in", 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("invalid_json", 400);
  }
  if (!body.response || typeof body.response !== "object") {
    return jsonError("invalid_body", 400);
  }

  const expected = readChallengeCookie("register");
  if (!expected) return jsonError("challenge_missing_or_expired", 400);
  if (expected.userId !== user.id) return jsonError("challenge_user_mismatch", 400);

  const rp = getRelyingParty();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: expected.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpId,
      requireUserVerification: false,
    });
  } catch (e) {
    clearChallengeCookie("register");
    return jsonError(
      e instanceof Error ? e.message : "verification_failed",
      400,
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    clearChallengeCookie("register");
    return jsonError("verification_failed", 400);
  }

  const info = verification.registrationInfo;
  // SimpleWebAuthn v11+ groups credential fields under `credential`; older
  // versions exposed them at the top level. Read both shapes defensively.
  const credentialID =
    (info as unknown as { credential?: { id: string } }).credential?.id ??
    (info as unknown as { credentialID: string }).credentialID;
  const credentialPublicKey =
    (info as unknown as { credential?: { publicKey: Uint8Array } }).credential
      ?.publicKey ??
    (info as unknown as { credentialPublicKey: Uint8Array }).credentialPublicKey;
  const counter =
    (info as unknown as { credential?: { counter: number } }).credential
      ?.counter ?? (info as unknown as { counter: number }).counter ?? 0;

  if (!credentialID || !credentialPublicKey) {
    clearChallengeCookie("register");
    return jsonError("verification_missing_credential", 500);
  }

  const supabase = createServerClient();
  const transports = (body.response.response?.transports ?? []) as string[];

  const { error: insertErr } = await supabase.from("passkey_credentials").insert({
    user_id: user.id,
    credential_id: credentialID,
    public_key: Buffer.from(credentialPublicKey).toString("base64url"),
    counter,
    transports,
    name: body.name?.trim() || derivePasskeyName(req),
  });

  clearChallengeCookie("register");

  if (insertErr) {
    if (insertErr.message.toLowerCase().includes("duplicate")) {
      return jsonError("passkey_already_registered", 409);
    }
    if (insertErr.message.toLowerCase().includes("does not exist")) {
      return jsonError("passkey_table_missing", 500);
    }
    return jsonError(insertErr.message, 500);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

function derivePasskeyName(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  return "Passkey";
}
