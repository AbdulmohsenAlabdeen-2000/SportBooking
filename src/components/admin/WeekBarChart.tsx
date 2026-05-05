"use client";

import { formatKuwaitWeekday } from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";

type Day = {
  date: string;
  confirmed: number;
  cancelled: number;
  bookings: number;
};

// Compact 7-day bookings chart. Stacked bars per day: brand-teal for
// confirmed/completed bookings, red for cancellations (= refunded).
// Declined attempts are excluded upstream. Today is highlighted with a
// brand-tinted stroke around its bar.

export function WeekBarChart({
  days,
  todayIso,
}: {
  days: Day[];
  todayIso: string;
}) {
  const t = useDict();

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {t.admin.chart_no_data}
      </div>
    );
  }

  const max = Math.max(1, ...days.map((d) => d.confirmed + d.cancelled));
  const totalConfirmed = days.reduce((s, d) => s + d.confirmed, 0);
  const totalCancelled = days.reduce((s, d) => s + d.cancelled, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t.admin.chart_title}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand" aria-hidden />
            {t.admin.chart_confirmed} {totalConfirmed}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden />
            {t.admin.chart_cancelled} {totalCancelled}
          </span>
        </div>
      </div>
      <div
        className="relative mt-4 grid grid-cols-7 gap-2 md:gap-3"
        role="img"
        aria-label={format(t.admin.chart_aria, {
          total: totalConfirmed + totalCancelled,
        })}
      >
        {days.map((d) => {
          const isToday = d.date === todayIso;
          const total = d.confirmed + d.cancelled;
          const heightPct = (total / max) * 100;
          const confirmedPct = total > 0 ? (d.confirmed / total) * 100 : 0;
          const cancelledPct = total > 0 ? (d.cancelled / total) * 100 : 0;
          const tipKey =
            total === 1 ? t.admin.chart_bookings_one : t.admin.chart_bookings_other;
          return (
            <div
              key={d.date}
              className="flex h-32 flex-col items-center justify-end md:h-36"
            >
              <span
                className={`mb-1 text-[10px] font-semibold tabular-nums ${
                  total === 0
                    ? "invisible"
                    : isToday
                      ? "text-brand"
                      : "text-slate-700"
                }`}
              >
                {total}
              </span>
              <div
                className={`flex w-full flex-col-reverse overflow-hidden rounded-lg ${
                  isToday ? "ring-2 ring-brand/30" : ""
                } transition-[height] duration-300`}
                style={{
                  height: total === 0 ? "4px" : `${Math.max(8, heightPct)}%`,
                  minHeight: total === 0 ? "4px" : "12px",
                  background: total === 0 ? "rgb(226 232 240)" : undefined,
                }}
                title={format(tipKey, { n: total })}
              >
                {d.confirmed > 0 && (
                  <div
                    className="bg-brand"
                    style={{ height: `${confirmedPct}%` }}
                    title={`${t.admin.chart_confirmed} ${d.confirmed}`}
                  />
                )}
                {d.cancelled > 0 && (
                  <div
                    className="bg-red-500"
                    style={{ height: `${cancelledPct}%` }}
                    title={`${t.admin.chart_cancelled} ${d.cancelled}`}
                  />
                )}
              </div>
              <span
                className={`mt-2 text-[11px] font-medium uppercase tracking-wider ${
                  isToday ? "text-brand" : "text-slate-500"
                }`}
              >
                {formatKuwaitWeekday(d.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
