"use client";

import { CalendarDays, Clock, CreditCard, Loader2 } from "lucide-react";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
} from "@/lib/time";
import { SPORT_ICON, sportLabel } from "@/lib/sports";
import { useDict } from "@/lib/i18n/client";
import type { ConfirmBookingWidget } from "./widgets";

// Final confirmation card. The "Confirm and pay" button takes over the
// whole page (window.location) — same shape as the regular booking
// flow's payment redirect.

export function ConfirmBooking({
  widget,
  onConfirm,
  busy,
  disabled,
}: {
  widget: ConfirmBookingWidget;
  onConfirm: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const t = useDict();
  const Icon = SPORT_ICON[widget.sport];
  return (
    <div className="rounded-2xl border-2 border-brand bg-gradient-to-br from-white to-brand/5 p-4 shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand text-white">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">
            {sportLabel(widget.sport, t)}
          </p>
          <p className="text-base font-bold text-slate-900">
            {widget.court_name}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {formatKuwaitFullDate(widget.start_time.slice(0, 10))}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span dir="ltr">
              {formatKuwaitTimeRange(widget.start_time, widget.end_time)}
            </span>
          </p>
        </div>
        <div className="flex-none text-end">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Total
          </p>
          <p className="text-xl font-bold text-slate-900">
            {widget.price.toFixed(3)}
          </p>
          <p className="text-[10px] font-medium text-slate-500">KWD</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white shadow hover:bg-accent-dark disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CreditCard className="h-4 w-4" aria-hidden />
        )}
        {busy ? "Preparing payment…" : "Confirm and pay"}
      </button>
    </div>
  );
}
