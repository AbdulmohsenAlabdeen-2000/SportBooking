import "server-only";
import { createHmac } from "node:crypto";

// Outgoing webhook dispatcher. Used to push booking + court lifecycle
// events to n8n (or any HMAC-signing webhook receiver). Best-effort:
// never throws, never blocks user-visible flows, and silently skips
// when N8N_WEBHOOK_URL isn't set so a customer can still complete a
// booking even if the integration is misconfigured.
//
// Required env vars (both, or none):
//   N8N_WEBHOOK_URL    — public POST endpoint for the n8n trigger
//   N8N_WEBHOOK_SECRET — random secret shared with n8n; used to
//                        compute the HMAC-SHA256 signature in the
//                        X-Smash-Signature header. n8n verifies this
//                        in a Code node before trusting the payload.
//
// Wire format:
//   POST <N8N_WEBHOOK_URL>
//   Content-Type: application/json
//   X-Smash-Event: <event-name>
//   X-Smash-Signature: sha256=<hex>          (HMAC over the raw JSON)
//   X-Smash-Timestamp: <ISO 8601>
//
//   { "event": "booking.confirmed", "ts": "...", "data": { ... } }

export type SmashEvent =
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.declined"
  | "booking.completed"
  | "court.created";

export type WebhookPayload = {
  event: SmashEvent;
  ts: string;
  data: Record<string, unknown>;
};

const TIMEOUT_MS = 5000;

export function isN8nConfigured(): boolean {
  return (
    !!process.env.N8N_WEBHOOK_URL && !!process.env.N8N_WEBHOOK_SECRET
  );
}

export async function dispatchWebhook(
  event: SmashEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url || !secret) {
    // Integration not configured — don't log noise, this is the
    // expected default state in dev / preview.
    return;
  }

  const payload: WebhookPayload = {
    event,
    ts: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smash-Event": event,
        "X-Smash-Signature": signature,
        "X-Smash-Timestamp": payload.ts,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[n8n] webhook returned non-2xx", {
        event,
        status: res.status,
      });
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    console.error("[n8n] webhook dispatch failed", { event, error: name });
  } finally {
    clearTimeout(timer);
  }
}
