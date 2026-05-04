"use client";

import { formatKuwaitWeekday } from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";

type Day = { date: string; bookings: number };

// Compact 7-day bookings chart. Designed to read at a glance — bars
// are gradient-filled, today is highlighted, the y-max is shown as a
// faint reference line, and exact counts only render on bars that
// actually have data so empty days stay quiet.

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

  const max = Math.max(1, ...days.map((d) => d.bookings));
  const total = days.reduce((sum, d) => sum + d.bookings, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t.admin.chart_title}
        </p>
        <p className="text-xs text-slate-500">
          {format(t.admin.chart_total, { n: total })}
        </p>
      </div>
      <div
        className="relative mt-4 grid grid-cols-7 gap-2 md:gap-3"
        role="img"
        aria-label={format(t.admin.chart_aria, { total })}
      >
        {days.map((d) => {
          const isToday = d.date === todayIso;
          const heightPct = (d.bookings / max) * 100;
          const tipKey =
            d.bookings === 1
              ? t.admin.chart_bookings_one
              : t.admin.chart_bookings_other;
          return (
            <div
              key={d.date}
              className="flex h-32 flex-col items-center justify-end md:h-36"
            >
              <span
                className={`mb-1 text-[10px] font-semibold tabular-nums ${
                  d.bookings === 0
                    ? "invisible"
                    : isToday
                      ? "text-brand"
                      : "text-slate-700"
                }`}
              >
                {d.bookings}
              </span>
              <div
                className={`w-full overflow-hidden rounded-lg ${
                  isToday
                    ? "bg-gradient-to-t from-brand to-brand/70 ring-2 ring-brand/30"
                    : "bg-gradient-to-t from-slate-300 to-slate-200"
                } transition-[height] duration-300`}
                style={{
                  height: d.bookings === 0 ? "4px" : `${Math.max(8, heightPct)}%`,
                  minHeight: d.bookings === 0 ? "4px" : "12px",
                }}
                title={format(tipKey, { n: d.bookings })}
              />
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
