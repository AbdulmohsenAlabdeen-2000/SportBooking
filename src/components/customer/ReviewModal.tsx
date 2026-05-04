"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Star } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const COMMENT_MAX = 500;

export function ReviewModal({
  open,
  bookingId,
  courtName,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  bookingId: string | null;
  courtName: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setHover(0);
    setComment("");
    setError(null);
    setBusy(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !bookingId) return null;

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    if (rating < 1 || rating > 5) {
      setError("Pick a star rating from 1 to 5.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (res.status === 201) {
        toast("Thanks for the review!", "success");
        onSubmitted();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409 && json.error === "already_reviewed") {
        setError("You've already reviewed this booking.");
      } else if (res.status === 409 && json.error === "booking_not_started") {
        setError("You can only review a booking after the slot has started.");
      } else if (res.status === 409 && json.error === "booking_cancelled") {
        setError("Cancelled bookings can't be reviewed.");
      } else {
        setError("Couldn't submit — try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const display = hover || rating;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => (busy ? null : onClose())}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h2 id="review-title" className="text-lg font-semibold text-slate-900">
          How was your game?
        </h2>
        {courtName ? (
          <p className="mt-1 text-sm text-slate-600">{courtName}</p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          {/* Star picker */}
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className="rounded-md p-1 transition-transform hover:scale-110 motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Star
                  className={`h-9 w-9 transition-colors ${
                    n <= display
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-slate-300"
                  }`}
                  aria-hidden
                />
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-900">
              Comment (optional)
            </span>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={COMMENT_MAX}
              placeholder="What did you like? Anything we could fix?"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-snug outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="mt-1 text-right text-xs text-slate-500">
              {comment.length}/{COMMENT_MAX}
            </p>
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Not now
            </button>
            <button
              type="submit"
              disabled={busy || rating === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                  Submitting…
                </>
              ) : (
                "Post review"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
