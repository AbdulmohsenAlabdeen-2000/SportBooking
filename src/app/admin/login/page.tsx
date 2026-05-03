"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginShell><LoginPlaceholder /></LoginShell>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <main className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Smash Courts · Admin
        </p>
        {children}
      </main>
    </div>
  );
}

function LoginPlaceholder() {
  return (
    <>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Sign in to admin</h1>
      <div className="mt-5 h-32 animate-pulse rounded-xl bg-slate-100" />
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const initialErrorCode = sp.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    initialErrorCode === "not_authorized"
      ? "That account isn't authorized for the admin panel."
      : null,
  );

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createBrowserClient();
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authErr) {
        setError("Invalid login. Check your email and password.");
        setSubmitting(false);
        return;
      }
      router.replace(next.startsWith("/admin") ? next : "/admin");
    } catch {
      setError("Couldn't reach the auth server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <LoginShell>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">
        Sign in to admin
      </h1>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-900"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block h-11 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-900"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block h-11 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !email || !password}
          className={[
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 text-base font-semibold text-white transition-colors",
            submitting || !email || !password
              ? "cursor-not-allowed bg-slate-300 text-slate-500"
              : "hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2",
          ].join(" ")}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </LoginShell>
  );
}
