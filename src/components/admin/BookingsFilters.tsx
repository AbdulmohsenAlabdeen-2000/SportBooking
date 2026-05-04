"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { Court, BookingStatus } from "@/lib/types";

const STATUS_PILLS: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type Filters = {
  from: string;
  to: string;
  court_id: string;
  status: BookingStatus | "all";
  q: string;
};

export function BookingsFilters({
  initial,
  courts,
}: {
  initial: Filters;
  courts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [courtId, setCourtId] = useState(initial.court_id);
  const [status, setStatus] = useState<BookingStatus | "all">(initial.status);
  const [q, setQ] = useState(initial.q);

  // Re-sync local state if URL changes (e.g. browser back).
  useEffect(() => {
    setFrom(sp.get("from") ?? initial.from);
    setTo(sp.get("to") ?? initial.to);
    setCourtId(sp.get("court_id") ?? "");
    setStatus(((sp.get("status") as BookingStatus | "all") ?? "all") || "all");
    setQ(sp.get("q") ?? "");
  }, [sp, initial.from, initial.to]);

  const queryString = useMemo(() => {
    const next = new URLSearchParams();
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (courtId) next.set("court_id", courtId);
    if (status && status !== "all") next.set("status", status);
    if (q.trim()) next.set("q", q.trim());
    next.set("page", "1");
    return next.toString();
  }, [from, to, courtId, status, q]);

  function apply() {
    router.push(`${pathname}?${queryString}`);
  }

  function reset() {
    setFrom(initial.from);
    setTo(initial.to);
    setCourtId("");
    setStatus("all");
    setQ("");
    router.push(pathname);
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    apply();
  }

  function setStatusPill(next: BookingStatus | "all") {
    setStatus(next);
    const params = new URLSearchParams(sp.toString());
    if (next === "all") params.delete("status");
    else params.set("status", next);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <form onSubmit={onSubmit} className="space-y-3 p-3 md:p-4">
        {/* Search always visible */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search reference, name, phone…"
              value={q}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setQ(e.target.value)
              }
              className="block h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg bg-slate-800 px-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 md:hidden"
          >
            Filters
            {open ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((p) => (
            <button
              type="button"
              key={p.value}
              onClick={() => setStatusPill(p.value)}
              className={[
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium",
                status === p.value
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date + court — always visible on md+, accordion on mobile */}
        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 ${open ? "" : "hidden md:grid"}`}
        >
          <label className="text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Court
            <select
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">All courts</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Reset
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 md:hidden"
          >
            Apply
          </button>
        </div>
      </form>
    </section>
  );
}

export type { Filters };
