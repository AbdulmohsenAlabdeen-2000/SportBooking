import { cookies } from "next/headers";
import { en, type Dict } from "@/lib/i18n/dict.en";
import { ar } from "@/lib/i18n/dict.ar";

export type Locale = "en" | "ar";

export const SUPPORTED_LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "smash-locale";

export const RTL_LOCALES: ReadonlyArray<Locale> = ["ar"];

const DICTS: Record<Locale, Dict> = { en, ar };

// Read the locale cookie on the server. Falls back to the default
// when the cookie is missing or set to an unknown value. Use this
// inside Server Components / Route Handlers.
export function getLocale(): Locale {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  if (
    fromCookie &&
    (SUPPORTED_LOCALES as string[]).includes(fromCookie)
  ) {
    return fromCookie as Locale;
  }
  return DEFAULT_LOCALE;
}

// Returns the dictionary for the current locale. Strongly typed —
// callers get autocomplete on `t.hero.headline_part1` etc.
export function getDict(locale?: Locale): Dict {
  return DICTS[locale ?? getLocale()];
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

// Tiny string interpolator for `{name}` placeholders.
//   format("From {price} / hour", { price: "8.000 KWD" })
export function format(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}
