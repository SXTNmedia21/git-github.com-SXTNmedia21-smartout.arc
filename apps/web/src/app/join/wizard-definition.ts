"use client";

/**
 * Join wizard definition — config object for WizardShell.
 *
 * 6-step join flow: Account → Business → Identity → Hours → Menu → Summary.
 * Auth (signUp/signInWithPassword) happens silently in step 1 after email+password entry.
 * Step 6 is a read-only review so the user can verify before workspace provisioning.
 * onComplete runs completeSignup server action and redirects to /onboarding.
 */

import { Building2, CheckCircle, Clock, FileText, Mail, UtensilsCrossed } from "lucide-react";
import type { WizardDefinition } from "@smartout/ui";
import type { JoinState } from "./types";
import { defaultJoinState, JOIN_STORAGE_KEY } from "./types";
import { Step1Account } from "./_components/Step1Account";
import { Step2Business } from "./_components/Step2Business";
import { Step3About } from "./_components/Step3About";
import { Step4Hours } from "./_components/Step4Hours";
import { Step5Menu } from "./_components/Step5Menu";
import { Step6Summary } from "./_components/Step6Summary";
import { step1Schema, step2Schema, step3Schema, step4Schema, step5Schema } from "./_lib/validation";
import { completeSignup } from "./_lib/setupActions";
import { buildPostSignupRedirectPath } from "./_lib/onboarding-shell";

/**
 * Restore persisted state from localStorage.
 */
async function loadState(): Promise<Partial<JoinState>> {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(JOIN_STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Record<string, unknown>;

    return {
      account: (parsed.step1 ?? parsed.account ?? {}) as JoinState["account"],
      business: (parsed.step2 ?? parsed.business ?? {}) as JoinState["business"],
      about: (parsed.step3 ?? parsed.about ?? {}) as JoinState["about"],
      hours: (parsed.step4 ?? parsed.hours ?? {}) as JoinState["hours"],
      menu: (parsed.step5 ?? parsed.menu ?? {}) as JoinState["menu"],
      createAccount: (parsed.step6 ?? parsed.createAccount ?? {}) as JoinState["createAccount"],
      team: (parsed.team ?? {}) as JoinState["team"],
      scrapeJobId: (parsed.scrapeJobId as string) ?? null,
      intelligence: (parsed.intelligence as Record<string, unknown>) ?? null,
    };
  } catch {
    return {};
  }
}

/**
 * Complete signup — runs server action to provision workspace shell, then redirects.
 * Maps wizard state keys (account, business, ...) to server action keys (step1, step2, ...).
 */
async function onComplete(state: JoinState): Promise<void> {
  // Persist final state to localStorage as backup
  try {
    localStorage.setItem(JOIN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort
  }

  const setupData = {
    step1: {
      email: state.account.email ?? "",
      firstName: state.account.firstName ?? "",
      lastName: state.account.lastName ?? "",
      companyName: state.account.companyName ?? "",
      industry: state.account.industry ?? "",
      city: state.account.city,
      websiteUrl: state.account.websiteUrl ?? "",
    },
    step2: {
      street: state.business.street ?? "",
      postalCode: state.business.postalCode ?? "",
      city: state.business.city ?? "",
      orgNumber: (state.business.orgNumber ?? "").replace(/\s/g, ""),
    },
    step3: {
      aboutUs: state.about.aboutUs,
      ourHistory: state.about.ourHistory,
      ourConcept: state.about.ourConcept,
    },
    step4: {
      openingHours: state.hours.openingHours ?? [],
      phone: state.hours.phone ?? "",
      instagram: state.hours.instagram,
      facebook: state.hours.facebook,
    },
    step5: {
      restaurantType: state.menu.restaurantType,
      cuisineTypes: state.menu.cuisineTypes,
      priceCategory: state.menu.priceCategory,
      menuDescription: state.menu.menuDescription,
    },
    step6: state.createAccount ?? {},
    intelligence: state.intelligence,
  };

  const accessToken = (state as Record<string, unknown>)._accessToken as string | undefined;
  const result = await completeSignup(setupData, accessToken);

  // Clear localStorage after successful signup
  try {
    localStorage.removeItem(JOIN_STORAGE_KEY);
  } catch {
    // best-effort
  }

  // Redirect to onboarding confirmation wizard
  const redirectPath = buildPostSignupRedirectPath(result.workspaceId);
  window.location.href = redirectPath;
}

export const joinWizard: WizardDefinition<JoinState> = {
  id: "join",
  theme: "warm",

  metadata: {
    titleKey: "wizard.title",
    descriptionKey: "wizard.description",
    i18nNamespace: "join",
  },

  brandPanel: {
    logoSrc: "/smartout-logo.png",
    position: "right",
    messages: {
      account: {
        heading: "Fortell oss\nom bedriften din.",
        sub: "Vi bruker dette til å sette opp alt for deg.",
      },
      business: {
        heading: "Vi fyller ut\nså mye vi kan.",
        sub: "Sjekk at informasjonen stemmer — du kan endre alt.",
      },
      about: {
        heading: "Gi bedriften\ndin en stemme.",
        sub: "AI hjelper deg å skrive — du bestemmer tonen.",
      },
      hours: {
        heading: "Når er dere\nåpne?",
        sub: "Åpningstider hjelper oss planlegge drift og bemanning.",
      },
      menu: {
        heading: "Del menyen\ndin.",
        sub: "Valgfritt — men det gir smartere opplæring.",
      },
      summary: {
        heading: "Nesten\nferdig.",
        sub: "Sjekk at alt stemmer — så setter vi i gang.",
      },
    },
  },

  initialState: defaultJoinState,
  loadState,
  onComplete,

  steps: [
    {
      id: "account",
      labelKey: "steps.account",
      icon: Mail,
      component: Step1Account,
      validation: step1Schema,
      validationKey: "account",
    },
    {
      id: "business",
      labelKey: "steps.business",
      icon: Building2,
      component: Step2Business,
      validation: step2Schema,
      validationKey: "business",
    },
    {
      id: "about",
      labelKey: "steps.about",
      icon: FileText,
      component: Step3About,
      validation: step3Schema,
      validationKey: "about",
      skippable: true,
    },
    {
      id: "hours",
      labelKey: "steps.hours",
      icon: Clock,
      component: Step4Hours,
      validation: step4Schema,
      validationKey: "hours",
    },
    {
      id: "menu",
      labelKey: "steps.menu",
      icon: UtensilsCrossed,
      component: Step5Menu,
      validation: step5Schema,
      validationKey: "menu",
      skippable: true,
    },
    {
      id: "summary",
      labelKey: "steps.summary",
      icon: CheckCircle,
      component: Step6Summary,
      // No hideNavBar — the standard "Fullfør" nav button triggers onComplete
    },
  ],
};
