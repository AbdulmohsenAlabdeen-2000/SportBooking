"use client";

import {
  formatKuwaitDayOfMonth,
  formatKuwaitWeekday,
  kuwaitTodayIso,
} from "@/lib/time";
import type { DatePickerWidget } from "./widgets";

export function DatePicker({
  widget,
  onPick,
  disabled,
}: {
  widget: DatePickerWidget;
  onPick: (date: string) => void;
  disabled?: boolean;
}) {
  const today = kuwaitTodayIso();
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
      {widget.days.map((d) => {
        const isToday = d.date === today;
        const isUnavailable = d.open_count === 0;
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => !isUnavailable && onPick(d.date)}
            disabled={disabled || isUnavailable}
            className={[
              "flex flex-col items-center justify-center gap-0.5 rounded-xl border p-2 text-center transition-colors",
              isUnavailable
                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                : isToday
                  ? "border-brand bg-brand/10 text-brand hover:bg-brand/15"
                  : "border-slate-200 bg-white text-slate-900 hover:border-brand hover:bg-brand/5",
            ].join(" ")}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {formatKuwaitWeekday(d.date)}
            </span>
            <span className="text-base font-bold tabular-nums">
              {formatKuwaitDayOfMonth(d.date)}
            </span>
            <span
              className={`text-[10px] ${isUnavailable ? "text-slate-400" : "text-slate-500"}`}
            >
              {isUnavailable ? "—" : `${d.open_count} open`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
