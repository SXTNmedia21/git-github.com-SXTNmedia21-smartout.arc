// packages/ui/src/wizard/WizardNavBar.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface WizardNavBarProps {
  isFirst: boolean;
  isLast: boolean;
  isSkippable: boolean;
  isLoading?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
}

export function WizardNavBar({
  isFirst,
  isLast,
  isSkippable,
  isLoading,
  t,
  onBack,
  onNext,
  onSkip,
}: WizardNavBarProps) {
  return (
    <div
      className="flex items-center justify-between border-t px-6 py-4"
      style={{ borderColor: "var(--wizard-border)", backgroundColor: "var(--wizard-bg)" }}
    >
      <button
        type="button"
        onClick={onBack}
        disabled={isFirst}
        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-opacity disabled:opacity-30"
        style={{ color: "var(--wizard-text-muted)" }}
      >
        <ChevronLeft className="h-4 w-4" />
        {t("nav.back")}
      </button>

      <div className="flex items-center gap-3">
        {isSkippable && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--wizard-text-muted)" }}
          >
            {t("nav.skip")}
          </button>
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--wizard-step-active)" }}
        >
          {isLast ? t("nav.finish") : t("nav.next")}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
