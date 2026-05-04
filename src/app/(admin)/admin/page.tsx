import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { WeekBarChart } from "@/components/admin/WeekBarChart";
import {
  formatKuwaitClock,
  formatKuwaitFullDate,
  formatKwd,
  kuwaitTodayIso,
} from "@/lib/time";
import { format, getDict } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dict.en";
import { SPORT_ICON } from "@/lib/sports";
import type { BookingStatus, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

type TodayBooking = {
  reference: string;
  court: { id: string; name: string; sport: Sport } | null;
  slot: { start_time: string; end_time: string } | null;
  customer_name: string;
  customer_phone: string;
  total_price: number;
  status: BookingStatus;
};

type TodayResponse = {
  date: string;
  bookings: TodayBooking[];
  stats: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    revenue_kwd: number;
  };
};

type WeekResponse = {
  days: { date: string; bookings: number; revenue_kwd: number }[];
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function loadDashboard(): Promise<{
  today: TodayResponse | null;
  week: WeekResponse | null;
}> {
  const cookie = headers().get("cookie") ?? "";
  const init: RequestInit = {
    cache: "no-store",
    headers: { cookie },
  };
  const base = getBaseUrl();
  const [todayRes, weekRes] = await Promise.all([
    fetch(`${base}/api/admin/bookings/today`, init).catch(() => null),
    fetch(`${base}/api/admin/stats/week`, init).catch(() => null),
  ]);

  const today =
    todayRes && todayRes.ok ? ((await todayRes.json()) as TodayResponse) : null;
  const week =
    weekRes && weekRes.ok ? ((await weekRes.json()) as WeekResponse) : null;
  return { today, week };
}

export default async function AdminDashboardPage() {
  const t = getDict();
  const user = await requireAdmin();
  const { today, week } = await loadDashboard();
  const todayIso = today?.date ?? kuwaitTodayIso();

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
            {formatKuwaitFullDate(todayIso)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {format(t.admin.welcome_back, { email: user.email ?? "" })}
          </p>
        </div>
        <RefreshButton />
      </div>

      {today ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t.admin.todays_bookings} value={today.stats.total} />
          <StatCard
            label={t.admin.confirmed}
            value={today.stats.confirmed}
            tone="brand"
          />
          <StatCard
            label={t.admin.completed}
            value={today.stats.completed}
            tone="emerald"
          />
          <StatCard
            label={t.admin.revenue_today}
            value={formatKwd(today.stats.revenue_kwd)}
            tone="slate"
          />
        </div>
      ) : (
        <ErrorCard message={t.admin.err_load_today} t={t} />
      )}

      {week ? (
        <WeekBarChart days={week.days} todayIso={todayIso} />
      ) : (
        <ErrorCard message={t.admin.err_load_week} t={t} />
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {t.admin.todays_bookings_h}
          </h2>
          {today ? (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
              {today.bookings.length}
            </span>
          ) : null}
        </div>

        {today ? (
          today.bookings.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              {t.admin.todays_bookings_empty}
            </div>
          ) : (
            <ol className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {today.bookings.map((b) => (
                <BookingRow key={b.reference} booking={b} />
              ))}
            </ol>
          )
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ActionTile
          href="/admin/bookings"
          Icon={ClipboardList}
          title={t.admin.view_all_bookings}
          subtitle={t.admin.view_all_bookings_sub}
        />
        <ActionTile
          href="/admin/slots"
          Icon={Calendar}
          title={t.admin.manage_slots}
          subtitle={t.admin.manage_slots_sub}
        />
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: "brand" | "emerald" | "slate";
}) {
  const valueCls = {
    brand: "text-brand",
    emerald: "text-emerald-700",
    slate: "text-slate-900",
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold md:text-3xl ${valueCls}`}>{value}</p>
    </div>
  );
}

function BookingRow({ booking }: { booking: TodayBooking }) {
  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;
  return (
    <li className="p-4">
      <Link
        href={`/admin/bookings/${booking.reference}`}
        className="flex items-start gap-3"
      >
        <div className="w-14 flex-none text-end font-mono text-sm text-slate-900">
          {booking.slot ? formatKuwaitClock(booking.slot.start_time) : "—"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {SportIcon && (
              <SportIcon className="h-4 w-4 flex-none text-brand" aria-hidden />
            )}
            <p className="truncate text-sm font-semibold text-slate-900">
              {booking.court?.name ?? "—"}
            </p>
          </div>
          <p className="mt-0.5 text-sm text-slate-700">
            {booking.customer_name}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
            <Phone className="h-3 w-3" aria-hidden />
            <span dir="ltr">{booking.customer_phone}</span>
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </Link>
    </li>
  );
}

function ActionTile({
  href,
  Icon,
  title,
  subtitle,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-slate-400 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

function ErrorCard({ message, t }: { message: string; t: Dict }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {message} <span className="text-red-600">{t.admin.use_refresh}</span>
    </div>
  );
}
