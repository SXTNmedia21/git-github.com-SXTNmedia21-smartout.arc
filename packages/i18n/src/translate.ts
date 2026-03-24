import type { SupportedLocale } from "./config";

import nbCommon from "../locales/nb/common.json";
import nbLanding from "../locales/nb/landing.json";
import nbDocs from "../locales/nb/docs.json";
import enCommon from "../locales/en/common.json";
import enLanding from "../locales/en/landing.json";
import enDocs from "../locales/en/docs.json";

type Messages = Record<string, string | Record<string, string>>;

const localeModules: Record<string, Record<string, Messages>> = {
  nb: { common: nbCommon, landing: nbLanding, docs: nbDocs },
  en: { common: enCommon, landing: enLanding, docs: enDocs },
};

/**
 * Creates a translator function for a given locale and namespace.
 * Supports both flat keys ("site.title") and nested keys ("common.save")
 * where the first segment is the nested object name.
 */
export function createTranslator(locale: SupportedLocale, namespace: string) {
  const messages = localeModules[locale]?.[namespace] ?? {};
  return function t(key: string): string {
    const direct = messages[key];
    if (typeof direct === "string") return direct;

    const [group, subKey] = key.split(".");
    if (group && subKey) {
      const nested = messages[group];
      if (typeof nested === "object" && nested !== null) {
        return nested[subKey] ?? key;
      }
    }

    return key;
  };
}
