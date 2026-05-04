import "server-only";

import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// WebAuthn relying-party config. The RP ID is the registrable domain
// (no protocol, no port). Passkeys bind to this — credentials enrolled
// on one origin are NOT usable on another even if both serve the same
// app. We derive it from the request host so the same code works in
// dev (localhost), preview deployments, and the production domain.

export type RpInfo = {
  rpId: string;
  rpName: string;
  origin: string;
};

export function getRelyingParty(): RpInfo {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  // Strip the port for the RP ID — WebAuthn ignores ports anyway.
  const rpId = host.split(":")[0];
  return {
    rpId,
    rpName: "Smash Courts Kuwait",
    origin,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Challenge handling.
//
// Challenges are issued by /begin endpoints and verified by /finish
// endpoints. We don't want a database round-trip just for ephemeral
// challenges, so we store them in a short-lived signed cookie. The
// cookie is HMAC-signed with the Supabase service role key so it
// can't be forged client-side.

const CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes — generous for biometric prompts

export type ChallengeKind = "register" | "auth";

const COOKIE_NAME_BY_KIND: Record<ChallengeKind, string> = {
  register: "smash-pk-register-challenge",
  auth: "smash-pk-auth-challenge",
};

function signingKey(): string {
  // Reusing the service role key as the HMAC key is fine — it's already
  // server-only and any leak would compromise much more than this cookie.
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY required for challenge signing");
  return k;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type ChallengePayload = {
  challenge: string; // base64url
  userId?: string; // for register, scope to that user
  exp: number; // unix seconds
};

export function setChallengeCookie(
  kind: ChallengeKind,
  payload: Omit<ChallengePayload, "exp">,
): void {
  const full: ChallengePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
  };
  const json = JSON.stringify(full);
  const value = `${Buffer.from(json).toString("base64url")}.${sign(json)}`;
  cookies().set(COOKIE_NAME_BY_KIND[kind], value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export function readChallengeCookie(
  kind: ChallengeKind,
): ChallengePayload | null {
  const raw = cookies().get(COOKIE_NAME_BY_KIND[kind])?.value;
  if (!raw) return null;
  const [b64, sig] = raw.split(".");
  if (!b64 || !sig) return null;
  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!safeEqual(sig, sign(json))) return null;
  try {
    const parsed = JSON.parse(json) as ChallengePayload;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearChallengeCookie(kind: ChallengeKind): void {
  cookies().delete(COOKIE_NAME_BY_KIND[kind]);
}
