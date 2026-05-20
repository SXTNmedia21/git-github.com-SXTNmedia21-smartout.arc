"use client";

import { Suspense } from "react";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { JoinScrapingProvider } from "./_context/JoinScrapingProvider";
import { joinWizard } from "./wizard-definition";
import { ExpiredSessionGate } from "./_components/ExpiredSessionGate";

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center">Loading...</div>}>
      {/*
       * ExpiredSessionGate fires its session check on mount in parallel with
       * wizard hydration. If it detects a stale envelope + no live session,
       * it redirects to /login before the user sees or interacts with the wizard.
       */}
      <ExpiredSessionGate>
        <JoinScrapingProvider>
          <AnimatedWizardShell definition={joinWizard} />
        </JoinScrapingProvider>
      </ExpiredSessionGate>
    </Suspense>
  );
}
