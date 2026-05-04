"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { createBrowserClient } from "@/lib/supabase/browser";
import { normalizeKuwaitPhone } from "@/lib/phone";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupShellWithDict />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupShellWithDict() {
  const t = useDict();
  return <SignupShell t={t} />;
}

function SignupShell({
  t,
  children,
}: {
  t: Dict;
  children?: React.ReactNode;
}) {
  return (
    <Container className="py-6 md:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />{" "}
        {t.common.back}
      </Link>
      <div className="mx-auto mt-6 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {children ?? <div className="h-64 animate-pulse rounded bg-slate-100" />}
      </div>
    </Container>
  );
}

type Stage = "details" | "code";

function SignupForm() {
  const t = useDict();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/me";

  const [stage, setStage] = useState<Stage>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const phoneSentRef = useRef<string | null>(null);

  async function handleDetails(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setError(null);
    setErrors({});

    const fieldErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      fieldErrors.name = t.signup.err_name;
    }
    const phoneResult = normalizeKuwaitPhone(phone);
    if (!phoneResult.ok) {
      fieldErrors.phone = t.signup.err_phone;
    }
    if (password.length > 0 && password.length < 8) {
      fieldErrors.password = t.signup.err_password_short;
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const canonical = (phoneResult as { ok: true; value: string }).value;
    try {
      const supabase = createBrowserClient();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: canonical,
        options: {
          shouldCreateUser: true,
          data: { name: trimmedName, signup_password: password || null },
        },
      });
      if (otpErr) {
        setError(humanizeAuthError(otpErr.message, t));
        setSubmitting(false);
        return;
      }
      phoneSentRef.current = canonical;
      setStage("code");
    } catch {
      setError(t.signup.err_network);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCode(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    if (!phoneSentRef.current) {
      setError(t.signup.err_session_lost);
      setStage("details");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createBrowserClient();
      const { error: vErr } = await supabase.auth.verifyOtp({
        phone: phoneSentRef.current,
        token: code.trim(),
        type: "sms",
      });
      if (vErr) {
        setError(
          vErr.message.toLowerCase().includes("expired")
            ? t.signup.err_expired
            : t.signup.err_wrong_code,
        );
        setSubmitting(false);
        return;
      }
      if (password.length >= 8) {
        await supabase.auth.updateUser({ password });
      }

      try {
        const { data: userResp } = await supabase.auth.getUser();
        const user = userResp.user;
        if (user) {
          await supabase
            .from("customers")
            .upsert(
              {
                user_id: user.id,
                name: name.trim(),
                phone: phoneSentRef.current,
              },
              { onConflict: "user_id" },
            );
        }
      } catch {
        // Best-effort. /me's requireCustomer redirects back here if missing.
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError(t.signup.err_network);
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (!phoneSentRef.current) return;
    setError(null);
    const supabase = createBrowserClient();
    const { error: rErr } = await supabase.auth.signInWithOtp({
      phone: phoneSentRef.current,
    });
    if (rErr) setError(humanizeAuthError(rErr.message, t));
  }

  return (
    <SignupShell t={t}>
      <div className="mb-1 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        {t.signup.eyebrow}
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        {stage === "details" ? t.signup.title_details : t.signup.title_code}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {stage === "details"
          ? t.signup.sub_details
          : format(t.signup.sub_code, { phone: phoneSentRef.current ?? "" })}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {stage === "details" ? (
        <form className="mt-5 space-y-4" onSubmit={handleDetails} noValidate>
          <Field label={t.signup.full_name} error={errors.name}>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={inputCls(!!errors.name)}
            />
          </Field>

          <Field label={t.signup.phone_label} error={errors.phone}>
            <div className="flex" dir="ltr">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                +965
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="12345678"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className={`${inputCls(!!errors.phone)} rounded-l-none`}
              />
            </div>
          </Field>

          <Field label={t.signup.password_optional} error={errors.password}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls(!!errors.password)}
            />
            <PasswordStrength password={password} />
            <p className="mt-2 text-xs text-slate-500">
              {t.signup.password_help}
            </p>
          </Field>

          <SubmitButton t={t} submitting={submitting} label={t.signup.send_code} />
          <p className="text-center text-sm text-slate-600">
            {t.signup.already_have}{" "}
            <Link href="/login" className="font-medium text-brand">
              {t.common.sign_in}
            </Link>
          </p>
        </form>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={handleCode} noValidate>
          <Field label={t.login.six_digit}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={`${inputCls(false)} text-center font-mono text-lg tracking-widest`}
              maxLength={6}
              autoFocus
              dir="ltr"
            />
          </Field>
          <SubmitButton
            t={t}
            submitting={submitting}
            disabled={code.length !== 6}
            label={t.signup.verify_finish}
          />
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setStage("details")}
              className="text-slate-600 hover:text-slate-900"
            >
              ← {t.signup.edit_details}
            </button>
            <button
              type="button"
              onClick={resendCode}
              className="font-medium text-brand"
            >
              {t.signup.resend}
            </button>
          </div>
        </form>
      )}
    </SignupShell>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

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
    "block h-11 w-full rounded-xl border bg-white px-3 text-base text-slate-900 outline-none focus:ring-2",
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-brand",
  ].join(" ");
}

function SubmitButton({
  t,
  submitting,
  disabled = false,
  label,
}: {
  t: Dict;
  submitting: boolean;
  disabled?: boolean;
  label: string;
}) {
  const inactive = submitting || disabled;
  return (
    <button
      type="submit"
      disabled={inactive}
      className={[
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors",
        inactive
          ? "cursor-not-allowed bg-slate-200 text-slate-500"
          : "bg-accent text-white shadow-md hover:bg-accent-dark",
      ].join(" ")}
    >
      {submitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t.common.working}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function humanizeAuthError(msg: string, t: Dict): string {
  const lower = msg.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) {
    return t.signup.err_too_many;
  }
  if (lower.includes("invalid phone")) {
    return t.signup.err_phone_format;
  }
  if (lower.includes("user already")) {
    return t.signup.err_already_registered;
  }
  if (
    lower.includes("not reachable") ||
    lower.includes("unverified") ||
    lower.includes("error sending sms")
  ) {
    return t.signup.err_unverified;
  }
  return t.signup.err_couldnt_send;
}
