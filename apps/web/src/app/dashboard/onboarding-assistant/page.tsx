import { Suspense } from "react";
import { AssistantUI } from "./_components/assistant-ui";
import { OnboardingAssistantToolsBridge } from "./_tools/onboarding-assistant-tools-bridge";
import OnboardingAssistantLoading from "./loading";

export const metadata = {
  title: "Onboarding Assistant | Smartout",
  description: "AI-driven onboarding assistant.",
};

/**
 * /dashboard/onboarding-assistant — Server Component shell.
 *
 * Static page header rendered on the server; the interactive
 * voice/chat surface (AssistantUI) is a client island mounted
 * inside a Suspense boundary per ADR-0115. No server-side data
 * fetch — a real onboarding session is initiated from the setup
 * wizard.
 *
 * Harness bridge: OnboardingAssistantToolsBridge registers 4 Botsson
 * tools (getOnboardingProgress, listOnboardingSteps, getCurrentStep,
 * openStep) with static no-step defaults. When the setup wizard wires
 * real step data, pass live values via props instead of the defaults.
 *
 * ADR-0238: AssistantUI is a holding placeholder with no active chat
 * textbox — no <DomainChatOwnership> needed. Botsson Orb is interactive.
 */
export default function OnboardingAssistantPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight">
          Onboarding Assistant
        </h2>
      </div>

      {/*
       * Bridge uses static defaults — no live step data available at this
       * shell level. When AssistantUI grows real session state, lift step
       * data here and pass it down.
       */}
      <OnboardingAssistantToolsBridge
        steps={[]}
        completedCount={0}
        totalCount={0}
        navigate={() => undefined}
      />

      <Suspense fallback={<OnboardingAssistantLoading />}>
        <AssistantUI />
      </Suspense>
    </div>
  );
}
