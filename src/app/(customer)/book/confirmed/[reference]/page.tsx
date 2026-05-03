import Link from "next/link";
import { headers } from "next/headers";
import {
  CheckCircle2,
  Activity,
  CircleDot,
  LandPlot,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { CopyReference } from "@/components/book/CopyReference";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
} from "@/lib/time";
import type { Sport } from "@/lib/types";

const SPORT_ICON: Record<Sport, LucideIcon> = {
  padel: Activity,
  tennis: CircleDot,
  football: LandPlot,
};
const SPORT_LABEL: Record<Sport, string> = {
  padel: "Padel",
  tennis: "Tennis",
  football: "Football",
};

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
  const res = await fetch(`${getBaseUrl()}/api/bookings/${reference}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`booking_fetch_${res.status}`);
  return (await res.json()) as BookingPayload;
}

export const metadata = { title: "Booking Confirmed — Smash Courts Kuwait" };

export default async function ConfirmationPage({
  params,
}: {
  params: { reference: string };
}) {
  let payload: BookingPayload | null = null;
  let fetchError = false;
  try {
    payload = await fetchBooking(params.reference);
  } catch {
    fetchError = true;
  }

  if (fetchError) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p>Couldn't load this booking right now.</p>
          <Link href="/" className="mt-4 inline-block text-brand underline">
            Back to home
          </Link>
        </Card>
      </Container>
    );
  }

  if (!payload) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p className="text-base font-semibold">Booking not found</p>
          <p className="mt-1 text-sm">
            That reference doesn't match any booking we have on file.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-brand px-5 font-semibold text-white"
          >
            Back to home
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
          Booking Confirmed
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          We've sent your slot to the front desk.
        </p>
      </div>

      {/* Reference card */}
      <Card className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Reference
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="font-mono text-xl font-semibold tracking-wider text-slate-900 md:text-2xl">
            {booking.reference}
          </p>
          <CopyReference reference={booking.reference} />
        </div>
      </Card>

      {/* Booking details */}
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
                  {SPORT_LABEL[booking.court.sport]}
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {booking.court.name}
                </p>
              </div>
            </li>
          )}
          {booking.slot && (
            <li className="grid grid-cols-2 gap-2 py-3">
              <span className="text-slate-500">Date</span>
              <span className="text-right text-slate-900">
                {formatKuwaitFullDate(booking.slot.start_time.slice(0, 10))}
              </span>
              <span className="text-slate-500">Time</span>
              <span className="text-right text-slate-900">
                {formatKuwaitTimeRange(booking.slot.start_time, booking.slot.end_time)}
              </span>
            </li>
          )}
          <li className="grid grid-cols-2 gap-2 py-3">
            <span className="text-slate-500">Total</span>
            <span className="text-right font-semibold text-slate-900">
              {formatKwd(booking.total_price)}
            </span>
          </li>
          <li className="grid grid-cols-2 gap-2 py-3 last:pb-0">
            <span className="text-slate-500">Booked under</span>
            <span className="text-right text-slate-900">
              {booking.customer_name}
              <br />
              <span className="text-slate-600">{booking.customer_phone}</span>
            </span>
          </li>
        </ul>
      </Card>

      <p className="mt-4 rounded-xl bg-brand/5 px-4 py-3 text-sm text-slate-700">
        We'll see you 10 minutes before your slot. Park at the back gate.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/book"
          className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-white shadow-md hover:bg-accent-dark"
        >
          Book another court
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-base font-semibold text-slate-700 hover:bg-slate-50"
        >
          Done
        </Link>
      </div>
    </Container>
  );
}
