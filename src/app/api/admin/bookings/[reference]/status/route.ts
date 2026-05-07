import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo/mode";
import { updateBookingStatus as demoUpdateStatus } from "@/lib/demo/store";
import { makeRefund } from "@/lib/payments/myfatoorah";
import { dispatchWebhook } from "@/lib/webhooks/n8n";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_payment: ["cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  declined: [], // terminal — payment never went through, no further admin action
};

type Patch = { status?: BookingStatus };

export async function PATCH(
  req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  let body: Patch;
  try {
    body = (await req.json()) as Patch;
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (body.status !== "completed" && body.status !== "cancelled") {
    return jsonError("invalid_status", 400);
  }
  const target: BookingStatus = body.status;

  if (isDemoMode()) {
    const result = demoUpdateStatus(reference, target);
    if (!result.ok) {
      const status = result.error === "booking_not_found" ? 404 : 409;
      return jsonError(result.error, status);
    }
    return NextResponse.json({ booking: result.booking });
  }

  const supabase = createServerClient();

  // Read current state to give precise 404 / 409 responses.
  const { data: current, error: lookupErr } = await supabase
    .from("bookings")
    .select("reference, status, slot_id")
    .eq("reference", reference)
    .maybeSingle();
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!current) return jsonError("booking_not_found", 404);

  if (!ALLOWED_TRANSITIONS[current.status as BookingStatus].includes(target)) {
    return jsonError("already_finalized", 409);
  }

  if (target === "cancelled") {
    // Read payment fields before cancelling so we know whether to refund.
    const { data: paid } = await supabase
      .from("bookings")
      .select("total_price, payment_invoice_id, paid_at")
      .eq("reference", reference)
      .maybeSingle<{
        total_price: number | string;
        payment_invoice_id: string | null;
        paid_at: string | null;
      }>();

    // RPC frees the slot atomically.
    const { data, error } = await supabase.rpc("cancel_booking", {
      p_reference: reference,
    });
    if (error) {
      if (error.message.includes("booking_not_cancellable")) {
        return jsonError("already_finalized", 409);
      }
      return jsonError(error.message, 500);
    }

    // If it was paid, refund. Webhook writes refund_id + refunded_at;
    // we stamp eagerly too so the admin UI updates immediately.
    if (paid?.payment_invoice_id && paid.paid_at) {
      const refund = await makeRefund({
        invoiceId: Number(paid.payment_invoice_id),
        amount: Number(paid.total_price),
        comment: `Admin-initiated cancellation for ${reference}`,
      });
      if (!refund.ok) {
        console.error("[refund] admin cancel refund failed", {
          reference,
          error: refund.error,
        });
      } else {
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
      cancelled_by: "admin",
      was_paid: !!(paid?.payment_invoice_id && paid.paid_at),
      total_price: paid?.total_price ? Number(paid.total_price) : null,
    });

    return NextResponse.json({ booking: data });
  }

  // target === 'completed': simple status flip; the slot stays booked.
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("reference", reference)
    .eq("status", "confirmed")
    .select()
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("already_finalized", 409);

  await dispatchWebhook("booking.completed", { reference });

  return NextResponse.json({ booking: data });
}
