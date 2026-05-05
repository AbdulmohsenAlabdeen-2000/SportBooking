import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/supabase/route";
import { jsonError } from "@/lib/api";
import { getPaymentStatus } from "@/lib/payments/myfatoorah";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

// Returns the gateway-level transaction details for one booking — the
// same shape the receipt component renders on the success and decline
// pages. Exposed separately from GET /api/bookings/[reference] so the
// /me page can lazy-load receipts on click rather than firing N parallel
// MyFatoorah calls on every page render.
//
// Ownership: bookings with a user_id are private to that user; bookings
// with no user_id (anonymous / admin-created) stay public, mirroring
// the policy on the main lookup endpoint.

export async function GET(
  _req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("bookings")
    .select("user_id, payment_invoice_id, total_price, paid_at")
    .eq("reference", reference)
    .maybeSingle<{
      user_id: string | null;
      payment_invoice_id: string | null;
      total_price: number | string;
      paid_at: string | null;
    }>();

  if (error) return jsonError(error.message, 500);
  if (!row) return jsonError("booking_not_found", 404);

  if (row.user_id) {
    const cookieClient = createCookieClient();
    const { data: userResp } = await cookieClient.auth.getUser();
    if (userResp.user?.id !== row.user_id) {
      return jsonError("booking_not_found", 404);
    }
  }

  if (!row.payment_invoice_id) {
    return NextResponse.json({ transaction: null });
  }

  const status = await getPaymentStatus(Number(row.payment_invoice_id));
  if (!status.ok) return NextResponse.json({ transaction: null });

  const tx =
    status.data.InvoiceTransactions?.[
      status.data.InvoiceTransactions.length - 1
    ] ?? null;
  if (!tx) return NextResponse.json({ transaction: null });

  return NextResponse.json({
    transaction: {
      paymentId: tx.PaymentId || null,
      transactionId: tx.TransactionId || null,
      referenceId: tx.ReferenceId ?? tx.TrackId ?? null,
      gateway: tx.PaymentGateway || null,
      status: tx.TransactionStatus || status.data.InvoiceStatus,
      amount: Number(status.data.InvoiceValue ?? row.total_price),
      paidAt: tx.TransactionDate ?? row.paid_at ?? status.data.CreatedDate,
    },
  });
}
