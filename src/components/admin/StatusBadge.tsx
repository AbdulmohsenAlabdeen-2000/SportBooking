"use client";

import { useDict } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n/dict.en";
import type { BookingStatus } from "@/lib/types";

const STYLES: Record<BookingStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-800 border border-amber-200",
  confirmed: "bg-brand/10 text-brand border border-brand/20",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border border-red-200",
};

function label(status: BookingStatus, t: Dict): string {
  if (status === "pending_payment") return t.payment_status.awaiting;
  if (status === "confirmed") return t.admin.bookings_status_confirmed;
  if (status === "completed") return t.admin.bookings_status_completed;
  return t.admin.bookings_status_cancelled;
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const t = useDict();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {label(status, t)}
    </span>
  );
}
