import { SkeletonCard, SkeletonHeading } from "@smartout/ui";

export default function OnboardingAssistantLoading() {
  return (
    <div
      className="flex-1 space-y-4 p-4 pt-6 md:p-8"
      role="status"
      aria-live="polite"
      aria-label="Laster onboarding-assistent"
    >
      <SkeletonHeading className="h-9 w-72" />
      <SkeletonCard className="min-h-48" />
    </div>
  );
}
