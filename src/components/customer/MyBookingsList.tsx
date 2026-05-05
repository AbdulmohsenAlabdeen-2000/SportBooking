"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarOff, CreditCard, Loader2, Star, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { ReviewModal } from "@/components/customer/ReviewModal";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
} from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";
import { SPORT_ICON } from "@/lib/sports";
import type { BookingStatus, Sport } from "@/lib/types";

type CustomerBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  total_price: number;
  payment_url: string | null;
  refunded_at: string | null;
  court: { id: string; name: string; sport: Sport } | null;
  slot: { start_time: string; end_time: string } | null;
  review: { rating: number; comment: string | null } | null;
};

export function MyBookingsList({
  initial,
}: {
  initial: CustomerBooking[];
}) {
  const t = useDict();
  const router = useRouter();
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = useState<CustomerBooking | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [reviewOf, setReviewOf] = useState<CustomerBooking | null>(null);

  async function cancel(b: CustomerBooking) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${b.reference}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        toast(t.me.cancelled_success, "success");
        setConfirmCancel(null);
        router.refresh();
        return;
      }
      if (res.status === 409) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (json.error === "cancel_window_closed") {
          toast(t.me.cancel_window_closed, "error");
        } else {
          toast(t.me.cancelled_already_finalized, "error");
        }
        router.refresh();
      } else if (res.status === 404) {
        toast(t.me.not_found, "error");
      } else {
        toast(t.me.cant_cancel, "error");
      }
    } catch {
      toast(t.common.network_error, "error");
    } finally {
      setBusy(false);
    }
  }

  if (initial.length === 0) {
    return (
      <Card className="text-center text-slate-600">
        <CalendarOff
          className="mx-auto h-8 w-8 text-slate-400"
          aria-hidden
        />
        <p className="mt-2 text-base font-medium text-slate-900">
          {t.me.no_bookings_title}
        </p>
        <p className="mt-1 text-sm">{t.me.no_bookings_sub}</p>
        <Link
          href="/book"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-6 font-semibold text-white"
        >
          {t.me.book_a_court}
        </Link>
      </Card>
    );
  }

  // Group: upcoming first (confirmed + future), then past/finalized.
  const now = Date.now();
  const upcoming = initial.filter(
    (b) => b.status === "confirmed" && (b.slot ? new Date(b.slot.start_time).getTime() >= now : true),
  );
  const past = initial.filter(
    (b) =>
      !(
        b.status === "confirmed" &&
        b.slot &&
        new Date(b.slot.start_time).getTime() >= now
      ),
  );

  const cancelMessage = confirmCancel?.slot
    ? format(t.me.cancel_message_with_court, {
        court: confirmCancel.court?.name ?? "—",
        date: formatKuwaitFullDate(confirmCancel.slot.start_time.slice(0, 10)),
        time: formatKuwaitTimeRange(
          confirmCancel.slot.start_time,
          confirmCancel.slot.end_time,
        ),
      })
    : t.me.cancel_message_simple;

  return (
    <>
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">{t.me.upcoming}</h2>
          <ul className="mt-2 space-y-2">
            {upcoming.map((b) => (
              <BookingCard
                t={t}
                key={b.reference}
                booking={b}
                cancellable
                onCancel={() => setConfirmCancel(b)}
              />
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">{t.me.past}</h2>
          <ul className="mt-2 space-y-2">
            {past.map((b) => (
              <BookingCard
                t={t}
                key={b.reference}
                booking={b}
                // Once the slot has started, only the admin can refund.
                // The customer sees a "contact admin" hint instead of
                // a cancel button.
                cancellable={false}
                contactAdminToCancel={
                  b.status === "confirmed" &&
                  !!b.slot &&
                  new Date(b.slot.start_time).getTime() <= Date.now()
                }
                onCancel={() => setConfirmCancel(b)}
                onReview={() => setReviewOf(b)}
              />
            ))}
          </ul>
        </section>
      )}

      <ReviewModal
        open={reviewOf !== null}
        bookingId={reviewOf?.id ?? null}
        courtName={reviewOf?.court?.name ?? null}
        onClose={() => setReviewOf(null)}
        onSubmitted={() => {
          setReviewOf(null);
          router.refresh();
        }}
      />

      <ConfirmModal
        open={confirmCancel !== null}
        title={t.me.cancel_title}
        message={cancelMessage}
        confirmLabel={t.me.cancel_yes}
        cancelLabel={t.me.cancel_keep}
        variant="danger"
        busy={busy}
        onConfirm={() => (confirmCancel ? void cancel(confirmCancel) : null)}
        onCancel={() => (busy ? null : setConfirmCancel(null))}
      />
    </>
  );
}

function BookingCard({
  t,
  booking,
  cancellable,
  contactAdminToCancel = false,
  onCancel,
  onReview,
}: {
  t: Dict;
  booking: CustomerBooking;
  cancellable: boolean;
  contactAdminToCancel?: boolean;
  onCancel?: () => void;
  onReview?: () => void;
}) {
  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;

  const now = Date.now();
  const reviewable =
    !!booking.slot &&
    new Date(booking.slot.start_time).getTime() <= now &&
    booking.status !== "cancelled" &&
    booking.review === null;

  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          {SportIcon && (
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
              <SportIcon className="h-6 w-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">
              {booking.court?.name ?? "—"}
            </p>
            <p className="text-sm text-slate-600">
              {booking.slot
                ? `${formatKuwaitFullDate(booking.slot.start_time.slice(0, 10))} · ${formatKuwaitTimeRange(booking.slot.start_time, booking.slot.end_time)}`
                : "—"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <StatusPill status={booking.status} t={t} />
              <span className="font-mono text-[11px] text-slate-500">
                {booking.reference}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-medium text-slate-900">
                {formatKwd(booking.total_price)}
              </span>
              {booking.review ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">
                  {Array.from({ length: booking.review.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3 w-3 fill-amber-500 text-amber-500"
                      aria-hidden
                    />
                  ))}
                </span>
              ) : null}
            </div>
            {booking.review?.comment ? (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-600">
                &ldquo;{booking.review.comment}&rdquo;
              </p>
            ) : null}
          </div>
        </div>
        {(cancellable ||
          contactAdminToCancel ||
          reviewable ||
          booking.status === "pending_payment") && (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {booking.status === "pending_payment" && booking.payment_url ? (
              <a
                href={booking.payment_url}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                <CreditCard className="h-4 w-4" aria-hidden />{" "}
                {t.payment_status.pay_now}
              </a>
            ) : null}
            {reviewable ? (
              <button
                type="button"
                onClick={onReview}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 hover:bg-amber-50"
              >
                <Star className="h-4 w-4" aria-hidden /> {t.me.leave_review}
              </button>
            ) : null}
            {cancellable ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" aria-hidden /> {t.me.cancel_booking}
              </button>
            ) : null}
            {contactAdminToCancel ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600">
                {t.me.contact_admin_to_cancel}
              </span>
            ) : null}
          </div>
        )}
      </Card>
    </li>
  );
}

function StatusPill({ status, t }: { status: BookingStatus; t: Dict }) {
  const cls = {
    pending_payment: "bg-amber-50 text-amber-800 border-amber-200",
    confirmed: "bg-brand/10 text-brand border-brand/20",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    // declined rows are filtered server-side; defensive fallback only.
    declined: "bg-slate-100 text-slate-600 border-slate-200",
  }[status];
  const label = {
    pending_payment: t.payment_status.awaiting,
    confirmed: t.me.status_confirmed,
    completed: t.me.status_completed,
    cancelled: t.me.status_cancelled,
    declined: t.me.status_cancelled,
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
    </div>
  );
}
