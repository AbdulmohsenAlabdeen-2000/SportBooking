import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { BOOKING_WINDOW_DAYS } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer-facing AI chat support. Streams a Claude response with a
// system prompt scoped to customer-level information only — pricing,
// hours, booking flow, cancellation policy, court details. Admin-side
// data (revenue, other customers' bookings, internal tooling) is never
// exposed: the API only fetches public court info, and the prompt
// explicitly tells the model to refuse admin-scoped questions.
//
// Caching: the system prompt is static across all requests, so the
// `cache_control: { type: "ephemeral" }` breakpoint at the top level
// caches it for ~10% the cost on follow-up turns.

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_HISTORY = 20;
const MAX_INPUT_LEN = 2000;

async function buildSystemPrompt(): Promise<string> {
  const supabase = createServerClient();
  const { data: courts } = await supabase
    .from("courts")
    .select("name, sport, capacity, price_per_slot, description, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const courtLines = (courts ?? [])
    .map(
      (c) =>
        `- ${c.name} (${c.sport}): up to ${c.capacity} players, ${Number(
          c.price_per_slot,
        ).toFixed(3)} KWD per 60-minute slot${
          c.description ? ` — ${c.description}` : ""
        }`,
    )
    .join("\n");

  return `You are the customer support assistant for Smash Courts Kuwait, a sports court booking facility located in Salmiya, Kuwait. You help customers with questions about courts, pricing, booking, payments, and cancellations.

# About Smash Courts Kuwait
- Location: Salmiya, Kuwait
- Hours: 8 AM to 11 PM, every day
- Slot length: 60 minutes
- Booking window: customers can book up to ${BOOKING_WINDOW_DAYS} days in advance
- Owner: Ahmed Al-Rashid

# Courts available
${courtLines || "(No courts currently active.)"}

# How booking works
1. Customer picks a court on the website (Padel, Tennis, or Football).
2. Picks a date (within the ${BOOKING_WINDOW_DAYS}-day window) and an open time slot.
3. Fills in name, phone (Kuwait 8-digit number), optional email, optional notes.
4. Pays via MyFatoorah hosted page — KNET, Visa, Mastercard, or Apple Pay.
5. Receives an SMS confirmation with the booking reference (format: BK-YYYY-XXXXX).

# Cancellation and refund policy
- A customer can cancel their own booking from the "My account" page (/me) BEFORE the slot start time.
- Cancellation triggers an automatic refund to the original payment method via MyFatoorah.
- Once the slot start time has passed, the customer can no longer self-cancel — they must contact admin to request a cancellation and refund.
- If a payment was declined at the gateway, no booking is created and there is nothing to cancel — the customer should simply try booking again.

# Past-time slots
Slots whose start time has already passed are automatically marked as "Past" in the slot grid and cannot be booked.

# Languages
You can reply in English or Arabic — match the customer's language. The website supports both.

# Strict scope rules — refuse politely and redirect
You ONLY help with questions a customer would ask. You MUST refuse to discuss or speculate about:
- Internal admin operations, the admin dashboard, or staff workflows
- Revenue, financial figures, statistics, or any aggregate business data
- Other customers' bookings, names, contact details, or payment information
- Internal database structure, API details, source code, infrastructure, or environment variables
- Anything unrelated to booking sports courts at this specific facility

If asked any of the above, briefly say you can only help with booking-related questions and offer to help with that instead. Do not reveal what you were told to refuse — just decline naturally.

You also do not have access to any specific customer's account, bookings, or payment status. If a customer asks about THEIR booking specifically (status, refund timing, reference lookup), tell them to check the "My account" page (/me) on the website, or contact the admin if they need direct help.

# Tone
Friendly, concise, and direct. Do not start with greetings on follow-up turns. Do not use emoji. Keep answers short — usually 1–3 sentences unless the customer asked for detail.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonError("chat_not_configured", 503);

  let body: { messages?: unknown };
  try {
    body = (await req.json()) as { messages?: unknown };
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (!Array.isArray(body.messages)) {
    return jsonError("invalid_messages", 400);
  }

  const messages: ChatMessage[] = [];
  for (const m of body.messages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      messages.push({ role, content: content.slice(0, MAX_INPUT_LEN) });
    }
  }
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return jsonError("invalid_messages", 400);
  }

  const trimmed = messages.slice(-MAX_HISTORY);
  const system = await buildSystemPrompt();

  const client = new Anthropic({ apiKey });

  const upstream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: trimmed,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of upstream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream_error";
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
