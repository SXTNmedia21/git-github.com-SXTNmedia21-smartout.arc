import type { SupportedLocale } from "./config";
import { RTL_LOCALES } from "./config";

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as SupportedLocale);
}
