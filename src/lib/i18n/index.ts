import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  DICTS,
  LOCALE_COOKIE,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/shared";
import type { Dict } from "@/lib/i18n/dict.en";

export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  format,
  isRtl,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/shared";

export function getLocale(): Locale {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  return isSupportedLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
}

export function getDict(locale?: Locale): Dict {
  return DICTS[locale ?? getLocale()];
}
