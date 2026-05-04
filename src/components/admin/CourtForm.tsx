"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { Court, Sport } from "@/lib/types";

export type CourtFormProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<Court>;
  onClose: () => void;
  onSaved: () => void;
};

const SPORTS: Sport[] = ["padel", "tennis", "football"];
const DURATIONS = [30, 45, 60, 90, 120];

type Errors = Partial<Record<string, string>>;

export function CourtForm({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: CourtFormProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("padel");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [price, setPrice] = useState("8.000");
  const [duration, setDuration] = useState("60");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // Reset/seed form when opened.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTopError(null);
    setSubmitting(false);
    setName(initial?.name ?? "");
    setSport((initial?.sport as Sport) ?? "padel");
    setDescription(initial?.description ?? "");
    setCapacity(String(initial?.capacity ?? 4));
    setPrice(String(initial?.price_per_slot ?? "8.000"));
    setDuration(String(initial?.slot_duration_minutes ?? 60));
    setIsActive(initial?.is_active ?? true);
    dialogRef.current?.focus();
  }, [open, initial]);

  // Body-scroll lock + Escape close while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, submitting, onClose]);

  if (!open) return null;

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setTopError(null);
    setErrors({});
    setSubmitting(true);

    const payload = {
      name: name.trim(),
      sport,
      description: description.trim() || null,
      capacity: Number(capacity),
      price_per_slot: Number(price),
      slot_duration_minutes: Number(duration),
      is_active: isActive,
    };

    try {
      const url =
        mode === "create"
          ? "/api/admin/courts"
          : `/api/admin/courts/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 201 || res.status === 200) {
        onSaved();
        return;
      }

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { field: string; error: string }[];
      };
      if (res.status === 409 && json.error === "name_taken") {
        setErrors({ name: "Another court already uses this name." });
      } else if (res.status === 400 && Array.isArray(json.details)) {
        const map: Errors = {};
        for (const d of json.details) map[d.field] = humanize(d.error);
        setErrors(map);
      } else {
        setTopError("Couldn't save — try again.");
      }
    } catch {
      setTopError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="court-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => (submitting ? null : onClose())}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 outline-none max-h-[90vh]"
      >
        <h2
          id="court-form-title"
          className="text-lg font-semibold text-slate-900"
        >
          {mode === "create" ? "Add a court" : "Edit court"}
        </h2>

        {topError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {topError}
          </p>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          <Field label="Name" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className={inputCls(!!errors.name)}
            />
          </Field>

          <Field label="Sport" error={errors.sport}>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className={inputCls(!!errors.sport)}
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity" error={errors.capacity}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={inputCls(!!errors.capacity)}
              />
            </Field>
            <Field label="Price / slot (KWD)" error={errors.price_per_slot}>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls(!!errors.price_per_slot)}
              />
            </Field>
          </div>

          <Field
            label="Slot duration (min)"
            error={errors.slot_duration_minutes}
          >
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputCls(!!errors.slot_duration_minutes)}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description (optional)" error={errors.description}>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className={`${inputCls(!!errors.description)} h-auto py-2 leading-snug`}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Active (bookable by customers)
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
                </>
              ) : mode === "create" ? (
                "Create court"
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900">{label}</label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return [
    "block h-11 w-full rounded-xl border bg-white px-3 text-base text-slate-900 outline-none transition focus:ring-2",
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-slate-500",
  ].join(" ");
}

function humanize(code: string): string {
  switch (code) {
    case "required":
      return "This field is required.";
    case "invalid_length":
      return "Name must be 2–80 characters.";
    case "invalid_sport":
      return "Pick padel, tennis, or football.";
    case "invalid_capacity":
      return "Capacity must be 1–100.";
    case "invalid_price":
      return "Price must be a non-negative number.";
    case "invalid_duration":
      return "Pick a supported slot duration.";
    case "too_long":
      return "Description must be 500 characters or fewer.";
    default:
      return "Please correct this field.";
  }
}
