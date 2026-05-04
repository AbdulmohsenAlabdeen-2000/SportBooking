"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in dev. In prod the digest is the only safe ID.
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center bg-bg px-4 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        We hit an unexpected error. Try again, and if it keeps happening, give us a call.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-400">ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
