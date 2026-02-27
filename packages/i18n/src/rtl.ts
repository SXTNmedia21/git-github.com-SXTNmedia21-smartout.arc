import { RTL_LOCALES, SupportedLocale } from "./config";

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as SupportedLocale);
}
