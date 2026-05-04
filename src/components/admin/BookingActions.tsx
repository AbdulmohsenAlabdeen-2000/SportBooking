"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useDict } from "@/lib/i18n/client";
import type { BookingStatus } from "@/lib/types";

export function BookingActions({
  reference,
  status,
}: {
  reference: string;
  status: BookingStatus;
}) {
  const t = useDict();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"complete" | "cancel" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const finalized = status === "completed" || status === "cancelled";

  async function patch(target: "completed" | "cancelled") {
    const res = await fetch(`/api/admin/bookings/${reference}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    if (res.ok) return { ok: true as const };
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false as const, status: res.status, error: json.error };
  }

  async function markDone() {
    if (busy || finalized) return;
    setBusy("complete");
    const result = await patch("completed");
    setBusy(null);
    if (result.ok) {
      toast(t.admin.detail_marked_done, "success");
      router.refresh();
    } else if (result.status === 409) {
      toast(t.admin.detail_finalized_already, "error");
      router.refresh();
    } else {
      toast(t.admin.detail_couldnt_update, "error");
    }
  }

  async function cancelBooking() {
    if (busy || finalized) return;
    setBusy("cancel");
    const result = await patch("cancelled");
    setBusy(null);
    setConfirmOpen(false);
    if (result.ok) {
      toast(t.admin.detail_cancelled, "success");
      router.refresh();
    } else if (result.status === 409) {
      toast(t.admin.detail_finalized_already, "error");
      router.refresh();
    } else {
      toast(t.admin.detail_couldnt_cancel, "error");
    }
  }

  if (finalized) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {t.admin.detail_finalized}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <button
          type="button"
          onClick={markDone}
          disabled={busy !== null}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-60"
        >
          {busy === "complete" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          )}
          {t.admin.detail_mark_done}
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy !== null}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" aria-hidden />
          {t.admin.detail_cancel}
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t.admin.detail_cancel_title}
        message={t.admin.detail_cancel_msg}
        confirmLabel={t.admin.detail_cancel_yes}
        cancelLabel={t.admin.detail_keep}
        variant="danger"
        busy={busy === "cancel"}
        onConfirm={cancelBooking}
        onCancel={() => (busy === null ? setConfirmOpen(false) : null)}
      />
    </>
  );
}
