"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  CalendarOff,
  CircleDot,
  LandPlot,
  Loader2,
  Star,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { ReviewModal } from "@/components/customer/ReviewModal";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
} from "@/lib/time";
import type { BookingStatus, Sport } from "@/lib/types";

type CustomerBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  total_price: number;
  court: { id: string; name: string; sport: Sport } | null;
  slot: { start_time: string; end_time: string } | null;
  review: { rating: number; comment: string | null } | null;
};

const SPORT_ICON: Record<Sport, LucideIcon> = {
  padel: Activity,
  tennis: CircleDot,
  football: LandPlot,
};

export function MyBookingsList({
  initial,
}: {
  initial: CustomerBooking[];
}) {
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
        toast("Booking cancelled. Slot is open again.", "success");
        setConfirmCancel(null);
        router.refresh();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        toast("This booking is already finalized.", "error");
        router.refresh();
      } else if (res.status === 404) {
        toast("Couldn't find that booking.", "error");
      } else {
        toast("Couldn't cancel — try again.", "error");
      }
    } catch {
      toast("Network error.", "error");
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
          No bookings yet
        </p>
        <p className="mt-1 text-sm">
          Pick a court to make your first booking.
        </p>
        <Link
          href="/book"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-6 font-semibold text-white"
        >
          Book a court
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

  return (
    <>
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700">Upcoming</h2>
          <ul className="mt-2 space-y-2">
            {upcoming.map((b) => (
              <BookingCard
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
          <h2 className="text-sm font-semibold text-slate-700">Past</h2>
          <ul className="mt-2 space-y-2">
            {past.map((b) => (
              <BookingCard
                key={b.reference}
                booking={b}
                cancellable={b.status === "confirmed"}
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
        title="Cancel this booking?"
        message={
          confirmCancel?.slot
            ? `Your ${confirmCancel.court?.name ?? "court"} booking on ${formatKuwaitFullDate(confirmCancel.slot.start_time.slice(0, 10))} at ${formatKuwaitTimeRange(confirmCancel.slot.start_time, confirmCancel.slot.end_time)} will be released and become available for others to book.`
            : "This booking will be cancelled."
        }
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
        variant="danger"
        busy={busy}
        onConfirm={() => (confirmCancel ? void cancel(confirmCancel) : null)}
        onCancel={() => (busy ? null : setConfirmCancel(null))}
      />
    </>
  );
}

function BookingCard({
  booking,
  cancellable,
  onCancel,
  onReview,
}: {
  booking: CustomerBooking;
  cancellable: boolean;
  onCancel?: () => void;
  onReview?: () => void;
}) {
  const SportIcon = booking.court ? SPORT_ICON[booking.court.sport] : null;

  // A booking is reviewable only after it has actually started, isn't
  // cancelled, and hasn't already been reviewed.
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
              <StatusPill status={booking.status} />
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
        {(cancellable || reviewable) && (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {reviewable ? (
              <button
                type="button"
                onClick={onReview}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 hover:bg-amber-50"
              >
                <Star className="h-4 w-4" aria-hidden /> Leave a review
              </button>
            ) : null}
            {cancellable ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" aria-hidden /> Cancel booking
              </button>
            ) : null}
          </div>
        )}
      </Card>
    </li>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const cls = {
    confirmed: "bg-brand/10 text-brand border-brand/20",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  }[status];
  const label = {
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// Used by the page-level loader skeleton — kept here so it travels with the
// list rather than being a page-level concern.
export function Loading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
    </div>
  );
}
