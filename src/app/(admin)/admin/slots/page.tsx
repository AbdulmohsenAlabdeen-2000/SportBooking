"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import {
  formatKuwaitClock,
  formatKuwaitDayOfMonth,
  formatKuwaitFullDate,
  formatKuwaitWeekday,
  kuwaitTodayIso,
} from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";
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

function statusLabel(status: SlotStatus, t: Dict): string {
  if (status === "open") return t.admin.slots_status_open;
  if (status === "closed") return t.admin.slots_status_closed;
  return t.admin.slots_status_booked;
}

export default function SlotManagerPage() {
  const t = useDict();
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
  const [addSlotFor, setAddSlotFor] = useState<string | null>(null);
  const [addSlotBusy, setAddSlotBusy] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<AdminSlot | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const ensuredRef = useRef(false);

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
        if (!cancel) toast(t.admin.slots_couldnt_load_courts, "error");
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
  }, [toast, t.admin.slots_couldnt_load_courts]);

  const days = useMemo(() => rangeDays(from), [from]);
  const today = useMemo(() => kuwaitTodayIso(), []);

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
        toast(t.admin.slots_couldnt_load, "error");
      } finally {
        setLoading(false);
      }
    },
    [toast, t.admin.slots_couldnt_load],
  );

  useEffect(() => {
    if (!courtId || ensureBusy) return;
    void loadSlots(courtId, from);
  }, [courtId, from, ensureBusy, loadSlots]);

  const slotsByDay = useMemo(() => {
    const m = new Map<string, AdminSlot[]>(days.map((d) => [d, []]));
    for (const s of slots) {
      const day = s.start_time.slice(0, 10);
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
      toast(t.admin.slots_cancel_via_bookings, "info");
      return;
    }
    if (pending[slot.id]) return;

    const next: SlotStatus = slot.status === "open" ? "closed" : "open";
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
        setSlots((prev) =>
          prev.map((s) => (s.id === slot.id ? { ...s, status: slot.status } : s)),
        );
        if (res.status === 409) {
          toast(t.admin.slots_just_booked, "error");
          if (courtId) void loadSlots(courtId, from);
        } else {
          toast(t.admin.slots_couldnt_update, "error");
        }
      }
    } catch {
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, status: slot.status } : s)),
      );
      toast(t.common.network_error, "error");
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

  async function addCustomSlot(date: string, hour: number) {
    if (!courtId || addSlotBusy) return;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;

    const [y, m, d] = date.split("-").map(Number);
    const startUtcMs = Date.UTC(y, m - 1, d, hour - 3, 0, 0, 0);
    const endUtcMs = startUtcMs + 60 * 60 * 1000;
    const start_time = new Date(startUtcMs).toISOString();
    const end_time = new Date(endUtcMs).toISOString();

    setAddSlotBusy(true);
    try {
      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ court_id: courtId, start_time, end_time }),
      });
      if (res.ok) {
        toast(
          format(t.admin.slots_added_at, {
            time: `${String(hour).padStart(2, "0")}:00`,
          }),
          "success",
        );
        setAddSlotFor(null);
        await loadSlots(courtId, from);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409 && json.error === "slot_exists") {
        toast(t.admin.slots_already_taken, "error");
      } else {
        toast(t.admin.slots_couldnt_add, "error");
      }
    } catch {
      toast(t.common.network_error, "error");
    } finally {
      setAddSlotBusy(false);
    }
  }

  async function deleteSlot(slot: AdminSlot) {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/slots/${slot.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast(t.admin.slots_deleted, "success");
        setDeleteCandidate(null);
        if (courtId) await loadSlots(courtId, from);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409 && json.error === "slot_has_booking") {
        toast(t.admin.slots_has_booking, "error");
      } else {
        toast(t.admin.slots_couldnt_delete, "error");
      }
    } catch {
      toast(t.common.network_error, "error");
    } finally {
      setDeleteBusy(false);
    }
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
        toast(t.admin.slots_bulk_failed, "error");
        return;
      }
      const json = (await res.json()) as
        | { closed: number; skipped: { id: string }[] }
        | { opened: number; skipped: { id: string }[] };
      const count =
        "closed" in json ? json.closed : "opened" in json ? json.opened : 0;
      const skippedNote = json.skipped.length
        ? format(t.admin.slots_skipped, { n: json.skipped.length })
        : "";
      const tmpl =
        bulk.type === "close"
          ? count === 1
            ? t.admin.slots_closed_n_one
            : t.admin.slots_closed_n_other
          : count === 1
            ? t.admin.slots_opened_n_one
            : t.admin.slots_opened_n_other;
      toast(format(tmpl, { n: count, skipped: skippedNote }), "success");
      if (courtId) await loadSlots(courtId, from);
    } catch {
      toast(t.admin.slots_bulk_failed, "error");
    } finally {
      setBulkBusy(false);
      setBulk(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (courts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        {t.admin.slots_loading}
      </div>
    );
  }

  const bulkMessage = bulk
    ? bulk.type === "close"
      ? format(
          bulk.openCount === 1
            ? t.admin.slots_close_msg_one
            : t.admin.slots_close_msg_other,
          { n: bulk.openCount, date: formatKuwaitFullDate(bulk.date) },
        )
      : format(
          bulk.closedCount === 1
            ? t.admin.slots_open_msg_one
            : t.admin.slots_open_msg_other,
          { n: bulk.closedCount, date: formatKuwaitFullDate(bulk.date) },
        )
    : "";

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            {t.admin.slots_title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t.admin.slots_sub}</p>
        </div>
        <button
          type="button"
          onClick={() => courtId && loadSlots(courtId, from)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label={t.common.refresh}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          {t.common.refresh}
        </button>
      </div>

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
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t.admin.slots_prev_week}
          </button>
          <button
            type="button"
            onClick={() => setFrom(today)}
            className="inline-flex h-9 items-center rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.admin.slots_this_week}
          </button>
          <button
            type="button"
            onClick={() => setFrom(plusDaysIso(from, 7))}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.admin.slots_next_week} <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
        </div>
      </div>

      {ensureBusy && (
        <p className="text-xs text-slate-500">
          <Loader2 className="me-1 inline h-3 w-3 animate-spin" aria-hidden />
          {t.admin.slots_refreshing}
        </p>
      )}

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
          t={t}
          date={activeDay}
          slots={slotsByDay.get(activeDay) ?? []}
          pending={pending}
          onToggle={toggleSlot}
          onBulk={openBulkConfirm}
          onAdd={(d) => setAddSlotFor(d)}
          onDelete={(s) => setDeleteCandidate(s)}
        />
      </div>

      <div className="hidden grid-cols-7 gap-3 md:grid">
        {days.map((d) => (
          <DayColumn
            t={t}
            key={d}
            date={d}
            slots={slotsByDay.get(d) ?? []}
            pending={pending}
            onToggle={toggleSlot}
            onBulk={openBulkConfirm}
            onAdd={(date) => setAddSlotFor(date)}
            onDelete={(s) => setDeleteCandidate(s)}
            isToday={d === today}
          />
        ))}
      </div>

      <Legend t={t} />

      <ConfirmModal
        open={bulk !== null}
        title={
          bulk?.type === "close"
            ? t.admin.slots_close_title
            : t.admin.slots_open_title
        }
        message={bulkMessage}
        confirmLabel={
          bulk?.type === "close"
            ? t.admin.slots_close_confirm
            : t.admin.slots_open_confirm
        }
        cancelLabel={t.admin.slots_keep}
        variant={bulk?.type === "close" ? "danger" : "default"}
        busy={bulkBusy}
        onConfirm={runBulk}
        onCancel={() => (bulkBusy ? null : setBulk(null))}
      />

      <AddSlotModal
        t={t}
        open={addSlotFor !== null}
        date={addSlotFor}
        existingHours={
          addSlotFor
            ? new Set(
                (slotsByDay.get(addSlotFor) ?? []).map((s) =>
                  Number(formatKuwaitClock(s.start_time).slice(0, 2)),
                ),
              )
            : new Set()
        }
        busy={addSlotBusy}
        onConfirm={(hour) =>
          addSlotFor ? void addCustomSlot(addSlotFor, hour) : null
        }
        onCancel={() => (addSlotBusy ? null : setAddSlotFor(null))}
      />

      <ConfirmModal
        open={deleteCandidate !== null}
        title={t.admin.slots_delete_title}
        message={
          deleteCandidate
            ? format(t.admin.slots_delete_msg, {
                time: formatKuwaitClock(deleteCandidate.start_time),
                date: formatKuwaitFullDate(
                  deleteCandidate.start_time.slice(0, 10),
                ),
              })
            : ""
        }
        confirmLabel={t.admin.slots_delete_confirm}
        cancelLabel={t.admin.slots_delete_keep}
        variant="danger"
        busy={deleteBusy}
        onConfirm={() =>
          deleteCandidate ? void deleteSlot(deleteCandidate) : null
        }
        onCancel={() => (deleteBusy ? null : setDeleteCandidate(null))}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DayPanel({
  t,
  date,
  slots,
  pending,
  onToggle,
  onBulk,
  onAdd,
  onDelete,
}: {
  t: Dict;
  date: string;
  slots: AdminSlot[];
  pending: Record<string, boolean>;
  onToggle: (s: AdminSlot) => void;
  onBulk: (type: "close" | "open", date: string) => void;
  onAdd: (date: string) => void;
  onDelete: (s: AdminSlot) => void;
}) {
  const counts = countByStatus(slots);
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
      <DayHeader
        t={t}
        date={date}
        counts={counts}
        onBulk={(type) => onBulk(type, date)}
        onAdd={() => onAdd(date)}
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {slots.map((s) => (
          <SlotCell
            t={t}
            key={s.id}
            slot={s}
            pending={!!pending[s.id]}
            onToggle={() => onToggle(s)}
            onDelete={() => onDelete(s)}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  t,
  date,
  slots,
  pending,
  onToggle,
  onBulk,
  onAdd,
  onDelete,
  isToday,
}: {
  t: Dict;
  date: string;
  slots: AdminSlot[];
  pending: Record<string, boolean>;
  onToggle: (s: AdminSlot) => void;
  onBulk: (type: "close" | "open", date: string) => void;
  onAdd: (date: string) => void;
  onDelete: (s: AdminSlot) => void;
  isToday: boolean;
}) {
  const counts = countByStatus(slots);
  return (
    <div
      className={`rounded-2xl border bg-white p-2 ${isToday ? "border-slate-800" : "border-slate-200"}`}
    >
      <DayHeader
        t={t}
        date={date}
        counts={counts}
        onBulk={(type) => onBulk(type, date)}
        onAdd={() => onAdd(date)}
        compact
      />
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {slots.map((s) => (
          <SlotCell
            t={t}
            key={s.id}
            slot={s}
            pending={!!pending[s.id]}
            onToggle={() => onToggle(s)}
            onDelete={() => onDelete(s)}
          />
        ))}
      </div>
    </div>
  );
}

function DayHeader({
  t,
  date,
  counts,
  onBulk,
  onAdd,
  compact = false,
}: {
  t: Dict;
  date: string;
  counts: { open: number; closed: number; booked: number };
  onBulk: (type: "close" | "open") => void;
  onAdd: () => void;
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
          {format(t.admin.slots_b_o_c, {
            b: counts.booked,
            o: counts.open,
            c: counts.closed,
          })}
        </p>
      </div>
      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={() => onBulk("close")}
          disabled={counts.open === 0}
          className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.admin.slots_close_all}
        </button>
        <button
          type="button"
          onClick={() => onBulk("open")}
          disabled={counts.closed === 0}
          className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.admin.slots_open_all}
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label={t.admin.slots_add_aria}
          className="inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function SlotCell({
  t,
  slot,
  pending,
  onToggle,
  onDelete,
}: {
  t: Dict;
  slot: AdminSlot;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const time = formatKuwaitClock(slot.start_time);
  const base =
    "flex min-h-[44px] flex-col items-stretch justify-center rounded-lg border px-2 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500";

  if (slot.status === "booked") {
    return (
      <span
        title={
          slot.booking
            ? `${t.admin.slots_status_booked} — ${slot.booking.customer_name} (${slot.booking.reference})`
            : t.admin.slots_status_booked
        }
        className={`${base} cursor-not-allowed border-red-200 bg-red-50 text-red-800`}
      >
        <span className="font-mono font-semibold" dir="ltr">
          {time}
        </span>
        <span className="truncate text-[10px] text-red-700">
          {slot.booking?.customer_name?.split(" ")[0] ?? t.admin.slots_status_booked}
        </span>
      </span>
    );
  }

  const cls =
    slot.status === "open"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
      : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={format(t.admin.slots_status_label, {
          time,
          status: statusLabel(slot.status, t),
        })}
        className={`${base} ${cls} ${pending ? "opacity-60" : ""} w-full`}
      >
        <span className="font-mono font-semibold" dir="ltr">
          {time}
        </span>
        <span className="text-[10px] uppercase tracking-wider">
          {statusLabel(slot.status, t)}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title={t.common.delete}
        aria-label={format(t.admin.slots_delete_label, { time })}
        className="absolute end-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/80 text-slate-500 opacity-0 ring-1 ring-slate-300 transition-opacity hover:bg-white hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

function Legend({ t }: { t: Dict }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      <LegendDot className="bg-emerald-500" label={t.admin.slots_legend_open} />
      <LegendDot className="bg-slate-400" label={t.admin.slots_legend_closed} />
      <LegendDot className="bg-red-400" label={t.admin.slots_legend_booked} />
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

function AddSlotModal({
  t,
  open,
  date,
  existingHours,
  busy,
  onConfirm,
  onCancel,
}: {
  t: Dict;
  open: boolean;
  date: string | null;
  existingHours: Set<number>;
  busy: boolean;
  onConfirm: (hour: number) => void;
  onCancel: () => void;
}) {
  const initialHour = (() => {
    for (let h = 23; h >= 0; h--) {
      if (!existingHours.has(h)) return h;
    }
    return 23;
  })();
  const [hour, setHour] = useState(initialHour);

  useEffect(() => {
    if (!open) return;
    setHour(initialHour);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !date) return null;

  const taken = existingHours.has(hour);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label={t.common.cancel}
        onClick={() => (busy ? null : onCancel())}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">
          {format(t.admin.slots_add_title, {
            date: formatKuwaitFullDate(date),
          })}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.slots_add_sub}</p>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-900">
            {t.admin.slots_start_hour}
          </span>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="mt-1 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
          >
            {Array.from({ length: 24 }, (_, h) => h).map((h) => (
              <option key={h} value={h} disabled={existingHours.has(h)}>
                {String(h).padStart(2, "0")}:00
                {existingHours.has(h) ? t.admin.slots_taken_suffix : ""}
              </option>
            ))}
          </select>
        </label>
        {taken ? (
          <p className="mt-2 text-xs text-red-600">{t.admin.slots_already_msg}</p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(hour)}
            disabled={busy || taken}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t.admin.slots_adding}
              </>
            ) : (
              t.admin.slots_add
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
