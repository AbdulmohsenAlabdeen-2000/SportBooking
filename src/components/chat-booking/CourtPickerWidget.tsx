"use client";

import { Flame, Sparkles, Users } from "lucide-react";
import { SPORT_ICON, sportLabel } from "@/lib/sports";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import type { CourtPickerWidget } from "./widgets";

export function CourtPicker({
  widget,
  onPick,
  disabled,
}: {
  widget: CourtPickerWidget;
  onPick: (courtId: string, courtName: string) => void;
  disabled?: boolean;
}) {
  const t = useDict();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {widget.courts.map((c) => {
        const Icon = SPORT_ICON[c.sport];
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id, c.name)}
            disabled={disabled}
            className="group relative flex items-stretch gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left transition-all hover:border-brand hover:shadow-md disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
          >
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.image_url}
                alt=""
                className="h-20 w-20 flex-none rounded-xl object-cover transition-transform group-hover:scale-105 motion-reduce:transform-none"
              />
            ) : (
              <span className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-8 w-8" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1 py-1 pe-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                  {sportLabel(c.sport, t)}
                </p>
                {c.is_popular ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    <Flame className="h-2.5 w-2.5" aria-hidden />
                    {t.courts.badge_popular}
                  </span>
                ) : null}
                {c.is_new ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    <Sparkles className="h-2.5 w-2.5" aria-hidden />
                    {t.courts.badge_new}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                {c.name}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Users className="h-3 w-3" aria-hidden />
                {format(t.courts.capacity, { count: c.capacity })}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-700">
                {c.price_per_slot.toFixed(3)} KWD
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
