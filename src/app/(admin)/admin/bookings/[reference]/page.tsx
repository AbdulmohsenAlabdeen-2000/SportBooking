import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, MessageCircle, Phone, Mail } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { BookingActions } from "@/components/admin/BookingActions";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
} from "@/lib/time";
import { format, getDict } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dict.en";
import { SPORT_ICON } from "@/lib/sports";
import type { BookingStatus, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

type Booking = {
  reference: string;
  court: { id: string; name: string; sport: Sport } | null;
  slot: { start_time: string; end_time: string } | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  total_price: number;
  status: BookingStatus;
  created_at: string;
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function fetchBooking(reference: string): Promise<Booking | null> {
  const cookie = headers().get("cookie") ?? "";
  const res = await fetch(`${getBaseUrl()}/api/admin/bookings/${reference}`, {
    cache: "no-store",
    headers: { cookie },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  const json = (await res.json()) as { booking: Booking };
  return json.booking;
}

function relativeTime(iso: string, t: Dict): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return t.admin.detail_just_now;
  if (min < 60) return format(t.admin.detail_min_ago, { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return format(t.admin.detail_hr_ago, { n: hr });
  const days = Math.round(hr / 24);
  return format(t.admin.detail_d_ago, { n: days });
}

function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("965")
    ? digits
    : digits.length === 8
      ? `965${digits}`
      : digits;
  return `https://wa.me/${intl}`;
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: { reference: string };
}) {
  const t = getDict();
  let booking: Booking | null = null;
  let fetchError = false;
  try {
    booking = await fetchBooking(params.reference);
  } catch {
    fetchError = true;
  }

  if (fetchError) {
    return <NotFoundCard t={t} message={t.admin.detail_load_error} />;
  }
  if (!booking) {
    return <NotFoundCard t={t} message={t.admin.detail_not_found} />;
  }

  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;

  return (
    <section className="space-y-4">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{" "}
        {t.admin.detail_back}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-2xl font-semibold tracking-wide text-slate-900 md:text-3xl">
          {booking.reference}
        </p>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t.admin.detail_customer}
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {booking.customer_name}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={`tel:${booking.customer_phone}`}
                className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900"
              >
                <Phone className="h-4 w-4" aria-hidden />
                <span dir="ltr">{booking.customer_phone}</span>
              </a>
            </li>
            <li>
              <a
                href={whatsappUrl(booking.customer_phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t.admin.detail_whatsapp}
              </a>
            </li>
            {booking.customer_email ? (
              <li>
                <a
                  href={`mailto:${booking.customer_email}`}
                  className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  <span dir="ltr">{booking.customer_email}</span>
                </a>
              </li>
            ) : null}
          </ul>
          {booking.notes ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.admin.detail_notes}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{booking.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t.admin.detail_booking}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {SportIcon && (
              <SportIcon className="h-5 w-5 text-brand" aria-hidden />
            )}
            <p className="text-lg font-semibold text-slate-900">
              {booking.court?.name ?? "—"}
            </p>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <li className="text-slate-500">{t.admin.detail_date}</li>
            <li className="text-end text-slate-900">
              {booking.slot
                ? formatKuwaitFullDate(booking.slot.start_time.slice(0, 10))
                : "—"}
            </li>
            <li className="text-slate-500">{t.admin.detail_time}</li>
            <li className="text-end text-slate-900">
              {booking.slot
                ? formatKuwaitTimeRange(booking.slot.start_time, booking.slot.end_time)
                : "—"}
            </li>
            <li className="text-slate-500">{t.admin.detail_duration}</li>
            <li className="text-end text-slate-900">{t.admin.detail_duration_min}</li>
            <li className="text-slate-500">{t.admin.detail_total}</li>
            <li className="text-end font-semibold text-slate-900">
              {formatKwd(booking.total_price)}
            </li>
            <li className="text-slate-500">{t.admin.detail_created}</li>
            <li className="text-end text-slate-900">
              {relativeTime(booking.created_at, t)}
            </li>
          </ul>
        </div>
      </div>

      <BookingActions reference={booking.reference} status={booking.status} />
    </section>
  );
}

function NotFoundCard({ message, t }: { message: string; t: Dict }) {
  return (
    <section className="space-y-4">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{" "}
        {t.admin.detail_back}
      </Link>
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        {message}
      </div>
    </section>
  );
}
