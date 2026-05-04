"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import {
  formatKuwaitClock,
  formatKuwaitDayOfMonth,
  formatKuwaitTimeRange,
  formatKuwaitWeekday,
  formatKwd,
  isValidIsoDate,
  kuwaitTodayIso,
  nextNDaysIso,
  BOOKING_WINDOW_DAYS,
} from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";
import { SPORT_ICON } from "@/lib/sports";
import type { Court, Slot } from "@/lib/types";

type Day = { date: string; open_count: number; total_count: number };

export default function DateSlotPickerPage({
  params,
}: {
  params: { courtId: string };
}) {
  const t = useDict();
  const router = useRouter();
  const sp = useSearchParams();

  const today = useMemo(() => kuwaitTodayIso(), []);
  const days = useMemo(() => nextNDaysIso(BOOKING_WINDOW_DAYS), []);
  const dateParam = sp.get("date");
  const selectedDate =
    dateParam && isValidIsoDate(dateParam) && days.includes(dateParam)
      ? dateParam
      : today;

  const [court, setCourt] = useState<Court | null>(null);
  const [courtError, setCourtError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Day[] | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        setRefetchTick((t) => t + 1);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    if (sp.get("stale") === "1") {
      setRefetchTick((t) => t + 1);
      const next = new URLSearchParams(sp.toString());
      next.delete("stale");
      router.replace(
        `/book/${params.courtId}${next.toString() ? `?${next.toString()}` : ""}`,
        { scroll: false },
      );
    }
  }, [sp, router, params.courtId]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/courts/${params.courtId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`court_${res.status}`);
        const json = (await res.json()) as { court: Court };
        if (!cancel) setCourt(json.court);
      } catch {
        if (!cancel) setCourtError(t.book.court_not_found);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [params.courtId, refetchTick, t.book.court_not_found]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/courts/${params.courtId}/availability`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`avail_${res.status}`);
        const json = (await res.json()) as { days: Day[] };
        if (!cancel) setAvailability(json.days);
      } catch {
        // Date strip falls back to no dots — non-blocking.
      }
    })();
    return () => {
      cancel = true;
    };
  }, [params.courtId, refetchTick]);

  useEffect(() => {
    let cancel = false;
    setSlotsLoading(true);
    setSelectedSlotId(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/courts/${params.courtId}/slots?date=${selectedDate}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`slots_${res.status}`);
        const json = (await res.json()) as { slots: Slot[] };
        if (!cancel) setSlots(json.slots);
      } catch {
        if (!cancel) setSlots([]);
      } finally {
        if (!cancel) setSlotsLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [params.courtId, selectedDate, refetchTick]);

  const setDate = useCallback(
    (date: string) => {
      const next = new URLSearchParams(sp.toString());
      next.set("date", date);
      router.replace(`/book/${params.courtId}?${next.toString()}`, {
        scroll: false,
      });
    },
    [router, sp, params.courtId],
  );

  const dayCounts = useMemo(() => {
    const m = new Map<string, { open: number; total: number }>();
    for (const d of availability ?? []) {
      m.set(d.date, { open: d.open_count, total: d.total_count });
    }
    return m;
  }, [availability]);

  const selectedSlot = useMemo(
    () => slots?.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  );

  if (courtError) {
    return (
      <Container className="py-10">
        <Card className="text-center text-slate-700">
          <p>{courtError}</p>
          <Link href="/book" className="mt-4 inline-block text-brand underline">
            {t.book.back_to_courts}
          </Link>
        </Card>
      </Container>
    );
  }

  const SportIcon = court ? SPORT_ICON[court.sport] : null;

  return (
    <>
      <Container className="py-6 pb-32 md:py-10 md:pb-32">
        <Link
          href="/book"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{" "}
          {t.common.back}
        </Link>

        <div className="mt-3 flex items-center gap-3">
          {SportIcon && (
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
              <SportIcon className="h-6 w-6" aria-hidden />
            </span>
          )}
          <h1 className="min-w-0 truncate text-2xl font-bold text-slate-900 md:text-3xl">
            {court ? court.name : t.common.loading}
          </h1>
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">
            {t.book.pick_a_date}
          </h2>
          <DateStrip
            t={t}
            days={days}
            today={today}
            selected={selectedDate}
            counts={dayCounts}
            onPick={setDate}
          />
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">
            {t.book.pick_a_time}
          </h2>
          <div className="mt-3">
            {slotsLoading ? (
              <SlotsSkeleton />
            ) : (slots?.length ?? 0) === 0 ? (
              <Card className="text-center text-slate-600">
                {t.book.no_slots}
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {slots!.map((s) => (
                  <SlotCell
                    t={t}
                    key={s.id}
                    slot={s}
                    isSelected={s.id === selectedSlotId}
                    onSelect={() => setSelectedSlotId(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <Container className="flex items-center justify-between gap-3 py-3">
          <p className="min-w-0 flex-1 text-sm">
            {selectedSlot ? (
              <span className="text-slate-900">
                {t.book.selected_label}{" "}
                <span className="font-semibold">
                  {formatKuwaitTimeRange(
                    selectedSlot.start_time,
                    selectedSlot.end_time,
                  )}
                </span>
              </span>
            ) : (
              <span className="text-slate-500">{t.book.pick_time_short}</span>
            )}
          </p>
          <ContinueButton
            t={t}
            disabled={!selectedSlot || !court}
            href={
              selectedSlot && court
                ? `/book/${params.courtId}/details?slot=${selectedSlot.id}&date=${selectedDate}`
                : "#"
            }
            price={court ? formatKwd(court.price_per_slot) : ""}
          />
        </Container>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DateStrip({
  t,
  days,
  today,
  selected,
  counts,
  onPick,
}: {
  t: Dict;
  days: string[];
  today: string;
  selected: string;
  counts: Map<string, { open: number; total: number }>;
  onPick: (date: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(
      `[data-date="${selected}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <div
      ref={ref}
      className="mt-3 flex gap-2 overflow-x-auto pb-2"
      role="tablist"
      aria-label={t.book.select_date_aria}
    >
      {days.map((d) => {
        const isToday = d === today;
        const isSelected = d === selected;
        const c = counts.get(d);
        const disabled = c !== undefined && c.open === 0;
        return (
          <button
            key={d}
            type="button"
            data-date={d}
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            onClick={() => onPick(d)}
            className={[
              "flex h-20 w-16 flex-none flex-col items-center justify-center rounded-xl border text-sm transition-colors",
              isSelected
                ? "border-brand bg-brand text-white shadow-sm"
                : disabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : isToday
                    ? "border-brand bg-white text-brand"
                    : "border-slate-200 bg-white text-slate-900 hover:border-brand",
            ].join(" ")}
          >
            <span className="text-[11px] font-medium uppercase tracking-wider">
              {formatKuwaitWeekday(d)}
            </span>
            <span className="mt-1 text-lg font-bold leading-none">
              {formatKuwaitDayOfMonth(d)}
            </span>
            <span
              className={[
                "mt-1 text-[10px]",
                isSelected
                  ? "text-white/80"
                  : disabled
                    ? "text-slate-400"
                    : "text-slate-500",
              ].join(" ")}
            >
              {c ? format(t.book.open_count, { n: c.open }) : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SlotCell({
  t,
  slot,
  isSelected,
  onSelect,
}: {
  t: Dict;
  slot: Slot;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const time = formatKuwaitClock(slot.start_time);
  const baseCls =
    "flex min-h-[56px] flex-col items-center justify-center rounded-xl text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

  if (slot.status === "booked") {
    return (
      <span
        role="img"
        title={t.book.booked_title}
        aria-label={format(t.book.booked_aria, { time })}
        className={`${baseCls} cursor-not-allowed border border-slate-300 bg-slate-200 text-slate-500 line-through`}
      >
        <span dir="ltr">{time}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 no-underline">
          {t.book.booked}
        </span>
      </span>
    );
  }
  if (slot.status === "closed") {
    return (
      <span
        role="img"
        title={t.book.closed_title}
        aria-label={format(t.book.closed_aria, { time })}
        className={`${baseCls} cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400`}
      >
        <span>—</span>
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {t.book.closed}
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={
        isSelected
          ? `${baseCls} bg-brand text-white ring-2 ring-accent`
          : `${baseCls} border border-brand bg-white text-brand hover:bg-brand/5 active:bg-brand/10`
      }
    >
      <span dir="ltr">{time}</span>
    </button>
  );
}

function SlotsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-slate-200"
        />
      ))}
    </div>
  );
}

function ContinueButton({
  t,
  disabled,
  href,
  price,
}: {
  t: Dict;
  disabled: boolean;
  href: string;
  price: string;
}) {
  const cls =
    "inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors";
  if (disabled) {
    return (
      <span className={`${cls} cursor-not-allowed bg-slate-200 text-slate-500`}>
        {t.book.continue}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${cls} bg-accent text-white shadow-md hover:bg-accent-dark active:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`}
    >
      {t.book.continue} · {price}
    </Link>
  );
}
