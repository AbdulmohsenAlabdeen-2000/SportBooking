"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, KeyRound, Loader2, MessageSquareText } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { createBrowserClient } from "@/lib/supabase/browser";
import { normalizeKuwaitPhone } from "@/lib/phone";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell({ children }: { children?: React.ReactNode } = {}) {
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

type Mode = "code" | "password";
type Stage = "input" | "code";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/me";

  const [mode, setMode] = useState<Mode>("code");
  const [stage, setStage] = useState<Stage>("input");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneSentRef = useRef<string | null>(null);

  function safeRedirect(path: string) {
    return path.startsWith("/") && !path.startsWith("//") ? path : "/me";
  }

  async function handleSendCode(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setError(null);
    const phoneResult = normalizeKuwaitPhone(phone);
    if (!phoneResult.ok) {
      setError("Enter your 8-digit Kuwait phone number.");
      return;
    }
    setSubmitting(true);
    const canonical = phoneResult.value;
    try {
      const supabase = createBrowserClient();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        phone: canonical,
        options: { shouldCreateUser: false },
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

  async function handleVerifyCode(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting || !phoneSentRef.current) return;
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
      router.replace(safeRedirect(next));
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  async function handlePassword(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setError(null);
    const phoneResult = normalizeKuwaitPhone(phone);
    if (!phoneResult.ok) {
      setError("Enter your 8-digit Kuwait phone number.");
      return;
    }
    if (password.length < 1) {
      setError("Enter your password.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserClient();
      const { error: pErr } = await supabase.auth.signInWithPassword({
        phone: phoneResult.value,
        password,
      });
      if (pErr) {
        setError("Wrong number or password.");
        setSubmitting(false);
        return;
      }
      router.replace(safeRedirect(next));
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
      options: { shouldCreateUser: false },
    });
    if (rErr) setError(humanizeAuthError(rErr.message));
  }

  return (
    <LoginShell>
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">
        Use your Kuwait phone number.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("code");
            setStage("input");
            setError(null);
          }}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full font-medium transition-colors ${mode === "code" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          <MessageSquareText className="h-4 w-4" aria-hidden /> Code
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setStage("input");
            setError(null);
          }}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full font-medium transition-colors ${mode === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
        >
          <KeyRound className="h-4 w-4" aria-hidden /> Password
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {mode === "code" && stage === "input" ? (
        <form className="mt-5 space-y-4" onSubmit={handleSendCode} noValidate>
          <PhoneField phone={phone} setPhone={setPhone} />
          <SubmitButton submitting={submitting} label="Send code" />
        </form>
      ) : null}

      {mode === "code" && stage === "code" ? (
        <form className="mt-5 space-y-4" onSubmit={handleVerifyCode} noValidate>
          <p className="text-sm text-slate-600">
            Sent to <span className="font-medium">{phoneSentRef.current}</span>
          </p>
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
            label="Sign in"
          />
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setStage("input")}
              className="text-slate-600 hover:text-slate-900"
            >
              ← Use a different number
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
      ) : null}

      {mode === "password" ? (
        <form className="mt-5 space-y-4" onSubmit={handlePassword} noValidate>
          <PhoneField phone={phone} setPhone={setPhone} />
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls(false)}
            />
          </Field>
          <SubmitButton submitting={submitting} label="Sign in" />
        </form>
      ) : null}

      <p className="mt-5 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-medium text-brand">
          Create an account
        </Link>
      </p>
    </LoginShell>
  );
}

// ─── helpers (kept local to this file to keep deploy units small) ───────────

function PhoneField({
  phone,
  setPhone,
}: {
  phone: string;
  setPhone: (s: string) => void;
}) {
  return (
    <Field label="Phone (8 digits)">
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
          className={`${inputCls(false)} rounded-l-none`}
        />
      </div>
    </Field>
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
  if (lower.includes("user not found") || lower.includes("not exist")) {
    return "No account found for that number. Sign up first.";
  }
  if (lower.includes("invalid phone")) {
    return "That phone number doesn't look right.";
  }
  return "Couldn't send the code. Try again.";
}
