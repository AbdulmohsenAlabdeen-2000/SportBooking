"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-red-900">
            Something went wrong loading this page.
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Try again — if it keeps happening, sign out and back in to refresh
            your session.
          </p>
          {error.digest ? (
            <p className="mt-1 font-mono text-xs text-red-700/80">
              ref: {error.digest}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
            <Link
              href="/admin"
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
