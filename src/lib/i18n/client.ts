"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  DICTS,
  LOCALE_COOKIE,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return DEFAULT_LOCALE;
  const value = match.slice(LOCALE_COOKIE.length + 1);
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

// Reactive subscription is a no-op — the LanguageToggle calls
// router.refresh() so server-rendered HTML re-mounts client trees with
// the right cookie. We still use useSyncExternalStore for SSR safety.
function subscribe() {
  return () => {};
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readCookieLocale, () => DEFAULT_LOCALE);
}

export function useDict(): Dict {
  const locale = useLocale();
  return DICTS[locale];
}
