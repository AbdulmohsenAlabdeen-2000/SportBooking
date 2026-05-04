"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CircleDot,
  LandPlot,
  Pencil,
  PlusCircle,
  Power,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { CourtForm } from "@/components/admin/CourtForm";
import { formatKwd } from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";
import type { Court, Sport } from "@/lib/types";

const SPORT_ICON: Record<Sport, LucideIcon> = {
  padel: Activity,
  tennis: CircleDot,
  football: LandPlot,
};

function sportLabel(sport: Sport, t: Dict): string {
  if (sport === "padel") return t.hero.pill_padel;
  if (sport === "tennis") return t.hero.pill_tennis;
  return t.hero.pill_football;
}

type AdminCourt = Court & { is_active: boolean; created_at?: string };

export function CourtsManager() {
  const t = useDict();
  const { toast } = useToast();
  const [courts, setCourts] = useState<AdminCourt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState<
    | { mode: "create" }
    | { mode: "edit"; court: AdminCourt }
    | null
  >(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminCourt | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/courts", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { courts: AdminCourt[] };
      setCourts(json.courts);
    } catch {
      toast(t.admin.courts_err_load, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaved(message: string) {
    setFormOpen(null);
    toast(message, "success");
    await load();
  }

  async function deactivate(court: AdminCourt) {
    if (busyId) return;
    setBusyId(court.id);
    try {
      const res = await fetch(`/api/admin/courts/${court.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(format(t.admin.courts_deactivated, { name: court.name }), "success");
      await load();
    } catch {
      toast(t.admin.courts_err_deactivate, "error");
    } finally {
      setBusyId(null);
      setConfirmDeactivate(null);
    }
  }

  async function reactivate(court: AdminCourt) {
    if (busyId) return;
    setBusyId(court.id);
    try {
      const res = await fetch(`/api/admin/courts/${court.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(format(t.admin.courts_reactivated, { name: court.name }), "success");
      await load();
    } catch {
      toast(t.admin.courts_err_reactivate, "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            {t.admin.courts_title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t.admin.courts_sub}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label={t.common.refresh}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
            {t.common.refresh}
          </button>
          <button
            type="button"
            onClick={() => setFormOpen({ mode: "create" })}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <PlusCircle className="h-4 w-4" aria-hidden /> {t.admin.courts_add}
          </button>
        </div>
      </div>

      {!courts ? (
        <SkeletonList />
      ) : courts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {t.admin.courts_empty_part1}
          <strong>{t.admin.courts_empty_strong}</strong>
          {t.admin.courts_empty_part2}
        </div>
      ) : (
        <ul className="space-y-2">
          {courts.map((c) => {
            const Icon = SPORT_ICON[c.sport];
            return (
              <li
                key={c.id}
                className={`rounded-2xl border bg-white p-4 ${c.is_active ? "border-slate-200" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl ${c.is_active ? "bg-brand/10 text-brand" : "bg-slate-200 text-slate-500"}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p
                        className={`text-base font-semibold ${c.is_active ? "text-slate-900" : "text-slate-500"}`}
                      >
                        {c.name}
                      </p>
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                        {sportLabel(c.sport, t)}
                      </span>
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          c.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600",
                        ].join(" ")}
                      >
                        {c.is_active ? t.admin.courts_active : t.admin.courts_inactive}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {format(t.admin.courts_capacity_line, {
                        capacity: c.capacity,
                        price: formatKwd(Number(c.price_per_slot)),
                        minutes: c.slot_duration_minutes,
                      })}
                    </p>
                    {c.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {c.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setFormOpen({ mode: "edit", court: c })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> {t.admin.courts_edit}
                    </button>
                    {c.is_active ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeactivate(c)}
                        disabled={busyId === c.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Power className="h-3.5 w-3.5" aria-hidden /> {t.admin.courts_deactivate}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void reactivate(c)}
                        disabled={busyId === c.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        <Power className="h-3.5 w-3.5" aria-hidden /> {t.admin.courts_reactivate}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CourtForm
        open={formOpen !== null}
        mode={formOpen?.mode ?? "create"}
        initial={formOpen?.mode === "edit" ? formOpen.court : undefined}
        onClose={() => setFormOpen(null)}
        onSaved={() =>
          handleSaved(
            formOpen?.mode === "edit"
              ? t.admin.court_form_updated
              : t.admin.court_form_created,
          )
        }
      />

      <ConfirmModal
        open={confirmDeactivate !== null}
        title={t.admin.courts_deactivate_title}
        message={format(t.admin.courts_deactivate_msg, {
          name: confirmDeactivate?.name ?? "",
        })}
        confirmLabel={t.admin.courts_deactivate_yes}
        cancelLabel={t.admin.courts_deactivate_keep}
        variant="danger"
        busy={busyId === confirmDeactivate?.id}
        onConfirm={() =>
          confirmDeactivate ? void deactivate(confirmDeactivate) : null
        }
        onCancel={() => (busyId ? null : setConfirmDeactivate(null))}
      />
    </section>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white"
        />
      ))}
    </div>
  );
}
