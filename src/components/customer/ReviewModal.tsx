"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Star } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";

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
  const t = useDict();
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
      setError(t.review.err_pick_rating);
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
        toast(t.review.thanks, "success");
        onSubmitted();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409 && json.error === "already_reviewed") {
        setError(t.review.err_already);
      } else if (res.status === 409 && json.error === "booking_not_started") {
        setError(t.review.err_not_started);
      } else if (res.status === 409 && json.error === "booking_cancelled") {
        setError(t.review.err_cancelled);
      } else {
        setError(t.review.err_couldnt);
      }
    } catch {
      setError(t.review.err_network);
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
        aria-label={t.common.cancel}
        onClick={() => (busy ? null : onClose())}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h2 id="review-title" className="text-lg font-semibold text-slate-900">
          {t.review.title}
        </h2>
        {courtName ? (
          <p className="mt-1 text-sm text-slate-600">{courtName}</p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={format(
                  n === 1 ? t.review.star_one : t.review.star_other,
                  { n },
                )}
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
              {t.review.comment_label}
            </span>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={COMMENT_MAX}
              placeholder={t.review.comment_placeholder}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-snug outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="mt-1 text-end text-xs text-slate-500">
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
              {t.review.not_now}
            </button>
            <button
              type="submit"
              disabled={busy || rating === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                  {t.review.submitting}
                </>
              ) : (
                t.review.post
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
