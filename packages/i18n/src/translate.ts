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

type NestedMessages = Record<string, string>;
type Messages = Record<string, string | NestedMessages | Record<string, NestedMessages>>;

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

  function resolve(msgs: Messages, key: string): string | undefined {
    const direct = msgs[key];
    if (typeof direct === "string") return direct;

    const parts = key.split(".");
    const p0 = parts[0] ?? "";
    const p1 = parts[1] ?? "";
    const p2 = parts[2] ?? "";

    if (parts.length === 2 && p0 && p1) {
      const nested = msgs[p0];
      if (typeof nested === "object" && nested !== null) {
        const val = (nested as Record<string, unknown>)[p1];
        if (typeof val === "string") return val;
      }
    }

    if (parts.length === 3 && p0 && p1 && p2) {
      const top = msgs[p0];
      if (typeof top === "object" && top !== null) {
        const mid = (top as Record<string, unknown>)[p1];
        if (typeof mid === "object" && mid !== null) {
          const val = (mid as Record<string, unknown>)[p2];
          if (typeof val === "string") return val;
        }
      }
    }

    return undefined;
  }

  return function t(key: string, params?: Record<string, string | number>): string {
    const val = resolve(messages, key) ?? resolve(fallbackMessages, key);
    if (val) return interpolate(val, params);
    return key;
  };
}
