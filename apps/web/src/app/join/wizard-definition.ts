"use client";

/**
 * Join wizard definition — config object for WizardShell.
 *
 * Maps the 7-step join flow to WizardDefinition<JoinState>.
 * Step components are imported as-is (they'll be refactored to accept
 * WizardStepProps<JoinState> in a separate task).
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

// Step components are typed as ComponentType<any> for now since they
// still use useSignupWizard() internally. They'll be refactored to
// accept WizardStepProps<JoinState> in a follow-up task.

export const joinWizardDefinition: WizardDefinition<JoinState> = {
  id: "join",
  theme: "dark",

  metadata: {
    titleKey: "wizard.title",
    descriptionKey: "wizard.description",
    i18nNamespace: "join",
  },

  initialState: defaultJoinState,
  loadState,
  onComplete,

  steps: [
    {
      id: "account",
      labelKey: "steps.account",
      icon: Mail,
      component: Step1Account as never,
      validation: step1Schema,
    },
    {
      id: "business",
      labelKey: "steps.business",
      icon: Building2,
      component: Step2Business as never,
      validation: step2Schema,
    },
    {
      id: "about",
      labelKey: "steps.about",
      icon: FileText,
      component: Step3About as never,
      validation: step3Schema,
      skippable: true,
    },
    {
      id: "hours",
      labelKey: "steps.hours",
      icon: Clock,
      component: Step4Hours as never,
      validation: step4Schema,
    },
    {
      id: "menu",
      labelKey: "steps.menu",
      icon: UtensilsCrossed,
      component: Step5Menu as never,
      validation: step5Schema,
      skippable: true,
    },
    {
      id: "create_account",
      labelKey: "steps.create_account",
      icon: KeyRound,
      component: Step6CreateAccount as never,
      validation: step6Schema,
    },
    {
      id: "team",
      labelKey: "steps.team",
      icon: Users,
      component: Step6Team as never,
      skippable: true,
    },
  ],
};
