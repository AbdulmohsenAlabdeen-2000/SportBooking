import { en, type Dict } from "@/lib/i18n/dict.en";
import { ar } from "@/lib/i18n/dict.ar";

export type Locale = "en" | "ar";

export const SUPPORTED_LOCALES: Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "smash-locale";
export const RTL_LOCALES: ReadonlyArray<Locale> = ["ar"];

export const DICTS: Record<Locale, Dict> = { en, ar };

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function format(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

export function getDictByLocale(locale: Locale): Dict {
  return DICTS[locale];
}

export function isSupportedLocale(s: unknown): s is Locale {
  return typeof s === "string" && (SUPPORTED_LOCALES as string[]).includes(s);
}
