// ============================================
// wizard-phase-indicator.tsx — Wizard Phase Stepper
// Horizontal stepper showing the 6 wizard phases.
// Highlights the current phase and checks completed ones.
// Connected to: wizard_phase enum (discovery through review)
// ============================================

"use client";

import {
  Lightbulb,
  FolderKanban,
  ListOrdered,
  TestTube2,
  BookOpen,
  CheckCircle2,
} from "lucide-react";

const PHASES = [
  { key: "discovery", label: "Discovery", icon: Lightbulb },
  { key: "classification", label: "Classification", icon: FolderKanban },
  { key: "steps", label: "Steps", icon: ListOrdered },
  { key: "testing", label: "Testing", icon: TestTube2 },
  { key: "documentation", label: "Documentation", icon: BookOpen },
  { key: "review", label: "Review", icon: CheckCircle2 },
] as const;

type WizardPhaseIndicatorProps = {
  currentPhase: string;
};

/**
 * Renders a horizontal phase stepper for the 6-phase wizard.
 *
 * Phases before the current one are marked as completed (check icon).
 * The current phase is highlighted with primary color.
 * Future phases are dimmed.
 */
export function WizardPhaseIndicator({ currentPhase }: WizardPhaseIndicatorProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const Icon = phase.icon;
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={phase.key} className="flex items-center">
            {/* Phase dot/icon */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-primary/10 text-primary"
                  : isCompleted
                    ? "text-muted-foreground bg-muted"
                    : "text-muted-foreground/50"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{phase.label}</span>
            </div>

            {/* Connector line between phases */}
            {i < PHASES.length - 1 && (
              <div
                className={`mx-0.5 h-px w-4 ${
                  i < currentIndex ? "bg-primary/30" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
