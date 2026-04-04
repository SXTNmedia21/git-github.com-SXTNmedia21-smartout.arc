"use client";

import { Mic } from "lucide-react";

/**
 * AssistantUI — Entry point for the voice-based onboarding assistant.
 *
 * The AI-driven onboarding session is initiated from the setup wizard,
 * not this page directly. This component shows a holding state until
 * a real session is wired in from the wizard flow.
 */
export function AssistantUI() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10">
        <Mic className="h-8 w-8 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold">Onboarding-assistenten</h2>
      <p className="text-muted-foreground max-w-md text-center">
        Start en ny onboarding-prosess fra oppsettsveiviseren for å bruke assistenten.
      </p>
    </div>
  );
}
