"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  Coins,
  ExternalLink,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  formatKuwaitClock,
  formatKuwaitFullDate,
  formatKuwaitWeekday,
  formatKwd,
} from "@/lib/time";
import { SPORT_ICON } from "@/lib/sports";
import type {
  TodaySummaryWidget,
  TotalRevenueWidget,
  WeekChartWidget,
  BookingListWidget,
  BookingDetailWidget,
  CompletedConfirmationWidget,
} from "./widgets";

// ─── Today summary ──────────────────────────────────────────────────

export function TodaySummary({ widget }: { widget: TodaySummaryWidget }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {formatKuwaitFullDate(widget.date)}
      </p>
      <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
        <Stat label="Total" value={widget.stats.total} />
        <Stat label="Confirmed" value={widget.stats.confirmed} tone="brand" />
        <Stat label="Completed" value={widget.stats.completed} tone="emerald" />
        <Stat label="Cancelled" value={widget.stats.cancelled} tone="red" />
      </div>
      <div className="mt-2 rounded-xl bg-emerald-50 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
          Revenue today
        </p>
        <p className="mt-0.5 text-xl font-bold text-emerald-900">
          {formatKwd(widget.stats.revenue_kwd)}
        </p>
      </div>
    </div>
  );
}

// ─── Total revenue ──────────────────────────────────────────────────

export function TotalRevenue({ widget }: { widget: TotalRevenueWidget }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-amber-500 text-white shadow">
          <Trophy className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-amber-800">
            Lifetime revenue
          </p>
          <p className="text-2xl font-bold text-amber-950">
            {formatKwd(widget.revenue_kwd)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Week chart ─────────────────────────────────────────────────────

export function WeekChart({ widget }: { widget: WeekChartWidget }) {
  const max = Math.max(
    1,
    ...widget.days.map((d) => d.confirmed + d.cancelled),
  );
  const totalConfirmed = widget.days.reduce((s, d) => s + d.confirmed, 0);
  const totalCancelled = widget.days.reduce((s, d) => s + d.cancelled, 0);
  const totalRevenue = widget.days.reduce((s, d) => s + d.revenue_kwd, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Last 7 days
        </p>
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand" aria-hidden />
            {totalConfirmed}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-red-500" aria-hidden />
            {totalCancelled}
          </span>
          <span className="font-medium text-slate-900">
            {formatKwd(totalRevenue)}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {widget.days.map((d) => {
          const total = d.confirmed + d.cancelled;
          const heightPct = (total / max) * 100;
          const cPct = total > 0 ? (d.confirmed / total) * 100 : 0;
          const xPct = total > 0 ? (d.cancelled / total) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex h-24 flex-col items-center justify-end"
              title={`${d.date} — ${d.confirmed} confirmed, ${d.cancelled} cancelled`}
            >
              <span className="mb-0.5 text-[9px] font-semibold tabular-nums text-slate-700">
                {total > 0 ? total : ""}
              </span>
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                style={{
                  height: total === 0 ? "3px" : `${Math.max(8, heightPct)}%`,
                  background: total === 0 ? "rgb(226 232 240)" : undefined,
                }}
              >
                {d.confirmed > 0 && (
                  <div className="bg-brand" style={{ height: `${cPct}%` }} />
                )}
                {d.cancelled > 0 && (
                  <div className="bg-red-500" style={{ height: `${xPct}%` }} />
                )}
              </div>
              <span className="mt-1 text-[9px] font-medium uppercase text-slate-500">
                {formatKuwaitWeekday(d.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Booking list ───────────────────────────────────────────────────

export function BookingListW({ widget }: { widget: BookingListWidget }) {
  if (widget.bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
        No bookings matched.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
          {widget.title}{" "}
          <span className="text-slate-400">
            ({widget.bookings.length})
          </span>
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {widget.bookings.map((b) => {
          const Icon = b.sport ? SPORT_ICON[b.sport] : null;
          return (
            <li key={b.reference} className="px-3 py-2.5">
              <Link
                href={`/admin/bookings/${b.reference}`}
                className="flex items-start gap-2.5 hover:bg-slate-50 -mx-3 px-3 py-1 rounded-md"
              >
                {Icon ? (
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold text-slate-900">
                      {b.reference}
                    </p>
                    <StatusBadgeMini status={b.status} />
                  </div>
                  <p className="truncate text-xs text-slate-700">
                    {b.customer_name} · {b.court_name ?? "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {b.start_time
                      ? `${formatKuwaitFullDate(b.start_time.slice(0, 10))} · ${formatKuwaitClock(b.start_time)}`
                      : "—"}{" "}
                    · {formatKwd(b.total_price)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Single booking detail ──────────────────────────────────────────

export function BookingDetail({ widget }: { widget: BookingDetailWidget }) {
  const Icon = widget.sport ? SPORT_ICON[widget.sport] : null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-semibold text-slate-900">
              {widget.reference}
            </p>
            <StatusBadgeMini status={widget.status} />
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {widget.customer_name}
          </p>
          <p className="text-[11px] text-slate-600" dir="ltr">
            {widget.customer_phone}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Court" value={widget.court_name ?? "—"} />
        <Field label="Total" value={formatKwd(widget.total_price)} />
        <Field
          label="Date"
          value={
            widget.start_time
              ? formatKuwaitFullDate(widget.start_time.slice(0, 10))
              : "—"
          }
        />
        <Field
          label="Time"
          value={
            widget.start_time && widget.end_time
              ? `${formatKuwaitClock(widget.start_time)} – ${formatKuwaitClock(widget.end_time)}`
              : "—"
          }
        />
        {widget.payment_invoice_id ? (
          <Field label="Invoice ID" value={widget.payment_invoice_id} mono />
        ) : null}
        {widget.refund_id ? (
          <Field label="Refund ID" value={widget.refund_id} mono />
        ) : null}
      </dl>
      <Link
        href={`/admin/bookings/${widget.reference}`}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-dark"
      >
        Open in dashboard <ExternalLink className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}

// ─── Completed confirmation ─────────────────────────────────────────

export function CompletedConfirmation({
  widget,
}: {
  widget: CompletedConfirmationWidget;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
      <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600" aria-hidden />
      <p className="text-sm">
        <span className="font-mono font-semibold">{widget.reference}</span>{" "}
        marked completed.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "brand" | "emerald" | "red";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    brand: "text-brand",
    emerald: "text-emerald-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-slate-900 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusBadgeMini({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    confirmed: {
      cls: "bg-brand/10 text-brand",
      icon: <CalendarCheck className="h-3 w-3" aria-hidden />,
    },
    completed: {
      cls: "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
    },
    cancelled: {
      cls: "bg-red-100 text-red-700",
      icon: <XCircle className="h-3 w-3" aria-hidden />,
    },
    pending_payment: {
      cls: "bg-amber-100 text-amber-800",
      icon: <Coins className="h-3 w-3" aria-hidden />,
    },
  };
  const m = map[status] ?? { cls: "bg-slate-100 text-slate-700", icon: null };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${m.cls}`}
    >
      {m.icon}
      {status}
    </span>
  );
}
