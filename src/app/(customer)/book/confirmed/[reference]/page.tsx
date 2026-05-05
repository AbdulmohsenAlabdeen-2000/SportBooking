import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { CopyReference } from "@/components/book/CopyReference";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
} from "@/lib/time";
import { getDict } from "@/lib/i18n";
import { SPORT_ICON, sportLabel } from "@/lib/sports";
import type { Sport } from "@/lib/types";
import { createServerClient } from "@/lib/supabase/server";
import { getPaymentStatus } from "@/lib/payments/myfatoorah";
import {
  PaymentReceipt,
  type ReceiptTransaction,
} from "@/components/customer/PaymentReceipt";

type BookingPayload = {
  booking: {
    reference: string;
    court: { id: string; name: string; sport: Sport } | null;
    slot: { start_time: string; end_time: string } | null;
    customer_name: string;
    customer_phone: string;
    total_price: number;
    status: string;
    created_at: string;
  };
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchBooking(reference: string): Promise<BookingPayload | null> {
  // Forward the visitor's cookie so the API's ownership check sees the
  // logged-in customer. Without this the server-side fetch arrives with
  // no session and any booking that has a user_id 404s — including the
  // one the customer just paid for.
  const cookie = headers().get("cookie") ?? "";
  const res = await fetch(`${getBaseUrl()}/api/bookings/${reference}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`booking_fetch_${res.status}`);
  return (await res.json()) as BookingPayload;
}

// Look up MyFatoorah's transaction details for the receipt block. Goes
// direct to Supabase (service-role) for the invoice_id, then live-checks
// MF for the latest attempt's PaymentId / TransactionId / ReferenceId.
// Returns null on any error so the rest of the page still renders.
async function fetchReceipt(
  reference: string,
): Promise<ReceiptTransaction | null> {
  try {
    const supabase = createServerClient();
    const { data: row } = await supabase
      .from("bookings")
      .select("payment_invoice_id, total_price, paid_at")
      .eq("reference", reference)
      .maybeSingle<{
        payment_invoice_id: string | null;
        total_price: number | string;
        paid_at: string | null;
      }>();

    if (!row?.payment_invoice_id) return null;
    const status = await getPaymentStatus(Number(row.payment_invoice_id));
    if (!status.ok) return null;

    const tx =
      status.data.InvoiceTransactions?.[
        status.data.InvoiceTransactions.length - 1
      ] ?? null;
    if (!tx) return null;
    return {
      paymentId: tx.PaymentId || null,
      transactionId: tx.TransactionId || null,
      referenceId: tx.ReferenceId ?? tx.TrackId ?? null,
      gateway: tx.PaymentGateway || null,
      status: tx.TransactionStatus || status.data.InvoiceStatus,
      amount: Number(status.data.InvoiceValue ?? row.total_price),
      paidAt:
        tx.TransactionDate ?? row.paid_at ?? status.data.CreatedDate,
    };
  } catch {
    return null;
  }
}

export const metadata = {
  title: "Booking Confirmed — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage({
  params,
}: {
  params: { reference: string };
}) {
  const t = getDict();
  let payload: BookingPayload | null = null;
  let fetchError = false;
  try {
    payload = await fetchBooking(params.reference);
  } catch {
    fetchError = true;
  }

  const receipt = payload ? await fetchReceipt(params.reference) : null;

  if (fetchError) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p>{t.confirmed.load_error}</p>
          <Link href="/" className="mt-4 inline-block text-brand underline">
            {t.confirmed.back_home}
          </Link>
        </Card>
      </Container>
    );
  }

  if (!payload) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p className="text-base font-semibold">{t.confirmed.not_found_title}</p>
          <p className="mt-1 text-sm">{t.confirmed.not_found_sub}</p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-brand px-5 font-semibold text-white"
          >
            {t.confirmed.back_home}
          </Link>
        </Card>
      </Container>
    );
  }

  const { booking } = payload;
  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;

  return (
    <Container className="py-6 md:py-10">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
          <CheckCircle2 className="h-10 w-10" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">
          {t.confirmed.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t.confirmed.sub}</p>
      </div>

      <Card className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {t.confirmed.reference}
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="font-mono text-xl font-semibold tracking-wider text-slate-900 md:text-2xl">
            {booking.reference}
          </p>
          <CopyReference reference={booking.reference} />
        </div>
      </Card>

      <Card className="mt-4">
        <ul className="divide-y divide-slate-200 text-sm">
          {booking.court && (
            <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              {SportIcon && (
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <SportIcon className="h-5 w-5" aria-hidden />
                </span>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  {sportLabel(booking.court.sport, t)}
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {booking.court.name}
                </p>
              </div>
            </li>
          )}
          {booking.slot && (
            <li className="grid grid-cols-2 gap-2 py-3">
              <span className="text-slate-500">{t.confirmed.date}</span>
              <span className="text-end text-slate-900">
                {formatKuwaitFullDate(booking.slot.start_time.slice(0, 10))}
              </span>
              <span className="text-slate-500">{t.confirmed.time}</span>
              <span className="text-end text-slate-900">
                {formatKuwaitTimeRange(booking.slot.start_time, booking.slot.end_time)}
              </span>
            </li>
          )}
          <li className="grid grid-cols-2 gap-2 py-3">
            <span className="text-slate-500">{t.confirmed.total}</span>
            <span className="text-end font-semibold text-slate-900">
              {formatKwd(booking.total_price)}
            </span>
          </li>
          <li className="grid grid-cols-2 gap-2 py-3 last:pb-0">
            <span className="text-slate-500">{t.confirmed.booked_under}</span>
            <span className="text-end text-slate-900">
              {booking.customer_name}
              <br />
              <span className="text-slate-600" dir="ltr">
                {booking.customer_phone}
              </span>
            </span>
          </li>
        </ul>
      </Card>

      {receipt ? (
        <div className="mt-4">
          <PaymentReceipt transaction={receipt} variant="success" />
        </div>
      ) : null}

      <p className="mt-4 rounded-xl bg-brand/5 px-4 py-3 text-sm text-slate-700">
        {t.confirmed.arrive_note}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/book"
          className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-white shadow-md hover:bg-accent-dark"
        >
          {t.confirmed.book_another}
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-base font-semibold text-slate-700 hover:bg-slate-50"
        >
          {t.common.done}
        </Link>
      </div>
    </Container>
  );
}
