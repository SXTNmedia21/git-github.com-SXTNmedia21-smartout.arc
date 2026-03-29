"use client";

// DashboardModeToggle — segmented control switching between Drift, Forberedelse, and
// Auto modes. In Auto mode, a parenthetical hint shows the inferred mode's initial.

import { useTranslation } from "@smartout/i18n";

type DashboardModeToggleProps = {
  override: "operative" | "preparatory" | "auto";
  autoMode: "operative" | "preparatory";
  onOverrideChange: (mode: "operative" | "preparatory" | "auto") => void;
};

const SEGMENTS = ["operative", "preparatory", "auto"] as const;

export function DashboardModeToggle({
  override,
  autoMode,
  onOverrideChange,
}: DashboardModeToggleProps) {
  const { t } = useTranslation("dashboard");

  const labels: Record<string, string> = {
    operative: t("interactive.mode_drift"),
    preparatory: t("interactive.mode_prep"),
    auto: t("interactive.mode_auto"),
  };

  return (
    <div
      className="bg-muted/50 border-border flex items-center gap-0.5 rounded-lg border p-0.5"
      role="radiogroup"
      aria-label="Dashboard mode"
    >
      {SEGMENTS.map((seg) => {
        const isActive = override === seg;
        return (
          <button
            key={seg}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onOverrideChange(seg)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[seg]}
            {seg === "auto" && (
              <span className="text-muted-foreground ml-1 text-[10px]">
                ({labels[autoMode]?.charAt(0)})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
