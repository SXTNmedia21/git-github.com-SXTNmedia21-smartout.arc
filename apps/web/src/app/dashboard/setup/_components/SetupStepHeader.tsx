"use client";

/**
 * SetupStepHeader — shared header for all setup wizard adapters.
 *
 * Renders step title, subtitle, explanation text, and optional industry-specific
 * tip (from IndustryPackage.botsson). Replaces the legacy shell's built-in
 * step header + BotsTip + HelpTip.
 */

import { Info } from "lucide-react";

interface SetupStepHeaderProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  botssonTip?: string;
}

export function SetupStepHeader({
  t,
  stepId,
  stepIndex,
  totalSteps,
  botssonTip,
}: SetupStepHeaderProps) {
  const title = t(`steps.${stepId}_title`);
  const subtitle = t(`steps.${stepId}_subtitle`);
  const explanation = t(`steps.${stepId}_explanation`);

  return (
    <div className="mb-8 space-y-3">
      <p className="text-brand-orange/70 text-xs font-bold tracking-widest uppercase">
        {t("steps.counter", { current: stepIndex, total: totalSteps - 1 })} &middot; {subtitle}
      </p>
      <h1 className="text-foreground text-3xl font-black tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed">{explanation}</p>

      {botssonTip && (
        <div className="bg-muted/50 border-border mt-4 flex items-start gap-3 rounded-xl border px-4 py-3">
          <Info className="text-brand-orange mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-sm leading-relaxed">{botssonTip}</p>
        </div>
      )}
    </div>
  );
}
