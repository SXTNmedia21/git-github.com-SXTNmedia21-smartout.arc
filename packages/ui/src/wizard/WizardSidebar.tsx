// packages/ui/src/wizard/WizardSidebar.tsx
"use client";

import {
  Check,
  Layers,
  Crown,
  Briefcase,
  MapPin,
  ClipboardCheck,
  FileText,
  CheckCircle,
  Sparkles,
  Upload,
  ShieldCheck,
  DollarSign,
  Users,
  Clock,
  Calendar,
  BookOpen,
  Mail,
  Building2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { WizardStepDef } from "./types";

/** Minimal icon registry — only the icons actually referenced by step definitions. */
const ICON_BY_NAME: Record<string, LucideIcon> = {
  // onboarding wizard
  layers: Layers,
  crown: Crown,
  briefcase: Briefcase,
  "map-pin": MapPin,
  "clipboard-check": ClipboardCheck,
  "file-text": FileText,
  "check-circle": CheckCircle,
  // setup wizard
  sparkles: Sparkles,
  upload: Upload,
  "shield-check": ShieldCheck,
  "dollar-sign": DollarSign,
  users: Users,
  clock: Clock,
  calendar: Calendar,
  "book-open": BookOpen,
  // join wizard
  mail: Mail,
  "building-2": Building2,
  "utensils-crossed": UtensilsCrossed,
};

interface WizardSidebarProps {
  steps: WizardStepDef<Record<string, unknown>>[];
  currentStepIndex: number;
  completedSteps: Set<string>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onStepClick?: (stepId: string) => void;
}

export function WizardSidebar({
  steps,
  currentStepIndex,
  completedSteps,
  t,
  onStepClick,
}: WizardSidebarProps) {
  return (
    <nav
      className="hidden w-64 shrink-0 flex-col gap-1 p-6 lg:flex"
      style={{ backgroundColor: "var(--wizard-sidebar)", color: "var(--wizard-text)" }}
      aria-label="Wizard progress"
    >
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = index === currentStepIndex;
        const isPending = !isCompleted && !isCurrent;
        const Icon = step.iconName ? ICON_BY_NAME[step.iconName] : undefined;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isCompleted && onStepClick?.(step.id)}
            disabled={isPending}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              isCurrent
                ? "font-medium"
                : isCompleted
                  ? "cursor-pointer opacity-80 hover:opacity-100"
                  : "cursor-default opacity-40"
            }`}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
              style={{
                backgroundColor: isCompleted
                  ? "var(--wizard-step-completed)"
                  : isCurrent
                    ? "var(--wizard-step-active)"
                    : "var(--wizard-step-pending)",
                color: isCompleted || isCurrent ? "white" : "var(--wizard-text-muted)",
              }}
            >
              {isCompleted ? (
                <Check className="h-3.5 w-3.5" />
              ) : Icon ? (
                <Icon className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span>{t(step.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
