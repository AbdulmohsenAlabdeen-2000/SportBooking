"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { createBrowserClient } from "@/lib/supabase/browser";
import { normalizeKuwaitPhone } from "@/lib/phone";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupShell />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupShell({ children }: { children?: React.ReactNode } = {}) {
  return (
    <Container className="py-6 md:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </Link>
      <div className="mx-auto mt-6 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {children ?? <div className="h-64 animate-pulse rounded bg-slate-100" />}
      </div>
    </Container>
  );
}

type Stage = "details" | "code";

function SignupForm() {
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
      fieldErrors.name = "Enter your full name (2–80 characters).";
    }
    const phoneResult = normalizeKuwaitPhone(phone);
    if (!phoneResult.ok) {
      fieldErrors.phone = "Enter your 8-digit Kuwait phone number.";
    }
    if (password.length > 0 && password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters.";
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
        setError(humanizeAuthError(otpErr.message));
        setSubmitting(false);
        return;
      }
      phoneSentRef.current = canonical;
      setStage("code");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCode(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    if (!phoneSentRef.current) {
      setError("Phone session lost. Start over.");
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
            ? "That code has expired. Request a new one."
            : "Wrong code. Double-check and try again.",
        );
        setSubmitting(false);
        return;
      }
      // Optionally set the password the user picked at the details step.
      if (password.length >= 8) {
        await supabase.auth.updateUser({ password });
      }

      // Upsert the customer profile. The DB trigger handles the happy path
      // (fresh auth.users insert), but if the auth.users row already
      // existed before the trigger was created — or anything else races —
      // the trigger never runs. Doing it client-side here belts-and-braces
      // the profile into existence so /me works on the next render.
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
        // Best-effort. /me's requireCustomer will redirect back to signup
        // if the profile is genuinely missing — at that point it's a real
        // bug worth surfacing.
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
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
    if (rErr) setError(humanizeAuthError(rErr.message));
  }

  return (
    <SignupShell>
      <div className="mb-1 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Create account
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        {stage === "details" ? "Sign up to book" : "Enter the 6-digit code"}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {stage === "details"
          ? "We'll text you a code to verify your number."
          : `Sent to ${phoneSentRef.current}`}
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
          <Field label="Full name" error={errors.name}>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={inputCls(!!errors.name)}
            />
          </Field>

          <Field label="Phone (8 digits)" error={errors.phone}>
            <div className="flex">
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

          <Field label="Password (optional)" error={errors.password}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls(!!errors.password)}
            />
            <PasswordStrength password={password} />
            <p className="mt-2 text-xs text-slate-500">
              You can sign in by SMS code. Setting a password lets you skip
              the SMS next time.
            </p>
          </Field>

          <SubmitButton submitting={submitting} label="Send code" />
          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={handleCode} noValidate>
          <Field label="6-digit code">
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
            />
          </Field>
          <SubmitButton
            submitting={submitting}
            disabled={code.length !== 6}
            label="Verify and finish"
          />
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setStage("details")}
              className="text-slate-600 hover:text-slate-900"
            >
              ← Edit details
            </button>
            <button
              type="button"
              onClick={resendCode}
              className="font-medium text-brand"
            >
              Resend code
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
  submitting,
  disabled = false,
  label,
}: {
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
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working…
        </>
      ) : (
        label
      )}
    </button>
  );
}

function humanizeAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many requests. Wait a minute, then try again.";
  }
  if (lower.includes("invalid phone")) {
    return "That phone number doesn't look right. Use 8 digits.";
  }
  if (lower.includes("user already")) {
    return "That number is already registered. Sign in instead.";
  }
  if (
    lower.includes("not reachable") ||
    lower.includes("unverified") ||
    lower.includes("error sending sms")
  ) {
    return "Couldn't deliver the code to that number. If your phone is on a Twilio trial, only verified numbers receive SMS — verify it in Twilio first.";
  }
  return "Couldn't send the code. Try again.";
}
