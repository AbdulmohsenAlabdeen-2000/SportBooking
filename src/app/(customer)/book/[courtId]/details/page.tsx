"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { createBrowserClient } from "@/lib/supabase/browser";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
  isValidIsoDate,
} from "@/lib/time";
import { useDict } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n/dict.en";
import { SPORT_ICON } from "@/lib/sports";
import type { Court, Slot } from "@/lib/types";

type CustomerProfile = { user_id: string; name: string; phone: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const NOTES_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApiError = {
  error: string;
  details?: { field: string; error: string }[];
};

type BookingResponse = {
  booking: { reference: string };
};

export default function BookingDetailsPage({
  params,
}: {
  params: { courtId: string };
}) {
  const t = useDict();
  const router = useRouter();
  const sp = useSearchParams();
  const slotId = sp.get("slot");
  const dateParam = sp.get("date");
  const date = dateParam && isValidIsoDate(dateParam) ? dateParam : null;
  const { toast } = useToast();

  const [court, setCourt] = useState<Court | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const supabase = createBrowserClient();
        const { data: userResp } = await supabase.auth.getUser();
        const user = userResp.user;
        const here = `/book/${params.courtId}/details${
          slotId && date ? `?slot=${slotId}&date=${date}` : ""
        }`;
        if (!user) {
          router.replace(`/login?next=${encodeURIComponent(here)}`);
          return;
        }
        const { data: row } = await supabase
          .from("customers")
          .select("user_id, name, phone")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancel) return;
        if (!row) {
          router.replace(`/signup?next=${encodeURIComponent(here)}`);
          return;
        }
        setProfile(row as CustomerProfile);
        setName(row.name);
        setPhone(row.phone.replace(/^\+?965/, ""));
        setAuthChecked(true);
      } catch {
        if (!cancel) setAuthChecked(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [params.courtId, slotId, date, router]);

  useEffect(() => {
    let cancel = false;
    if (!slotId || !date) {
      setLoadError(t.book.err_missing_slot);
      return;
    }
    (async () => {
      try {
        const [courtRes, slotsRes] = await Promise.all([
          fetch(`/api/courts/${params.courtId}`, { cache: "no-store" }),
          fetch(
            `/api/courts/${params.courtId}/slots?date=${date}`,
            { cache: "no-store" },
          ),
        ]);
        if (!courtRes.ok) throw new Error(`court_${courtRes.status}`);
        if (!slotsRes.ok) throw new Error(`slots_${slotsRes.status}`);
        const courtJson = (await courtRes.json()) as { court: Court };
        const slotsJson = (await slotsRes.json()) as { slots: Slot[] };
        const found = slotsJson.slots.find((s) => s.id === slotId) ?? null;
        if (!found) throw new Error("slot_not_found");
        if (cancel) return;
        setCourt(courtJson.court);
        setSlot(found);
        if (found.status !== "open") {
          setLoadError(t.book.err_slot_unavailable);
        }
      } catch {
        if (!cancel) setLoadError(t.book.err_load_slot);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [params.courtId, slotId, date, t.book.err_missing_slot, t.book.err_slot_unavailable, t.book.err_load_slot]);

  const backToStep2 = useMemo(() => {
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    return `/book/${params.courtId}${qs.toString() ? `?${qs.toString()}` : ""}`;
  }, [date, params.courtId]);

  const backToStep2Stale = useMemo(() => {
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    qs.set("stale", "1");
    return `/book/${params.courtId}?${qs.toString()}`;
  }, [date, params.courtId]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      e.name = t.book.err_name_length;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 8) {
      e.phone = t.book.err_phone;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      e.email = t.book.err_email;
    }
    if (notes.length > NOTES_MAX) {
      e.notes = t.book.err_notes_long;
    }
    return e;
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;

    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors({});
    if (!slot || !slotId) return;

    setSubmitting(true);
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slot_id: slotId,
          customer_name: name.trim(),
          customer_phone: phoneDigits,
          customer_email: email.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (res.status === 201) {
        const json = (await res.json()) as BookingResponse;
        router.replace(`/book/confirmed/${json.booking.reference}`);
        return;
      }

      const errJson = (await res.json().catch(() => ({}))) as ApiError;

      if (res.status === 409) {
        toast(t.book.err_slot_taken, "error");
        router.push(backToStep2Stale);
        return;
      }

      if (res.status === 400 && Array.isArray(errJson.details)) {
        const fieldMap: Record<string, string> = {};
        for (const d of errJson.details) {
          if (d.field === "customer_name") fieldMap.name = humanize(d.error, t);
          else if (d.field === "customer_phone")
            fieldMap.phone = humanize(d.error, t);
          else if (d.field === "customer_email")
            fieldMap.email = humanize(d.error, t);
          else if (d.field === "notes") fieldMap.notes = humanize(d.error, t);
        }
        if (Object.keys(fieldMap).length > 0) {
          setErrors(fieldMap);
          return;
        }
      }

      if (res.status === 429) {
        toast(t.book.err_too_many, "error");
        return;
      }

      toast(t.book.err_generic, "error");
    } catch {
      toast(t.book.err_network, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const SportIcon = court ? SPORT_ICON[court.sport] : null;

  if (!authChecked) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      </Container>
    );
  }

  return (
    <>
      <Container className="py-6 pb-32 md:py-10 md:pb-32">
        <Link
          href={backToStep2}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{" "}
          {t.common.back}
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
          {t.book.details_title}
        </h1>

        {loadError ? (
          <Card className="mt-6 text-center text-slate-700">
            <p>{loadError}</p>
            <Link
              href={backToStep2}
              className="mt-4 inline-block text-brand underline"
            >
              {t.book.details_back}
            </Link>
          </Card>
        ) : (
          <>
            <Card className="mt-6">
              {court && slot && date ? (
                <div className="flex gap-3">
                  {SportIcon && (
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <SportIcon className="h-6 w-6" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <p className="text-base font-semibold text-slate-900">
                      {court.name}
                    </p>
                    <p className="text-slate-600">
                      {formatKuwaitFullDate(date)}
                    </p>
                    <p className="text-slate-600">
                      {formatKuwaitTimeRange(slot.start_time, slot.end_time)}
                    </p>
                    <p className="pt-1 font-semibold text-slate-900">
                      {formatKwd(court.price_per_slot)}
                    </p>
                  </div>
                </div>
              ) : (
                <SummarySkeleton />
              )}
            </Card>

            <form
              id="booking-form"
              className="mt-6 space-y-5"
              onSubmit={handleSubmit}
              noValidate
            >
              {profile ? (
                <Card className="bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t.book.booking_under}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {profile.name}
                  </p>
                  <p className="text-sm text-slate-600" dir="ltr">
                    {profile.phone}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t.book.different_number}{" "}
                    <Link href="/me" className="font-medium text-brand">
                      {t.book.account_link}
                    </Link>
                  </p>
                </Card>
              ) : (
                <>
                  <Field
                    id="name"
                    label={t.book.full_name}
                    required
                    error={errors.name}
                  >
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setName(e.target.value)
                      }
                      autoComplete="name"
                      maxLength={NAME_MAX}
                      className={inputClass(!!errors.name)}
                    />
                  </Field>

                  <Field
                    id="phone"
                    label={t.book.phone_label}
                    required
                    error={errors.phone}
                  >
                    <div className="flex" dir="ltr">
                      <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                        +965
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) =>
                          setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
                        }
                        placeholder="12345678"
                        className={`${inputClass(!!errors.phone)} rounded-l-none`}
                      />
                    </div>
                  </Field>
                </>
              )}

              <Field id="email" label={t.book.email_label} error={errors.email}>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass(!!errors.email)}
                />
              </Field>

              <Field id="notes" label={t.book.notes_label} error={errors.notes}>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={NOTES_MAX}
                  className={inputClass(!!errors.notes, true)}
                />
                <p className="mt-1 text-end text-xs text-slate-500">
                  {notes.length}/{NOTES_MAX}
                </p>
              </Field>
            </form>
          </>
        )}
      </Container>

      {!loadError && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
          <Container className="py-3">
            <button
              type="submit"
              form="booking-form"
              disabled={submitting || !slot || !court}
              className={[
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors",
                submitting || !slot || !court
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-accent text-white shadow-md hover:bg-accent-dark active:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              ].join(" ")}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  {t.book.booking_progress}
                </>
              ) : (
                <>
                  {t.book.confirm_booking}
                  {court ? ` · ${formatKwd(court.price_per_slot)}` : ""}
                </>
              )}
            </button>
          </Container>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
        {required ? <span className="ms-0.5 text-red-600">*</span> : null}
      </label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function inputClass(hasError: boolean, multiline = false) {
  const ring = hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-brand";
  return [
    "block w-full rounded-xl border bg-white px-3 text-base text-slate-900 outline-none transition focus:ring-2",
    multiline ? "py-2 leading-snug" : "h-11",
    ring,
  ].join(" ");
}

function SummarySkeleton() {
  return (
    <div className="flex animate-pulse gap-3">
      <div className="h-12 w-12 flex-none rounded-xl bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-3 w-44 rounded bg-slate-200" />
        <div className="h-3 w-28 rounded bg-slate-200" />
        <div className="h-4 w-20 rounded bg-slate-200" />
      </div>
    </div>
  );
}

function humanize(code: string, t: Dict): string {
  switch (code) {
    case "required":
      return t.book.err_field_required;
    case "invalid_length":
      return t.book.err_name_length;
    case "invalid_email":
      return t.book.err_email;
    case "phone_invalid_length":
    case "phone_invalid":
      return t.book.err_phone;
    case "too_long":
      return t.book.err_notes_long;
    default:
      return t.book.err_field_correct;
  }
}
