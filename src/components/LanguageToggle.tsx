"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import type { Locale } from "@/lib/i18n";

const LOCALE_COOKIE = "smash-locale";

// Two-state language switcher. Writes a cookie + reloads so the layout
// re-renders with the new lang/dir on <html>. Pure client component.

export function LanguageToggle({
  current,
  className = "",
}: {
  current: Locale;
  className?: string;
}) {
  const router = useRouter();

  function setLocale(next: Locale) {
    if (next === current) return;
    // `secure` so the cookie only travels over HTTPS in production; on
    // localhost (no HTTPS) it would silently be rejected, so gate it.
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; secure"
        : "";
    document.cookie = `${LOCALE_COOKIE}=${next}; max-age=31536000; path=/; samesite=lax${secure}`;
    // refresh() makes the Server Components re-read the cookie. push()
    // would just be a soft RSC navigation — refresh() also re-runs the
    // root layout which is what flips dir/lang.
    router.refresh();
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full bg-slate-100 p-0.5 text-xs font-medium ${className}`}
      role="group"
      aria-label="Language"
    >
      <Globe
        className="ms-1 h-3.5 w-3.5 text-slate-500"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={current === "en"}
        className={`inline-flex h-7 items-center rounded-full px-2.5 transition-colors ${
          current === "en"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={current === "ar"}
        lang="ar"
        className={`inline-flex h-7 items-center rounded-full px-2.5 transition-colors ${
          current === "ar"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        ع
      </button>
    </div>
  );
}
