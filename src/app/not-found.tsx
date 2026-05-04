import Link from "next/link";
import { MapPinOff } from "lucide-react";

export const metadata = {
  title: "Not found — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center bg-bg px-4 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
        <MapPinOff className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        That page doesn't exist (or has moved). Pick a court and play instead.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/book"
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          Book a court
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
