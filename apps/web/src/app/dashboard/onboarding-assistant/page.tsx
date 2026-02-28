import { AssistantUI } from "./_components/assistant-ui";

export const metadata = {
  title: "Onboarding Assistant | Smartout",
  description: "AI-driven onboarding assistant.",
};

export default function OnboardingAssistantPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Onboarding Assistant</h2>
      </div>

      <AssistantUI />
    </div>
  );
}
