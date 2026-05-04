"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import { sportLabel } from "@/lib/sports";
import type { Dict } from "@/lib/i18n/dict.en";
import { SPORTS, type Court, type Sport } from "@/lib/types";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type CourtFormProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<Court>;
  onClose: () => void;
  onSaved: () => void;
};

const DURATIONS = [30, 45, 60, 90, 120];

type Errors = Partial<Record<string, string>>;

function sportOption(sport: Sport, t: Dict): string {
  return sportLabel(sport, t);
}

export function CourtForm({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: CourtFormProps) {
  const t = useDict();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("padel");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [price, setPrice] = useState("8.000");
  const [duration, setDuration] = useState("60");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  async function handleImageFile(file: File) {
    setImageUploadError(null);
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageUploadError(t.admin.court_form_err_invalid_image_type);
      return;
    }
    if (file.size === 0) {
      setImageUploadError(t.admin.court_form_err_image_empty);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageUploadError(t.admin.court_form_err_image_too_large);
      return;
    }
    setImageUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/courts/upload-image", {
        method: "POST",
        body,
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (res.status === 201 && json.url) {
        setImageUrl(json.url);
        return;
      }
      if (res.status === 415) {
        setImageUploadError(t.admin.court_form_err_invalid_image_type);
      } else if (res.status === 413) {
        setImageUploadError(t.admin.court_form_err_image_too_large);
      } else if (json.error === "bucket_missing") {
        setImageUploadError(t.admin.court_form_err_bucket_missing);
      } else {
        setImageUploadError(t.admin.court_form_err_image_upload);
      }
    } catch {
      setImageUploadError(t.common.network_error);
    } finally {
      setImageUploading(false);
    }
  }

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
    setImageUrl(initial?.image_url ?? "");
    setImageUploadError(null);
    setImageUploading(false);
    dialogRef.current?.focus();
  }, [open, initial]);

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
      image_url: imageUrl.trim() || null,
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
        setErrors({ name: t.admin.court_form_err_name_taken });
      } else if (res.status === 400 && Array.isArray(json.details)) {
        const map: Errors = {};
        for (const d of json.details) map[d.field] = humanize(d.error, t);
        setErrors(map);
      } else {
        setTopError(t.admin.court_form_err_save);
      }
    } catch {
      setTopError(t.common.network_error);
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
        aria-label={t.admin.court_form_close_aria}
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
          {mode === "create"
            ? t.admin.court_form_add_title
            : t.admin.court_form_edit_title}
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
          <Field label={t.admin.court_form_name} error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className={inputCls(!!errors.name)}
            />
          </Field>

          <Field label={t.admin.court_form_sport} error={errors.sport}>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className={inputCls(!!errors.sport)}
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {sportOption(s, t)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t.admin.court_form_capacity} error={errors.capacity}>
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
            <Field label={t.admin.court_form_price} error={errors.price_per_slot}>
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
            label={t.admin.court_form_duration}
            error={errors.slot_duration_minutes}
          >
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputCls(!!errors.slot_duration_minutes)}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {format(t.admin.court_form_duration_unit, { n: d })}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.admin.court_form_description} error={errors.description}>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className={`${inputCls(!!errors.description)} h-auto py-2 leading-snug`}
            />
          </Field>

          <Field label={t.admin.court_form_image} error={errors.image_url}>
            <ImageUploader
              t={t}
              imageUrl={imageUrl}
              uploading={imageUploading}
              uploadError={imageUploadError}
              onPick={(file) => void handleImageFile(file)}
              onRemove={() => {
                setImageUrl("");
                setImageUploadError(null);
              }}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            {t.admin.court_form_active}
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                  {t.admin.court_form_saving}
                </>
              ) : mode === "create" ? (
                t.admin.court_form_create
              ) : (
                t.admin.court_form_save
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

function ImageUploader({
  t,
  imageUrl,
  uploading,
  uploadError,
  onPick,
  onRemove,
}: {
  t: Dict;
  imageUrl: string;
  uploading: boolean;
  uploadError: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFromInput() {
    fileInputRef.current?.click();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onPick(file);
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          // Reset so picking the same filename twice still fires onChange.
          e.target.value = "";
        }}
      />

      {imageUrl ? (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-40 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-slate-900/70 to-transparent p-2">
            <button
              type="button"
              onClick={pickFromInput}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/95 px-3 text-xs font-medium text-slate-800 shadow-sm hover:bg-white disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              {uploading ? t.admin.court_form_image_uploading : t.admin.court_form_image_replace}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600/90 px-3 text-xs font-medium text-white shadow-sm hover:bg-red-600 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t.admin.court_form_image_remove}
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragOver
              ? "border-brand bg-brand/5"
              : "border-slate-300 bg-slate-50 hover:bg-slate-100",
            uploading ? "pointer-events-none opacity-70" : "",
          ].join(" ")}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-5 w-5" aria-hidden />
            )}
          </span>
          <p className="text-sm font-medium text-slate-700">
            {uploading ? t.admin.court_form_image_uploading : t.admin.court_form_image_drop}
          </p>
          {!uploading && (
            <>
              <p className="text-xs text-slate-500">
                {t.admin.court_form_image_or}
              </p>
              <button
                type="button"
                onClick={pickFromInput}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                {t.admin.court_form_image_browse}
              </button>
              <p className="text-[11px] text-slate-400">
                {t.admin.court_form_image_hint}
              </p>
            </>
          )}
        </div>
      )}

      {uploadError ? (
        <p className="mt-2 text-sm text-red-600">{uploadError}</p>
      ) : null}
    </div>
  );
}

function humanize(code: string, t: Dict): string {
  switch (code) {
    case "required":
      return t.admin.court_form_err_required;
    case "invalid_length":
      return t.admin.court_form_err_invalid_length;
    case "invalid_sport":
      return t.admin.court_form_err_invalid_sport;
    case "invalid_capacity":
      return t.admin.court_form_err_invalid_capacity;
    case "invalid_price":
      return t.admin.court_form_err_invalid_price;
    case "invalid_duration":
      return t.admin.court_form_err_invalid_duration;
    case "invalid_url":
      return t.admin.court_form_err_invalid_url;
    case "too_long":
      return t.admin.court_form_err_too_long;
    default:
      return t.admin.court_form_err_correct;
  }
}
