"use client";

import { Suspense } from "react";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { JoinScrapingProvider } from "./_context/JoinScrapingProvider";
import { joinWizard } from "./wizard-definition";

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center">Loading...</div>}>
      <JoinScrapingProvider>
        <AnimatedWizardShell definition={joinWizard} />
      </JoinScrapingProvider>
    </Suspense>
  );
}
