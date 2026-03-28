// ============================================
// DemoShell.tsx
// Split-screen layout for guided demo journeys.
// Left side (70%): Feature UI component for the journey.
// Right side (30%): AI assistant chat panel.
// Top: Step progress indicator.
// On mobile: stacked layout (assistant on top, feature below).
// Connected to: app/demo/[journey]/page.tsx (consumer),
//   AssistantPanel.tsx, JourneyProgress.tsx, useDemoJourney.ts
// ============================================

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { AssistantPanel } from "./AssistantPanel";
import { JourneyProgress } from "./JourneyProgress";
import { useDemoJourney } from "./useDemoJourney";
import type { JourneyConfig } from "./journeys/types";

type DemoShellProps = {
  /** The journey configuration to render */
  config: JourneyConfig;
};

/**
 * Orchestrates the entire demo experience for one journey.
 *
 * Why one shell for all journeys: Each journey swaps only the
 * feature component and step config. The shell, chat panel,
 * and progress bar stay the same — consistent UX across
 * all 6 scenarios.
 */
export function DemoShell({ config }: DemoShellProps) {
  const router = useRouter();
  const journey = useDemoJourney(config);
  const FeatureComponent = config.featureComponent;

  return (
    <div className="dark-section bg-background text-foreground flex h-[100dvh] flex-col">
      {/* Top bar — back button, progress, reset */}
      <header className="border-border flex shrink-0 items-center gap-4 border-b px-4 py-3 sm:px-6">
        <button
          onClick={() => router.push("/demo")}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          aria-label="Tilbake til demo-oversikt"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Tilbake</span>
        </button>

        <div className="flex-1">
          <JourneyProgress
            title={config.title}
            persona={config.persona}
            totalSteps={config.steps.length}
            currentStep={journey.currentStepIndex}
          />
        </div>

        {journey.isComplete && (
          <button
            onClick={journey.reset}
            className="border-border text-muted-foreground hover:border-border hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Start på nytt
          </button>
        )}
      </header>

      {/* Main content — split layout */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: Feature UI (70% on desktop, full width on mobile) */}
        <div className="order-2 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:order-1 lg:w-[70%] lg:flex-none">
          <FeatureComponent
            currentStepId={journey.currentStepId}
            uiState={journey.uiState}
            onInteraction={journey.handleInteraction}
          />
        </div>

        {/* Right: Assistant panel (30% on desktop, top on mobile) */}
        <div className="border-border order-1 h-[40vh] shrink-0 border-b p-3 lg:order-2 lg:h-auto lg:w-[30%] lg:min-w-[320px] lg:border-b-0 lg:border-l">
          <AssistantPanel
            messages={journey.messages}
            isTyping={journey.isTyping}
            isVoiceActive={journey.isVoiceActive}
            onToggleVoice={journey.toggleVoice}
            onSendMessage={journey.handleSendMessage}
            onQuickReply={journey.handleQuickReply}
          />
        </div>
      </div>
    </div>
  );
}
