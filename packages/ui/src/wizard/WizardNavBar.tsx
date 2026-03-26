// packages/ui/src/wizard/WizardNavBar.tsx
"use client";

/**
 * WizardNavBar — follows "Ren og Varm" styleguide Section 7.
 *
 * Primary CTA: brand orange, rounded-xl, semibold, box-shadow.
 * Tilbake: outlined card bg, rounded-xl, medium weight.
 * Hopp over: underlined muted link below buttons.
 * Validation errors: shown above buttons as a red banner.
 */

import { ArrowLeft, ArrowRight } from "lucide-react";

interface WizardNavBarProps {
  isFirst: boolean;
  isLast: boolean;
  isSkippable: boolean;
  isLoading?: boolean;
  validationErrors?: string[];
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
  validationErrors,
  t,
  onBack,
  onNext,
  onSkip,
}: WizardNavBarProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-3 px-4 pb-8 lg:px-0">
      {/* Validation error banner */}
      {validationErrors && validationErrors.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "oklch(0.577 0.245 27 / 0.08)",
            color: "var(--err, oklch(0.577 0.245 27))",
            border: "1px solid oklch(0.577 0.245 27 / 0.2)",
          }}
        >
          {validationErrors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all hover:brightness-95"
            style={{
              borderColor: "var(--brd, oklch(0.91 0.006 55))",
              background: "var(--card, oklch(0.99 0.004 60))",
              color: "var(--fg, oklch(0.15 0.01 50))",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("nav.back")}
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{
            background: "var(--brand, #f97316)",
            boxShadow: "0 2px 12px oklch(0.65 0.22 40 / 0.25)",
          }}
        >
          {isLast ? t("nav.finish") : t("nav.next")}
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>

      {isSkippable && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="block w-full text-center text-sm underline transition-colors"
          style={{ color: "var(--fgm, oklch(0.52 0.01 52))" }}
        >
          {t("nav.skip")}
        </button>
      )}
    </div>
  );
}
