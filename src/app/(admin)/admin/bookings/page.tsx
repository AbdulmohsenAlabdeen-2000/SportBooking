import Link from "next/link";
import { headers } from "next/headers";
import {
  Activity,
  CircleDot,
  ChevronRight,
  LandPlot,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { BookingsFilters } from "@/components/admin/BookingsFilters";
import {
  formatKuwaitClock,
  formatKuwaitFullDate,
  formatKwd,
  isValidIsoDate,
  kuwaitTodayIso,
} from "@/lib/time";
import { format, getDict } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dict.en";
import type { BookingStatus, Court, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

type ListBooking = {
  reference: string;
  court: { id: string; name: string; sport: Sport } | null;
  slot: { start_time: string; end_time: string } | null;
  customer_name: string;
  customer_phone: string;
  total_price: number;
  status: BookingStatus;
};

type ListResponse = {
  bookings: ListBooking[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: {
    from: string;
    to: string;
    court_id: string | null;
    status: BookingStatus | "all";
    q: string;
  };
};

const SPORT_ICON: Record<Sport, LucideIcon> = {
  padel: Activity,
  tennis: CircleDot,
  football: LandPlot,
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function plusDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function fetchList(searchString: string): Promise<ListResponse | null> {
  const cookie = headers().get("cookie") ?? "";
  const res = await fetch(
    `${getBaseUrl()}/api/admin/bookings${searchString ? `?${searchString}` : ""}`,
    { cache: "no-store", headers: { cookie } },
  );
  if (!res.ok) return null;
  return (await res.json()) as ListResponse;
}

async function fetchCourts(): Promise<Court[]> {
  const cookie = headers().get("cookie") ?? "";
  const res = await fetch(`${getBaseUrl()}/api/courts`, {
    cache: "no-store",
    headers: { cookie },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { courts: Court[] };
  return json.courts;
}

export default async function AdminBookingsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = getDict();
  const upstream = new URLSearchParams();
  const passKeys = ["from", "to", "court_id", "status", "q", "page"] as const;
  for (const k of passKeys) {
    const v = searchParams[k];
    if (typeof v === "string" && v) upstream.set(k, v);
  }

  const [list, courts] = await Promise.all([
    fetchList(upstream.toString()),
    fetchCourts(),
  ]);

  const today = kuwaitTodayIso();
  const fromInitial =
    typeof searchParams.from === "string" && isValidIsoDate(searchParams.from)
      ? searchParams.from
      : today;
  const toInitial =
    typeof searchParams.to === "string" && isValidIsoDate(searchParams.to)
      ? searchParams.to
      : plusDaysIso(fromInitial, 30);

  const initialFilters = {
    from: fromInitial,
    to: toInitial,
    court_id:
      typeof searchParams.court_id === "string" ? searchParams.court_id : "",
    status:
      (searchParams.status as BookingStatus | "all" | undefined) ?? "all",
    q: typeof searchParams.q === "string" ? searchParams.q : "",
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          {t.admin.bookings_title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t.admin.bookings_sub}</p>
      </div>

      <BookingsFilters initial={initialFilters} courts={courts} />

      {!list ? (
        <ErrorCard message={t.admin.bookings_err_load} />
      ) : list.bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {t.admin.bookings_empty}
        </div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {list.bookings.map((b) => (
              <BookingCard key={b.reference} booking={b} />
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t.admin.bookings_h_ref}</th>
                  <th className="px-4 py-3 text-start">
                    {t.admin.bookings_h_datetime}
                  </th>
                  <th className="px-4 py-3 text-start">{t.admin.bookings_h_court}</th>
                  <th className="px-4 py-3 text-start">
                    {t.admin.bookings_h_customer}
                  </th>
                  <th className="px-4 py-3 text-start">{t.admin.bookings_h_phone}</th>
                  <th className="px-4 py-3 text-end">{t.admin.bookings_h_price}</th>
                  <th className="px-4 py-3 text-start">{t.admin.bookings_h_status}</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.bookings.map((b) => (
                  <BookingRow key={b.reference} booking={b} t={t} />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            t={t}
            page={list.pagination.page}
            totalPages={list.pagination.totalPages}
            total={list.pagination.total}
            search={upstream}
          />
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: ListBooking }) {
  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;
  return (
    <li>
      <Link
        href={`/admin/bookings/${booking.reference}`}
        className="block rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-sm text-slate-900">{booking.reference}</p>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {booking.slot
            ? `${formatKuwaitFullDate(booking.slot.start_time.slice(0, 10))} · ${formatKuwaitClock(booking.slot.start_time)}`
            : "—"}
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          {SportIcon && (
            <SportIcon className="h-4 w-4 flex-none text-brand" aria-hidden />
          )}
          <span className="truncate">{booking.court?.name ?? "—"}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-slate-700">{booking.customer_name}</span>
          <span className="font-semibold text-slate-900">
            {formatKwd(booking.total_price)}
          </span>
        </div>
      </Link>
    </li>
  );
}

function BookingRow({ booking, t }: { booking: ListBooking; t: Dict }) {
  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-mono text-xs text-slate-900">
        <Link href={`/admin/bookings/${booking.reference}`} className="block">
          {booking.reference}
        </Link>
      </td>
      <td className="px-4 py-3 text-slate-700">
        {booking.slot
          ? `${formatKuwaitFullDate(booking.slot.start_time.slice(0, 10))} · ${formatKuwaitClock(booking.slot.start_time)}`
          : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-slate-700">
          {SportIcon && <SportIcon className="h-4 w-4 text-brand" aria-hidden />}
          <span>{booking.court?.name ?? "—"}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">{booking.customer_name}</td>
      <td className="px-4 py-3 text-slate-500" dir="ltr">
        {booking.customer_phone}
      </td>
      <td className="px-4 py-3 text-end text-slate-900">
        {formatKwd(booking.total_price)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={booking.status} />
      </td>
      <td className="px-2 py-3 text-slate-400">
        <Link
          href={`/admin/bookings/${booking.reference}`}
          aria-label={t.admin.bookings_open_label}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

function Pagination({
  t,
  page,
  totalPages,
  total,
  search,
}: {
  t: Dict;
  page: number;
  totalPages: number;
  total: number;
  search: URLSearchParams;
}) {
  const prev = new URLSearchParams(search);
  prev.set("page", String(Math.max(1, page - 1)));
  const next = new URLSearchParams(search);
  next.set("page", String(Math.min(totalPages, page + 1)));

  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <p>
        {format(t.common.page_x_of_y, {
          page,
          total: totalPages,
          count: total,
        })}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={`?${prev.toString()}`}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
          >
            {t.common.previous}
          </Link>
        ) : (
          <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400">
            {t.common.previous}
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={`?${next.toString()}`}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
          >
            {t.common.next}
          </Link>
        ) : (
          <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400">
            {t.common.next}
          </span>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {message}
    </div>
  );
}
