"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import {
  formatKuwaitClock,
  formatKuwaitDayOfMonth,
  formatKuwaitFullDate,
  formatKuwaitWeekday,
  kuwaitTodayIso,
} from "@/lib/time";
import type { Court, SlotStatus } from "@/lib/types";

type AdminSlot = {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  booking: { reference: string; customer_name: string } | null;
};

const RANGE_DAYS = 7;

function plusDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function rangeDays(fromIso: string): string[] {
  return Array.from({ length: RANGE_DAYS }, (_, i) => plusDaysIso(fromIso, i));
}

export default function SlotManagerPage() {
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(kuwaitTodayIso());
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [ensureBusy, setEnsureBusy] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [activeDay, setActiveDay] = useState<string>(kuwaitTodayIso());
  const [bulk, setBulk] = useState<
    | null
    | { type: "close" | "open"; date: string; openCount: number; closedCount: number }
  >(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const ensuredRef = useRef(false);

  // Load courts once + ensure slots exist.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const courtsRes = await fetch("/api/courts", { cache: "no-store" });
        if (!courtsRes.ok) throw new Error("courts");
        const json = (await courtsRes.json()) as { courts: Court[] };
        if (cancel) return;
        setCourts(json.courts);
        if (json.courts.length > 0) setCourtId(json.courts[0].id);
      } catch {
        if (!cancel) toast("Couldn't load courts.", "error");
      }
    })();

    if (!ensuredRef.current) {
      ensuredRef.current = true;
      (async () => {
        try {
          await fetch("/api/admin/slots/ensure", { method: "POST" });
        } catch {
          // /ensure failures aren't fatal — gaps just won't auto-fill.
        } finally {
          if (!cancel) setEnsureBusy(false);
        }
      })();
    } else {
      setEnsureBusy(false);
    }

    return () => {
      cancel = true;
    };
  }, [toast]);

  const days = useMemo(() => rangeDays(from), [from]);
  const today = useMemo(() => kuwaitTodayIso(), []);

  // Keep the mobile "active day" inside the visible range.
  useEffect(() => {
    if (!days.includes(activeDay)) setActiveDay(days[0]);
  }, [days, activeDay]);

  const loadSlots = useCallback(
    async (court: string, fromIso: string) => {
      const toIso = plusDaysIso(fromIso, RANGE_DAYS - 1);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/slots?court_id=${court}&from=${fromIso}&to=${toIso}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { slots: AdminSlot[] };
        setSlots(json.slots);
      } catch {
        toast("Couldn't load slots.", "error");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  // Fetch when court / from changes (and after ensure resolves so /ensure
  // gets a chance to fill in any gaps before the read).
  useEffect(() => {
    if (!courtId || ensureBusy) return;
    void loadSlots(courtId, from);
  }, [courtId, from, ensureBusy, loadSlots]);

  const slotsByDay = useMemo(() => {
    const m = new Map<string, AdminSlot[]>(days.map((d) => [d, []]));
    for (const s of slots) {
      const day = s.start_time.slice(0, 10); // UTC date — works for our 8-22 Kuwait window since 8 KW = 5 UTC same day
      // More robust: bucket by computing the Kuwait calendar date
      const kwHourMs = new Date(s.start_time).getTime() + 3 * 3_600_000;
      const kwDate = new Date(kwHourMs).toISOString().slice(0, 10);
      const bucket = m.get(kwDate) ?? m.get(day);
      if (bucket) bucket.push(s);
    }
    return m;
  }, [slots, days]);

  // ─── Toggle ───────────────────────────────────────────────────────────────

  async function toggleSlot(slot: AdminSlot) {
    if (slot.status === "booked") {
      toast("Cancel via Bookings to free this slot.", "info");
      return;
    }
    if (pending[slot.id]) return;

    const next: SlotStatus = slot.status === "open" ? "closed" : "open";
    // Optimistic update
    setSlots((prev) =>
      prev.map((s) => (s.id === slot.id ? { ...s, status: next } : s)),
    );
    setPending((p) => ({ ...p, [slot.id]: true }));

    try {
      const res = await fetch(`/api/admin/slots/${slot.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        // Roll back
        setSlots((prev) =>
          prev.map((s) => (s.id === slot.id ? { ...s, status: slot.status } : s)),
        );
        if (res.status === 409) {
          toast("That slot just got booked. Refreshing.", "error");
          if (courtId) void loadSlots(courtId, from);
        } else {
          toast("Couldn't update — try again.", "error");
        }
      }
    } catch {
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, status: slot.status } : s)),
      );
      toast("Network error.", "error");
    } finally {
      setPending((p) => {
        const { [slot.id]: _drop, ...rest } = p;
        return rest;
      });
    }
  }

  // ─── Bulk ────────────────────────────────────────────────────────────────

  function openBulkConfirm(type: "close" | "open", day: string) {
    const list = slotsByDay.get(day) ?? [];
    setBulk({
      type,
      date: day,
      openCount: list.filter((s) => s.status === "open").length,
      closedCount: list.filter((s) => s.status === "closed").length,
    });
  }

  async function runBulk() {
    if (!bulk || !courtId || bulkBusy) return;
    setBulkBusy(true);
    try {
      const path = bulk.type === "close" ? "bulk-close" : "bulk-open";
      const res = await fetch(`/api/admin/slots/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ court_id: courtId, date: bulk.date }),
      });
      if (!res.ok) {
        toast("Bulk action failed — try again.", "error");
        return;
      }
      const json = (await res.json()) as
        | { closed: number; skipped: { id: string }[] }
        | { opened: number; skipped: { id: string }[] };
      const count =
        "closed" in json ? json.closed : "opened" in json ? json.opened : 0;
      const skippedNote = json.skipped.length
        ? ` (${json.skipped.length} booked left untouched)`
        : "";
      toast(
        `${bulk.type === "close" ? "Closed" : "Opened"} ${count} slot${count === 1 ? "" : "s"}${skippedNote}.`,
        "success",
      );
      if (courtId) await loadSlots(courtId, from);
    } catch {
      toast("Bulk action failed — try again.", "error");
    } finally {
      setBulkBusy(false);
      setBulk(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (courts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Loading courts…
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Slots</h1>
          <p className="mt-1 text-sm text-slate-500">
            Open or close court hours. Booked slots are read-only here — cancel via Bookings to free them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => courtId && loadSlots(courtId, from)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      {/* Toolbar: court selector + week navigator */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {courts.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCourtId(c.id)}
              className={[
                "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                c.id === courtId
                  ? "bg-slate-800 text-white"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setFrom(plusDaysIso(from, -7))}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Prev week
          </button>
          <button
            type="button"
            onClick={() => setFrom(today)}
            className="inline-flex h-9 items-center rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setFrom(plusDaysIso(from, 7))}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Next week <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {ensureBusy && (
        <p className="text-xs text-slate-500">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />
          Refreshing schedule…
        </p>
      )}

      {/* Mobile: date strip + single-day vertical list */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const isToday = d === today;
            const isActive = d === activeDay;
            return (
              <button
                type="button"
                key={d}
                onClick={() => setActiveDay(d)}
                className={[
                  "flex h-16 w-14 flex-none flex-col items-center justify-center rounded-xl border text-xs",
                  isActive
                    ? "border-slate-800 bg-slate-800 text-white"
                    : isToday
                      ? "border-slate-800 bg-white text-slate-900"
                      : "border-slate-200 bg-white text-slate-700",
                ].join(" ")}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {formatKuwaitWeekday(d)}
                </span>
                <span className="mt-0.5 text-base font-bold">
                  {formatKuwaitDayOfMonth(d)}
                </span>
              </button>
            );
          })}
        </div>
        <DayPanel
          date={activeDay}
          slots={slotsByDay.get(activeDay) ?? []}
          pending={pending}
          onToggle={toggleSlot}
          onBulk={openBulkConfirm}
        />
      </div>

      {/* Desktop: week grid */}
      <div className="hidden grid-cols-7 gap-3 md:grid">
        {days.map((d) => (
          <DayColumn
            key={d}
            date={d}
            slots={slotsByDay.get(d) ?? []}
            pending={pending}
            onToggle={toggleSlot}
            onBulk={openBulkConfirm}
            isToday={d === today}
          />
        ))}
      </div>

      <Legend />

      <ConfirmModal
        open={bulk !== null}
        title={
          bulk?.type === "close"
            ? "Close all open slots?"
            : "Open all closed slots?"
        }
        message={
          bulk
            ? bulk.type === "close"
              ? `${bulk.openCount} open slot${bulk.openCount === 1 ? "" : "s"} on ${formatKuwaitFullDate(bulk.date)} will be marked unavailable. Booked slots are not affected.`
              : `${bulk.closedCount} closed slot${bulk.closedCount === 1 ? "" : "s"} on ${formatKuwaitFullDate(bulk.date)} will be reopened. Booked slots are not affected.`
            : ""
        }
        confirmLabel={bulk?.type === "close" ? "Close all" : "Open all"}
        cancelLabel="Keep as-is"
        variant={bulk?.type === "close" ? "danger" : "default"}
        busy={bulkBusy}
        onConfirm={runBulk}
        onCancel={() => (bulkBusy ? null : setBulk(null))}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DayPanel({
  date,
  slots,
  pending,
  onToggle,
  onBulk,
}: {
  date: string;
  slots: AdminSlot[];
  pending: Record<string, boolean>;
  onToggle: (s: AdminSlot) => void;
  onBulk: (type: "close" | "open", date: string) => void;
}) {
  const counts = countByStatus(slots);
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
      <DayHeader date={date} counts={counts} onBulk={(t) => onBulk(t, date)} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {slots.map((s) => (
          <SlotCell
            key={s.id}
            slot={s}
            pending={!!pending[s.id]}
            onToggle={() => onToggle(s)}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  date,
  slots,
  pending,
  onToggle,
  onBulk,
  isToday,
}: {
  date: string;
  slots: AdminSlot[];
  pending: Record<string, boolean>;
  onToggle: (s: AdminSlot) => void;
  onBulk: (type: "close" | "open", date: string) => void;
  isToday: boolean;
}) {
  const counts = countByStatus(slots);
  return (
    <div
      className={`rounded-2xl border bg-white p-2 ${isToday ? "border-slate-800" : "border-slate-200"}`}
    >
      <DayHeader
        date={date}
        counts={counts}
        onBulk={(t) => onBulk(t, date)}
        compact
      />
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {slots.map((s) => (
          <SlotCell
            key={s.id}
            slot={s}
            pending={!!pending[s.id]}
            onToggle={() => onToggle(s)}
          />
        ))}
      </div>
    </div>
  );
}

function DayHeader({
  date,
  counts,
  onBulk,
  compact = false,
}: {
  date: string;
  counts: { open: number; closed: number; booked: number };
  onBulk: (type: "close" | "open") => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p
          className={`text-${compact ? "xs" : "sm"} font-semibold text-slate-900`}
        >
          {formatKuwaitWeekday(date)}{" "}
          <span className="text-slate-500">{formatKuwaitDayOfMonth(date)}</span>
        </p>
        <p className="text-[10px] text-slate-500">
          {counts.booked}b · {counts.open}o · {counts.closed}c
        </p>
      </div>
      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={() => onBulk("close")}
          disabled={counts.open === 0}
          className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Close all
        </button>
        <button
          type="button"
          onClick={() => onBulk("open")}
          disabled={counts.closed === 0}
          className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open all
        </button>
      </div>
    </div>
  );
}

function SlotCell({
  slot,
  pending,
  onToggle,
}: {
  slot: AdminSlot;
  pending: boolean;
  onToggle: () => void;
}) {
  const time = formatKuwaitClock(slot.start_time);
  const base =
    "flex min-h-[44px] flex-col items-stretch justify-center rounded-lg border px-2 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500";

  if (slot.status === "booked") {
    return (
      <span
        title={
          slot.booking
            ? `Booked — ${slot.booking.customer_name} (${slot.booking.reference})`
            : "Booked"
        }
        className={`${base} cursor-not-allowed border-red-200 bg-red-50 text-red-800`}
      >
        <span className="font-mono font-semibold">{time}</span>
        <span className="truncate text-[10px] text-red-700">
          {slot.booking?.customer_name?.split(" ")[0] ?? "Booked"}
        </span>
      </span>
    );
  }

  const cls =
    slot.status === "open"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
      : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-label={`${time} — ${slot.status} (tap to flip)`}
      className={`${base} ${cls} ${pending ? "opacity-60" : ""}`}
    >
      <span className="font-mono font-semibold">{time}</span>
      <span className="text-[10px] uppercase tracking-wider">
        {slot.status}
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      <LegendDot className="bg-emerald-500" label="Open" />
      <LegendDot className="bg-slate-400" label="Closed" />
      <LegendDot className="bg-red-400" label="Booked (read-only)" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function countByStatus(slots: AdminSlot[]) {
  let open = 0;
  let closed = 0;
  let booked = 0;
  for (const s of slots) {
    if (s.status === "open") open++;
    else if (s.status === "closed") closed++;
    else if (s.status === "booked") booked++;
  }
  return { open, closed, booked };
}

