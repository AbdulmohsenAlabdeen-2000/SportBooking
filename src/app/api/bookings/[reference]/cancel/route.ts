import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/supabase/route";
import { jsonError } from "@/lib/api";
import { makeRefund } from "@/lib/payments/myfatoorah";
import { dispatchWebhook } from "@/lib/webhooks/n8n";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

// Customer self-service cancel. Owner-only; same atomic cancel_booking
// RPC the admin uses. If the booking was paid via MyFatoorah, also
// issue a refund — the webhook later writes refund_id + refunded_at.
export async function POST(
  _req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("unauthorized", 401);

  const supabase = createServerClient();

  const { data: booking, error: lookupErr } = await supabase
    .from("bookings")
    .select(
      "reference, status, user_id, total_price, payment_invoice_id, paid_at, slot:slots(start_time)",
    )
    .eq("reference", reference)
    .maybeSingle<{
      reference: string;
      status: string;
      user_id: string | null;
      total_price: number | string;
      payment_invoice_id: string | null;
      paid_at: string | null;
      slot: { start_time: string } | { start_time: string }[] | null;
    }>();
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!booking || booking.user_id !== user.id) {
    return jsonError("booking_not_found", 404);
  }
  if (booking.status !== "confirmed") {
    return jsonError("already_finalized", 409);
  }
  // Once the match's start time has passed, only an admin can cancel
  // (and refund) — the customer must contact support.
  const slot = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot;
  if (slot && new Date(slot.start_time).getTime() <= Date.now()) {
    return jsonError("cancel_window_closed", 409);
  }

  const { data, error } = await supabase.rpc("cancel_booking", {
    p_reference: reference,
  });
  if (error) {
    if (error.message.includes("booking_not_cancellable")) {
      return jsonError("already_finalized", 409);
    }
    return jsonError(error.message, 500);
  }

  // If the booking was paid, issue a refund. Best-effort: if the
  // refund call fails the cancellation still stands, the admin can
  // retry the refund manually. The MF webhook writes refund_id +
  // refunded_at on success.
  if (booking.payment_invoice_id && booking.paid_at) {
    const refund = await makeRefund({
      invoiceId: Number(booking.payment_invoice_id),
      amount: Number(booking.total_price),
      comment: `Customer-initiated cancellation for ${reference}`,
    });
    if (!refund.ok) {
      console.error("[refund] customer cancel refund failed", {
        reference,
        error: refund.error,
      });
    } else {
      // Stamp eagerly so the UI shows refunded immediately rather than
      // waiting for the webhook (which may take a few seconds).
      await supabase
        .from("bookings")
        .update({
          refund_id: refund.refundId,
          refunded_at: new Date().toISOString(),
        })
        .eq("reference", reference);
    }
  }

  await dispatchWebhook("booking.cancelled", {
    reference,
    cancelled_by: "customer",
    was_paid: !!(booking.payment_invoice_id && booking.paid_at),
    total_price: Number(booking.total_price),
  });

  return NextResponse.json({ booking: data });
}
