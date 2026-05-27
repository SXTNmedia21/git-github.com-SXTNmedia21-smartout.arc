import type { SupportedLocale } from "./config";

import nbCommon from "../locales/nb/common.json";
import nbLanding from "../locales/nb/landing.json";
import nbDocs from "../locales/nb/docs.json";
import nbOnboarding from "../locales/nb/onboarding.json";
import nbWizard from "../locales/nb/wizard.json";
import nbJoin from "../locales/nb/join.json";
import nbDashboard from "../locales/nb/dashboard.json";
import nbMobile from "../locales/nb/mobile.json";
import nbNotifications from "../locales/nb/notifications.json";
import nbAuth from "../locales/nb/auth.json";
import nbSwap from "../locales/nb/swap.json";
import nbContracts from "../locales/nb/contracts.json";
import nbKomm from "../locales/nb/komm.json";
import nbShift from "../locales/nb/shift.json";
import nbBilling from "../locales/nb/billing.json";
import nbHelpdesk from "../locales/nb/helpdesk.json";
import nbYearWheel from "../locales/nb/year-wheel.json";
import nbOppgaver from "../locales/nb/oppgaver.json";
import nbOrg from "../locales/nb/org.json";
import enCommon from "../locales/en/common.json";
import enLanding from "../locales/en/landing.json";
import enDocs from "../locales/en/docs.json";
import enOnboarding from "../locales/en/onboarding.json";
import enWizard from "../locales/en/wizard.json";
import enJoin from "../locales/en/join.json";
import enDashboard from "../locales/en/dashboard.json";
import enMobile from "../locales/en/mobile.json";
import enNotifications from "../locales/en/notifications.json";
import enAuth from "../locales/en/auth.json";
import enSwap from "../locales/en/swap.json";
import enContracts from "../locales/en/contracts.json";
import enKomm from "../locales/en/komm.json";
import enShift from "../locales/en/shift.json";
import enBilling from "../locales/en/billing.json";
import enHelpdesk from "../locales/en/helpdesk.json";
import enYearWheel from "../locales/en/year-wheel.json";
import enOppgaver from "../locales/en/oppgaver.json";
import enOrg from "../locales/en/org.json";

type MessageValue = string | { [key: string]: MessageValue };
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
    notifications: nbNotifications,
    auth: nbAuth,
    swap: nbSwap,
    contracts: nbContracts,
    komm: nbKomm,
    shift: nbShift,
    billing: nbBilling,
    helpdesk: nbHelpdesk,
    "year-wheel": nbYearWheel,
    oppgaver: nbOppgaver,
    org: nbOrg,
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
    notifications: enNotifications,
    auth: enAuth,
    swap: enSwap,
    contracts: enContracts,
    komm: enKomm,
    shift: enShift,
    billing: enBilling,
    helpdesk: enHelpdesk,
    "year-wheel": enYearWheel,
    oppgaver: enOppgaver,
    org: enOrg,
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
   * Resolves a dot-separated key of arbitrary depth against a messages object.
   * Direct key (no descent) is attempted first to allow flat keys with dots.
   * Examples: "title", "hms.sessions_label", "setup.value_props.governance.title"
   */
  function resolve(msgs: Messages, key: string): string | undefined {
    const direct = msgs[key];
    if (typeof direct === "string") return direct;

    const parts = key.split(".");
    if (parts.length < 2) return undefined;

    let cursor: MessageValue | undefined = msgs;
    for (const part of parts) {
      if (typeof cursor !== "object" || cursor === null) return undefined;
      cursor = (cursor as Record<string, MessageValue>)[part];
      if (cursor === undefined) return undefined;
    }
    return typeof cursor === "string" ? cursor : undefined;
  }

  return function t(key: string, params?: Record<string, string | number>): string {
    const val = resolve(messages, key);
    if (val !== undefined) return interpolate(val, params);

    const fallbackVal = resolve(fallbackMessages, key);
    if (fallbackVal !== undefined) return interpolate(fallbackVal, params);

    return key;
  };
}
