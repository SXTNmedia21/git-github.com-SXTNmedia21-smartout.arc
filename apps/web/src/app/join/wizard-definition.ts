"use client";

/**
 * Join wizard definition — config object for WizardShell.
 *
 * Maps the 7-step join flow to WizardDefinition<JoinState>.
 * Each step component accepts WizardStepProps<JoinState>.
 */

import { Building2, Clock, FileText, KeyRound, Mail, UtensilsCrossed, Users } from "lucide-react";
import type { WizardDefinition } from "@smartout/ui";
import type { JoinState } from "./types";
import { defaultJoinState, JOIN_STORAGE_KEY } from "./types";
import { Step1Account } from "./_components/Step1Account";
import { Step2Business } from "./_components/Step2Business";
import { Step3About } from "./_components/Step3About";
import { Step4Hours } from "./_components/Step4Hours";
import { Step5Menu } from "./_components/Step5Menu";
import { Step6CreateAccount } from "./_components/Step6CreateAccount";
import { Step6Team } from "./_components/Step6Team";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
} from "./_lib/validation";

/**
 * Restore persisted state from localStorage.
 * Returns partial state that WizardShell merges with initialState.
 */
async function loadState(): Promise<Partial<JoinState>> {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(JOIN_STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Record<string, unknown>;

    // Map legacy step1..step6 keys to new named keys for migration continuity
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
 * Placeholder onComplete — will be wired to actual signup flow.
 * For now, persists final state to localStorage.
 */
async function onComplete(state: JoinState): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(JOIN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be full or unavailable
  }
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
      create_account: {
        heading: "Nesten\nferdig.",
        sub: "Opprett kontoen din for å fullføre.",
      },
      team: {
        heading: "Inviter\nteamet ditt.",
        sub: "De får en e-post med instruksjoner.",
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
      id: "create_account",
      labelKey: "steps.create_account",
      icon: KeyRound,
      component: Step6CreateAccount,
      validation: step6Schema,
      validationKey: "createAccount",
    },
    {
      id: "team",
      labelKey: "steps.team",
      icon: Users,
      component: Step6Team,
      skippable: true,
    },
  ],
};
