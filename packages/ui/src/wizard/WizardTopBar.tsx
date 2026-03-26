// packages/ui/src/wizard/WizardTopBar.tsx
"use client";

/**
 * WizardTopBar — follows "Ren og Varm" styleguide Section 15.
 *
 * Completed: emerald-500 circle with checkmark, emerald text.
 * Active: brand orange circle with ring shadow, foreground text.
 * Upcoming: bordered muted circle, muted text.
 * Lines: 2px, completed = emerald, pending = border color.
 */

import { Check } from "lucide-react";
import type { WizardStepDef } from "./types";

interface WizardTopBarProps {
  steps: WizardStepDef<Record<string, unknown>>[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WizardTopBar({ steps, currentStepIndex, completedSteps, t }: WizardTopBarProps) {
  return (
    <nav aria-label="Wizard progress" className="mx-auto w-full max-w-2xl px-4 py-6">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = index === currentStepIndex;

          return (
            <li key={step.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-200"
                  style={
                    isCompleted
                      ? { background: "#22c55e", color: "white" }
                      : isCurrent
                        ? {
                            background: "var(--brand, #f97316)",
                            color: "white",
                            boxShadow: "0 0 0 4px rgba(249,115,22,0.15)",
                          }
                        : {
                            border: "2px solid var(--brd, oklch(0.91 0.006 55))",
                            background: "var(--bg2, oklch(0.965 0.005 58))",
                            color: "var(--fgm, oklch(0.52 0.01 52))",
                          }
                  }
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                </div>
                <span
                  className="text-center text-xs font-medium"
                  style={{
                    color: isCompleted
                      ? "#22c55e"
                      : isCurrent
                        ? "var(--fg, oklch(0.15 0.01 50))"
                        : "var(--fgm, oklch(0.52 0.01 52))",
                  }}
                >
                  {t(step.labelKey)}
                </span>
              </div>

              {/* Connecting line — 2px, styleguide spec */}
              {index < steps.length - 1 && (
                <div
                  className="mx-2 flex-1 rounded-full"
                  style={{
                    height: "2px",
                    background: isCompleted ? "#22c55e" : "var(--brd, oklch(0.91 0.006 55))",
                    transition: "background 0.3s",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
