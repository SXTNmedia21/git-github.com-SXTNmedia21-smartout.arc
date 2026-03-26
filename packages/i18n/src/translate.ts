import type { SupportedLocale } from "./config";

import nbCommon from "../locales/nb/common.json";
import nbLanding from "../locales/nb/landing.json";
import nbDocs from "../locales/nb/docs.json";
import nbOnboarding from "../locales/nb/onboarding.json";
import nbWizard from "../locales/nb/wizard.json";
import nbJoin from "../locales/nb/join.json";
import nbDashboard from "../locales/nb/dashboard.json";
import nbMobile from "../locales/nb/mobile.json";
import enCommon from "../locales/en/common.json";
import enLanding from "../locales/en/landing.json";
import enDocs from "../locales/en/docs.json";
import enOnboarding from "../locales/en/onboarding.json";
import enWizard from "../locales/en/wizard.json";
import enJoin from "../locales/en/join.json";
import enDashboard from "../locales/en/dashboard.json";
import enMobile from "../locales/en/mobile.json";

type Messages = Record<string, string | Record<string, string>>;

const localeModules: Record<string, Record<string, Messages>> = {
  nb: {
    common: nbCommon,
    landing: nbLanding,
    docs: nbDocs,
    onboarding: nbOnboarding,
    wizard: nbWizard,
    join: nbJoin,
    dashboard: nbDashboard,
    mobile: nbMobile,
  },
  en: {
    common: enCommon,
    landing: enLanding,
    docs: enDocs,
    onboarding: enOnboarding,
    wizard: enWizard,
    join: enJoin,
    dashboard: enDashboard,
    mobile: enMobile,
  },
};

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export function createTranslator(locale: SupportedLocale, namespace: string) {
  const messages = localeModules[locale]?.[namespace] ?? {};
  const fallbackMessages = locale !== "nb" ? (localeModules["nb"]?.[namespace] ?? {}) : {};

  return function t(key: string, params?: Record<string, string | number>): string {
    // Try requested locale first
    const direct = messages[key];
    if (typeof direct === "string") return interpolate(direct, params);

    const [group, subKey] = key.split(".");
    if (group && subKey) {
      const nested = messages[group];
      if (typeof nested === "object" && nested !== null) {
        const val = nested[subKey];
        if (val) return interpolate(val, params);
      }
    }

    // Fallback to Norwegian
    const fallbackDirect = fallbackMessages[key];
    if (typeof fallbackDirect === "string") return interpolate(fallbackDirect, params);

    if (group && subKey) {
      const fallbackNested = fallbackMessages[group];
      if (typeof fallbackNested === "object" && fallbackNested !== null) {
        const val = fallbackNested[subKey];
        if (val) return interpolate(val, params);
      }
    }

    return key;
  };
}
