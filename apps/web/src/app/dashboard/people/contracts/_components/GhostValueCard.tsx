"use client";

/**
 * GhostValueCard — Shows a cascade-derived value with its source.
 *
 * Displays a "ghost" value (auto-resolved from framework rules / tariff tables)
 * that the admin can acknowledge or drill into for reasoning.
 * Dashed border signals "this was filled for you" — solid border after acknowledgement.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";

type GhostValueCardProps = {
  label: string;
  value: string;
  source: string;
  onClickExplain?: () => void;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
};

export function GhostValueCard({
  label,
  value,
  source,
  onClickExplain,
  acknowledged = false,
  onAcknowledge,
}: GhostValueCardProps) {
  const { t } = useTranslation("contracts");
  return (
    <div
      className={`rounded-lg p-4 transition-colors ${
        acknowledged
          ? "border-primary/30 bg-primary/5 border-2"
          : "border-border border-2 border-dashed"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="text-primary h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs tracking-wide uppercase">{label}</span>
          </div>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{source}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          {!acknowledged && onAcknowledge && (
            <Button size="sm" variant="outline" onClick={onAcknowledge}>
              {t("ghost_value.approve")}
            </Button>
          )}
          {onClickExplain && (
            <Button size="sm" variant="ghost" onClick={onClickExplain}>
              {t("ghost_value.show_reasoning")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
