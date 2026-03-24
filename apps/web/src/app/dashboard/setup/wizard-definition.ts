"use client";

/**
 * Dashboard Setup wizard definition — config object for AnimatedWizardShell.
 *
 * Maps the 9-step workspace setup flow to WizardDefinition<SetupState>.
 * Each step wrapper component accepts WizardStepProps<SetupState> and delegates
 * to the existing step components in components/dashboard/wizard-steps/.
 */

import {
  Sparkles,
  Upload,
  ShieldCheck,
  DollarSign,
  Briefcase,
  Users,
  Clock,
  Calendar,
  BookOpen,
} from "lucide-react";
import type { WizardDefinition } from "@smartout/ui";
import type { SetupState } from "./types";
import { defaultSetupState } from "./types";
import {
  WelcomeStepAdapter,
  DocumentDropStepAdapter,
  GovernanceStepAdapter,
  PayrollStepAdapter,
  EmploymentStepAdapter,
  TeamStepAdapter,
  ShiftTemplateStepAdapter,
  SeasonStepAdapter,
  HandbookStepAdapter,
} from "./_adapters";

/**
 * onComplete — emits wizard completed event.
 * The actual query invalidation and routing is handled by the page component.
 */
async function onComplete(_state: SetupState): Promise<void> {
  // Completion logic handled in the page component via telemetry callbacks
}

export const dashboardSetupWizard: WizardDefinition<SetupState> = {
  id: "dashboard-setup",
  theme: "light",

  metadata: {
    titleKey: "setup.title",
    descriptionKey: "setup.description",
    i18nNamespace: "dashboard",
  },

  initialState: defaultSetupState,
  onComplete,

  steps: [
    {
      id: "welcome",
      labelKey: "steps.welcome",
      icon: Sparkles,
      component: WelcomeStepAdapter,
      skippable: true,
    },
    {
      id: "document-drop",
      labelKey: "steps.documents",
      icon: Upload,
      component: DocumentDropStepAdapter,
      skippable: true,
    },
    {
      id: "governance",
      labelKey: "steps.governance",
      icon: ShieldCheck,
      component: GovernanceStepAdapter,
    },
    {
      id: "payroll",
      labelKey: "steps.payroll",
      icon: DollarSign,
      component: PayrollStepAdapter,
    },
    {
      id: "employment",
      labelKey: "steps.employment",
      icon: Briefcase,
      component: EmploymentStepAdapter,
    },
    {
      id: "team",
      labelKey: "steps.team",
      icon: Users,
      component: TeamStepAdapter,
      skippable: true,
    },
    {
      id: "shift-template",
      labelKey: "steps.shifts",
      icon: Clock,
      component: ShiftTemplateStepAdapter,
      skippable: true,
    },
    {
      id: "season",
      labelKey: "steps.season",
      icon: Calendar,
      component: SeasonStepAdapter,
    },
    {
      id: "handbook",
      labelKey: "steps.handbook",
      icon: BookOpen,
      component: HandbookStepAdapter,
      skippable: true,
    },
  ],
};
