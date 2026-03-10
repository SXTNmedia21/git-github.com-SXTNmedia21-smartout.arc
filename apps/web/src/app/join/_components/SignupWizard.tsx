"use client";

import { useEffect, useRef, useState } from "react";
import { WizardProvider, useSignupWizard, type WizardState } from "../_hooks/useSignupWizard";
import { WizardProgress } from "./WizardProgress";
import { Step1Account } from "./Step1Account";
import { Step2Business } from "./Step2Business";
import { Step3About } from "./Step3About";
import { Step4Hours } from "./Step4Hours";
import { Step5Menu } from "./Step5Menu";
import { Step6Team } from "./Step6Team";
import { SetupLoading } from "./SetupLoading";

interface SignupWizardProps {
  userEmail: string;
  initialState?: Partial<WizardState>;
}

export function SignupWizard({ userEmail, initialState }: SignupWizardProps) {
  return (
    <WizardProvider initialState={initialState}>
      <WizardContent userEmail={userEmail} />
    </WizardProvider>
  );
}

function WizardContent({ userEmail }: { userEmail: string }) {
  const { state, scrapedData, scrapeStatus } = useSignupWizard();
  const prevStepRef = useRef(state.currentStep);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Determine slide direction
  useEffect(() => {
    setDirection(state.currentStep >= prevStepRef.current ? "forward" : "backward");
    prevStepRef.current = state.currentStep;
  }, [state.currentStep]);

  const isSetupPhase = state.currentStep >= 7;

  return (
    <div className="from-background via-background flex min-h-screen flex-col bg-gradient-to-b to-orange-50/30 dark:to-orange-950/5">
      {!isSetupPhase && <WizardProgress />}

      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-12">
        <div
          key={state.currentStep}
          className="animate-wizard-step w-full"
          style={
            {
              "--step-direction": direction === "forward" ? "30px" : "-30px",
            } as React.CSSProperties
          }
        >
          {state.currentStep === 1 && <Step1Account userEmail={userEmail} />}
          {state.currentStep === 2 && <Step2Business scrapeStatus={scrapeStatus} />}
          {state.currentStep === 3 && (
            <Step3About
              scrapedData={scrapedData}
              scrapeStatus={scrapeStatus}
              companyName={state.step1.companyName ?? ""}
            />
          )}
          {state.currentStep === 4 && <Step4Hours scrapedData={scrapedData} />}
          {state.currentStep === 5 && <Step5Menu />}
          {state.currentStep === 6 && <Step6Team />}
          {isSetupPhase && <SetupLoading />}
        </div>
      </main>
    </div>
  );
}
