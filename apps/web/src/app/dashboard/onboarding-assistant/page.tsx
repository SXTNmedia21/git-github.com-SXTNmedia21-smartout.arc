import { Suspense } from "react";
import { AssistantUI } from "./_components/assistant-ui";
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
 */
export default function OnboardingAssistantPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Onboarding Assistant</h2>
      </div>

      <Suspense fallback={<OnboardingAssistantLoading />}>
        <AssistantUI />
      </Suspense>
    </div>
  );
}
