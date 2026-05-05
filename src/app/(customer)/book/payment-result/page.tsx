import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { createServerClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n";
import { getPaymentStatus } from "@/lib/payments/myfatoorah";

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
    .select("status, payment_invoice_id, slot_id")
    .eq("reference", reference)
    .maybeSingle<{
      status: string;
      payment_invoice_id: string | null;
      slot_id: string | null;
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
  let live: "paid" | "pending" | "failed" = "pending";
  if (booking.payment_invoice_id) {
    const status = await getPaymentStatus(Number(booking.payment_invoice_id));
    if (status.ok) {
      const s = String(status.status).toLowerCase();
      if (s === "paid") live = "paid";
      else if (s === "failed" || s === "cancelled") live = "failed";
    }
  }

  const failedHint = searchParams.failed === "1";
  if (failedHint && live === "pending") live = "failed";

  if (live === "paid") {
    // The webhook will (or has already) flipped the booking row;
    // jumping to the confirmation page is safe either way.
    redirect(`/book/confirmed/${reference}`);
  }

  if (live === "failed") {
    // Webhooks aren't reliable for failed/abandoned payments — MyFatoorah
    // sometimes doesn't fire one. Release the slot here so it doesn't
    // stay reserved. Guard on pending_payment so we never downgrade an
    // already-confirmed booking that raced with a late webhook.
    if (booking.status === "pending_payment") {
      await supabase
        .from("bookings")
        .update({ status: "cancelled" })
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
        <Card className="mx-auto max-w-md text-center">
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
