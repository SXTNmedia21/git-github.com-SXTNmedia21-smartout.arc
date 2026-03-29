"use client";

/**
 * Onboarding page — confirmation wizard using WizardShell.
 *
 * Loads pre-filled data from workspace.intelligence_data (populated by Join wizard)
 * and guides the user through confirming business info, departments, locations,
 * and procedures before finalizing the workspace.
 *
 * Finalization path: shell plus /onboarding finalization via
 * buildWorkspaceFinalizationRequest → finalize-workspace Edge Function.
 * This is the same canonical path used by the previous scroll-based implementation.
 * No dependence on activate-workspace — the wizard-definition.ts onComplete
 * delegates to buildWorkspaceFinalizationRequest which selects the correct EF.
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { onboardingWizard } from "./wizard-definition";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="text-muted-foreground animate-spin" size={32} />
        </div>
      }
    >
      <AnimatedWizardShell definition={onboardingWizard} />
    </Suspense>
  );
}
