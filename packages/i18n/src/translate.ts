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

type MessageValue = string | Record<string, string | Record<string, string>>;
type Messages = Record<string, MessageValue>;

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

  /**
   * Resolves a dot-separated key (up to 3 levels deep) against a messages object.
   * Examples: "title", "hms.sessions_label", "hms.drift_insights.sessions_label"
   */
  function resolve(msgs: Messages, key: string): string | undefined {
    const direct = msgs[key];
    if (typeof direct === "string") return direct;

    const parts = key.split(".");
    if (parts.length === 2) {
      const nested = msgs[parts[0]!];
      if (typeof nested === "object" && nested !== null) {
        const val = nested[parts[1]!];
        if (typeof val === "string") return val;
      }
    }

    if (parts.length === 3) {
      const top = msgs[parts[0]!];
      if (typeof top === "object" && top !== null) {
        const mid = top[parts[1]!];
        if (typeof mid === "object" && mid !== null) {
          const val = mid[parts[2]!];
          if (typeof val === "string") return val;
        }
      }
    }

    return undefined;
  }

  return function t(key: string, params?: Record<string, string | number>): string {
    const val = resolve(messages, key);
    if (val !== undefined) return interpolate(val, params);

    const fallbackVal = resolve(fallbackMessages, key);
    if (fallbackVal !== undefined) return interpolate(fallbackVal, params);

    return key;
  };
}
