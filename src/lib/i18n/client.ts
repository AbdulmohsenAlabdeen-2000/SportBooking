"use client";

import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  DICTS,
  LOCALE_COOKIE,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";

const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return createElement(LocaleContext.Provider, { value: locale }, children);
}

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return DEFAULT_LOCALE;
  const value = match.slice(LOCALE_COOKIE.length + 1);
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

function subscribe() {
  return () => {};
}

// useLocale prefers the context (set server-side from cookies() in the
// layout) so SSR renders the correct dictionary on the first paint.
// Falls back to reading the cookie directly when no provider is in
// the tree, e.g. error boundaries that render outside the layout.
export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  const cookieLocale = useSyncExternalStore(
    subscribe,
    readCookieLocale,
    () => DEFAULT_LOCALE,
  );
  return ctx ?? cookieLocale;
}

export function useDict(): Dict {
  return DICTS[useLocale()];
}
