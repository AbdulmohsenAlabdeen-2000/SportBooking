import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { createServerClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n";
import { getPaymentStatus } from "@/lib/payments/myfatoorah";
import { sendBookingConfirmationSms } from "@/lib/sms/booking-confirmation";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { dispatchWebhook } from "@/lib/webhooks/n8n";
import { isSupportedLocale, type Locale } from "@/lib/i18n/shared";
import {
  PaymentReceipt,
  type ReceiptTransaction,
} from "@/components/customer/PaymentReceipt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payment — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

// MyFatoorah redirects the customer here after the hosted payment
// page closes. The webhook is the source of truth, but the customer
// hits this page first — we do a live status check against MF so the
// page is correct even if the webhook is briefly delayed.

function getBaseUrlFromRequest(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: { reference?: string; failed?: string };
}) {
  const t = getDict();
  const reference = searchParams.reference;

  if (!reference) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p>{t.payment_result.missing_reference}</p>
          <Link href="/book" className="mt-4 inline-block text-brand underline">
            {t.payment_result.back_to_booking}
          </Link>
        </Card>
      </Container>
    );
  }

  const supabase = createServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, status, payment_invoice_id, slot_id, customer_name, customer_phone, customer_email, total_price, locale, slot:slots(start_time, end_time), court:courts(name)",
    )
    .eq("reference", reference)
    .maybeSingle<{
      id: string;
      status: string;
      payment_invoice_id: string | null;
      slot_id: string | null;
      customer_name: string;
      customer_phone: string;
      customer_email: string | null;
      total_price: number | string;
      locale: string | null;
      slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[] | null;
      court: { name: string } | { name: string }[] | null;
    }>();

  if (!booking) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p>{t.payment_result.not_found}</p>
          <Link href="/book" className="mt-4 inline-block text-brand underline">
            {t.payment_result.back_to_booking}
          </Link>
        </Card>
      </Container>
    );
  }

  // If the booking is already confirmed, the webhook beat us here —
  // skip the live check and redirect to the confirmation page.
  if (booking.status === "confirmed") {
    redirect(`/book/confirmed/${reference}`);
  }

  // Live-check the payment status with MyFatoorah. This isn't a
  // replacement for the webhook (which writes the SMS-trigger
  // transition); it's just so we render the right UI without waiting.
  // We also hold onto the full status data so we can render the
  // gateway-level receipt details (PaymentId / TransactionId / etc.)
  // on whichever branch we end up rendering.
  let live: "paid" | "pending" | "failed" = "pending";
  let receipt: ReceiptTransaction | null = null;
  if (booking.payment_invoice_id) {
    const status = await getPaymentStatus(Number(booking.payment_invoice_id));
    if (status.ok) {
      const s = String(status.status).toLowerCase();
      if (s === "paid") live = "paid";
      else if (s === "failed" || s === "cancelled") live = "failed";

      // Use the most recent transaction attempt — that's the one the
      // customer is currently looking at. MyFatoorah orders newest-last;
      // pick the last entry, fallback to the only entry.
      const tx =
        status.data.InvoiceTransactions?.[
          status.data.InvoiceTransactions.length - 1
        ] ?? null;
      if (tx) {
        receipt = {
          paymentId: tx.PaymentId || null,
          transactionId: tx.TransactionId || null,
          referenceId: tx.ReferenceId ?? tx.TrackId ?? null,
          gateway: tx.PaymentGateway || null,
          status: tx.TransactionStatus || status.data.InvoiceStatus,
          amount: Number(status.data.InvoiceValue),
          paidAt: tx.TransactionDate ?? status.data.CreatedDate,
        };
      }
    }
  }

  const failedHint = searchParams.failed === "1";
  if (failedHint && live === "pending") live = "failed";

  if (live === "paid") {
    // The webhook may not fire reliably, so flip the booking here as the
    // primary path — the webhook is a backup. The .eq("status",
    // "pending_payment") guard makes this idempotent: only the first
    // caller (page or webhook) actually updates and sends the SMS.
    const { data: transitioned } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        paid_at: new Date().toISOString(),
      })
      .eq("reference", reference)
      .eq("status", "pending_payment")
      .select("id")
      .maybeSingle();

    if (transitioned) {
      const court = Array.isArray(booking.court) ? booking.court[0] : booking.court;
      const slot = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot;
      const locale: Locale = isSupportedLocale(booking.locale) ? booking.locale : "en";
      if (court && slot) {
        // Fan out the three notification channels in parallel. All
        // helpers are best-effort — none of them throw, so a Twilio
        // outage can't block a Resend send, an n8n outage can't
        // block either, etc.
        await Promise.all([
          sendBookingConfirmationSms({
            rawPhone: booking.customer_phone,
            customerName: booking.customer_name,
            courtName: court.name,
            startIso: slot.start_time,
            endIso: slot.end_time,
            reference,
            locale,
          }),
          sendBookingConfirmationEmail({
            email: booking.customer_email,
            customerName: booking.customer_name,
            courtName: court.name,
            startIso: slot.start_time,
            endIso: slot.end_time,
            reference,
            totalPrice: Number(booking.total_price),
            transaction: receipt
              ? {
                  paymentId: receipt.paymentId,
                  transactionId: receipt.transactionId,
                  referenceId: receipt.referenceId,
                  gateway: receipt.gateway,
                  status: receipt.status,
                  paidAt: receipt.paidAt,
                }
              : null,
          }),
          dispatchWebhook("booking.confirmed", {
            reference,
            customer_name: booking.customer_name,
            customer_phone: booking.customer_phone,
            customer_email: booking.customer_email,
            court_name: court.name,
            start_time: slot.start_time,
            end_time: slot.end_time,
            total_price: Number(booking.total_price),
            transaction: receipt,
          }),
        ]);
      }
    }

    redirect(`/book/confirmed/${reference}`);
  }

  if (live === "failed") {
    // Payment never succeeded — mark the row as `declined` (not
    // `cancelled`, which means "was paid then someone cancelled") and
    // release the slot. Hidden from /me and admin per business rules.
    // Guarded on pending_payment so a late webhook can't downgrade an
    // already-confirmed booking.
    if (booking.status === "pending_payment") {
      // Fire the n8n webhook for declined attempts. Useful for
      // attribution / fraud-watch dashboards even though we don't
      // surface declined rows in /me or admin.
      await dispatchWebhook("booking.declined", {
        reference,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        customer_email: booking.customer_email,
        transaction: receipt,
      });
      await supabase
        .from("bookings")
        .update({ status: "declined" })
        .eq("reference", reference)
        .eq("status", "pending_payment");
      if (booking.slot_id) {
        await supabase
          .from("slots")
          .update({ status: "open" })
          .eq("id", booking.slot_id);
      }
    }

    return (
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-md space-y-4">
          <Card className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <XCircle className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {t.payment_result.failed_title}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t.payment_result.failed_sub}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">{reference}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/book"
                className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                {t.payment_result.try_again}
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center gap-1 text-sm text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
                {t.common.home}
              </Link>
            </div>
          </Card>
          {receipt ? (
            <PaymentReceipt transaction={receipt} variant="failed" />
          ) : null}
        </div>
      </Container>
    );
  }

  // Pending — webhook hasn't fired yet but the payment is in flight.
  return (
    <Container className="py-10 md:py-14">
      <Card className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Clock className="h-7 w-7 animate-pulse" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {t.payment_result.pending_title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t.payment_result.pending_sub}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">{reference}</p>
        <Link
          href={`/book/payment-result?reference=${encodeURIComponent(reference)}`}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {t.payment_result.refresh}
        </Link>
      </Card>
    </Container>
  );
}
