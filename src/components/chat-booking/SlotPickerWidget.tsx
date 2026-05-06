"use client";

import { formatKuwaitClock } from "@/lib/time";
import type { SlotPickerWidget } from "./widgets";

export function SlotPicker({
  widget,
  onPick,
  disabled,
}: {
  widget: SlotPickerWidget;
  onPick: (slotId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-1.5">
      {widget.slots.map((s) => {
        const time = formatKuwaitClock(s.start_time);
        const unavailable =
          s.is_past || s.status === "booked" || s.status === "closed";
        const label = s.is_past
          ? "Past"
          : s.status === "booked"
            ? "Booked"
            : s.status === "closed"
              ? "Closed"
              : null;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => !unavailable && onPick(s.id)}
            disabled={disabled || unavailable}
            className={[
              "flex h-14 flex-col items-center justify-center rounded-xl border text-base font-semibold transition-colors",
              unavailable
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                : "border-brand bg-white text-brand hover:bg-brand/5 active:bg-brand/10",
            ].join(" ")}
          >
            <span dir="ltr">{time}</span>
            {label ? (
              <span className="text-[10px] font-medium uppercase tracking-wider no-underline">
                {label}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
