"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useOnboardingWizard } from "./hooks/useOnboardingWizard";
import { WizardProvider } from "./WizardContext";
import { StepProgress } from "./StepProgress";
import type { WizardStep } from "./types";

// Step components
import { InitStep } from "./steps/InitStep";
import { CrawlStep } from "./steps/CrawlStep";
import { AuthStep } from "./steps/AuthStep";
import { OrgVerificationStep } from "./steps/OrgVerificationStep";
import { BrandingStep } from "./steps/BrandingStep";
import { SeasonEducationStep } from "./steps/SeasonEducationStep";
import { SeasonIdentityStep } from "./steps/SeasonIdentityStep";
import { DepartmentsStep } from "./steps/DepartmentsStep";
import { TeamsStep } from "./steps/TeamsStep";
import { LocationsStep } from "./steps/LocationsStep";
import { ProceduresStep } from "./steps/ProceduresStep";
import { BattlefieldReviewStep } from "./steps/BattlefieldReviewStep";
import { FinalizeStep } from "./steps/FinalizeStep";
import { InviteStep } from "./steps/InviteStep";
import { DoneStep } from "./steps/DoneStep";

/** Maps each step to its component. */
const STEP_COMPONENTS: Record<WizardStep, React.ComponentType> = {
  init: InitStep,
  crawling: CrawlStep,
  auth: AuthStep,
  org_verification: OrgVerificationStep,
  branding: BrandingStep,
  season_education: SeasonEducationStep,
  season_identity: SeasonIdentityStep,
  departments: DepartmentsStep,
  teams: TeamsStep,
  locations: LocationsStep,
  procedures: ProceduresStep,
  battlefield_review: BattlefieldReviewStep,
  finalizing: FinalizeStep,
  invite: InviteStep,
  done: DoneStep,
};

function OnboardingContent() {
  const wizard = useOnboardingWizard();
  const StepComponent = STEP_COMPONENTS[wizard.step];

  return (
    <WizardProvider value={wizard}>
      <div className="relative flex min-h-full w-full flex-col items-center bg-[#0a0a0c] font-sans text-zinc-300 selection:bg-cyan-500/30">
        {/* Ambient Background */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute top-0 right-1/4 h-[800px] w-[800px] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-[800px] w-[800px] translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10 flex w-full flex-1 flex-col items-center py-8 sm:py-12">
          <StepProgress currentStep={wizard.step} />
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 sm:px-6">
            <StepComponent />
          </div>
        </div>
      </div>
    </WizardProvider>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full w-full items-center justify-center bg-[#0a0a0c]">
          <Loader2 className="animate-spin text-cyan-500" size={32} />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
