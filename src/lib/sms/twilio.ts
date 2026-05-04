import "server-only";

// Thin HTTP wrapper around Twilio's Messages API. We don't pull in
// twilio-node because all we need is one POST and basic-auth — keeping
// the bundle small and the surface area auditable.
//
// Required env vars (set in .env.local locally and on Vercel):
//   TWILIO_ACCOUNT_SID   — "ACxxxxxxxx..."
//   TWILIO_AUTH_TOKEN    — auth token for that account
//   TWILIO_FROM          — sender. Either an E.164 phone number ("+1...")
//                          OR a Messaging Service SID ("MGxxxxxxx...").
//
// On a Twilio trial account, only Verified Caller IDs receive SMS — the
// same constraint we hit during signup OTP. To unlock arbitrary Kuwait
// numbers, upgrade to a paid Twilio account.

type SendInput = {
  to: string; // E.164, e.g. "+96512345678"
  body: string;
};

export type SendResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; status?: number };

type TwilioConfig = {
  sid: string;
  token: string;
  from: string;
};

function readConfig(): TwilioConfig | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

export function isTwilioConfigured(): boolean {
  return readConfig() !== null;
}

// Normalize "12345678", "96512345678", or "+96512345678" to E.164 Kuwait.
// Returns null if it can't be made into something Twilio will accept.
export function toKuwaitE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) return `+965${digits}`;
  if (digits.length === 11 && digits.startsWith("965")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 9 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function sendTwilioSms({ to, body }: SendInput): Promise<SendResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: "twilio_not_configured" };

  const params = new URLSearchParams();
  params.set("To", to);
  // Messaging Service SIDs start with "MG"; phone numbers start with "+".
  if (cfg.from.startsWith("MG")) {
    params.set("MessagingServiceSid", cfg.from);
  } else {
    params.set("From", cfg.from);
  }
  params.set("Body", body);

  const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: text || `twilio_http_${res.status}`,
        status: res.status,
      };
    }
    const json = (await res.json().catch(() => ({}))) as { sid?: string };
    return { ok: true, sid: json.sid ?? "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "network_error",
    };
  }
}
