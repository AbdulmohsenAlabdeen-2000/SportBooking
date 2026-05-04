import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { sendBookingConfirmationSms } from "@/lib/sms/booking-confirmation";
import { isSupportedLocale, type Locale } from "@/lib/i18n/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// MyFatoorah webhooks. Configured in MyFatoorah portal → Integration
// Settings → Webhooks → URL: https://<your-domain>/api/payments/webhook
//
// MyFatoorah sends the JSON body and signs it with HMAC SHA-256 using
// the webhook secret you copy from the same portal page. The signature
// is in the `MyFatoorah-Signature` header. We verify the signature
// before trusting any state from the request.
//
// Webhook event types we handle:
//   "TransactionsStatusChanged" — payment moved to Paid / Failed.
//   "RefundStatusChanged"       — refund finalized.

type Event = {
  EventType: number; // 1 = TransactionsStatusChanged, 2 = RefundStatusChanged
  Event: string;
  CountryIsoCode: string;
  DateTime: string;
  Data: WebhookData;
};

type WebhookData = {
  InvoiceId?: number;
  InvoiceReference?: string;
  CustomerReference?: string;
  TransactionStatus?: string; // "Succss" (typo intended by MF), "Failed"
  PaymentMethod?: string;
  GatewayReference?: string;
  ReferenceId?: string;
  // Refund-specific:
  RefundReference?: string;
  RefundStatus?: string;
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
  if (!secret || secret === "tbd-after-first-deploy") {
    // No secret configured — fail safe rather than fail open. Webhooks
    // will return 401 until you set the real secret in env.
    return false;
  }
  if (!signature) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("myfatoorah-signature");
  if (!verifySignature(rawBody, signature)) {
    console.warn("[mf-webhook] signature verification failed");
    return jsonError("invalid_signature", 401);
  }

  let event: Event;
  try {
    event = JSON.parse(rawBody) as Event;
  } catch {
    return jsonError("invalid_json", 400);
  }

  const supabase = createServerClient();

  // Look up the booking by either CustomerReference (set to booking
  // reference at ExecutePayment time) or InvoiceId.
  const lookup = event.Data?.CustomerReference
    ? supabase
        .from("bookings")
        .select(
          "id, reference, status, customer_name, customer_phone, locale, slot:slots(start_time, end_time), court:courts(name)",
        )
        .eq("reference", event.Data.CustomerReference)
        .maybeSingle()
    : supabase
        .from("bookings")
        .select(
          "id, reference, status, customer_name, customer_phone, locale, slot:slots(start_time, end_time), court:courts(name)",
        )
        .eq("payment_invoice_id", String(event.Data?.InvoiceId ?? ""))
        .maybeSingle();

  const { data: booking, error: lookupErr } = await lookup;
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!booking) {
    console.warn("[mf-webhook] booking not found", event.Data);
    return NextResponse.json({ ok: true, ignored: "booking_not_found" });
  }

  // ─ TransactionsStatusChanged ───────────────────────────────────────────────
  if (event.EventType === 1) {
    const status = (event.Data.TransactionStatus ?? "").toLowerCase();
    const succeeded =
      status === "succss" ||
      status === "success" ||
      status === "paid" ||
      status === "captured";

    if (succeeded) {
      // Idempotent — re-deliveries from MF must not double-send SMS.
      if (booking.status === "confirmed") {
        return NextResponse.json({ ok: true, idempotent: true });
      }
      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          payment_id: event.Data.PaymentMethod ?? null,
          paid_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      const court = Array.isArray(booking.court)
        ? booking.court[0]
        : booking.court;
      const slot = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot;
      const locale: Locale = isSupportedLocale(booking.locale)
        ? booking.locale
        : "en";

      if (court && slot) {
        await sendBookingConfirmationSms({
          rawPhone: booking.customer_phone,
          customerName: booking.customer_name,
          courtName: court.name,
          startIso: slot.start_time,
          endIso: slot.end_time,
          reference: booking.reference,
          locale,
        });
      }
      return NextResponse.json({ ok: true, action: "confirmed" });
    }

    // Failed / cancelled — release the slot, mark booking cancelled.
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    // Find the slot id via a separate query since the join above only
    // pulled timestamps. We need to flip the slot row back to open.
    const { data: bookingFull } = await supabase
      .from("bookings")
      .select("slot_id")
      .eq("id", booking.id)
      .maybeSingle<{ slot_id: string }>();
    if (bookingFull?.slot_id) {
      await supabase
        .from("slots")
        .update({ status: "open" })
        .eq("id", bookingFull.slot_id);
    }
    return NextResponse.json({ ok: true, action: "cancelled" });
  }

  // ─ RefundStatusChanged ─────────────────────────────────────────────────────
  if (event.EventType === 2) {
    const refundStatus = (event.Data.RefundStatus ?? "").toLowerCase();
    if (refundStatus === "success" || refundStatus === "refunded") {
      await supabase
        .from("bookings")
        .update({
          refund_id: event.Data.RefundReference ?? null,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", booking.id);
    }
    return NextResponse.json({ ok: true, action: "refund_recorded" });
  }

  return NextResponse.json({ ok: true, ignored: "unknown_event_type" });
}
