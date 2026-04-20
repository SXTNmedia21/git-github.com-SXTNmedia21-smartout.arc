/**
 * OrphanBadge (web) — dashed-border treatment for "no one is responsible."
 *
 * Used in orphan desk cards and the ResponsibleRepCombobox empty trigger.
 * Warm concern, not alarm — the dashed border communicates a quiet lapse
 * without triggering cortisol. No red, no `destructive` token (Spec §1.4).
 */

import * as React from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export type OrphanBadgeProps = {
  icon?: LucideIcon;
  label: string;
  iconSize?: number;
  className?: string;
};

export function OrphanBadge({
  icon: Icon = AlertCircle,
  label,
  iconSize = 20,
  className,
}: OrphanBadgeProps) {
  return (
    <span
      className={cn(
        "border-border/60 bg-muted/30 text-muted-foreground inline-flex items-center gap-2 rounded-full border border-dashed px-3 py-1 text-xs",
        className,
      )}
      role="status"
    >
      <Icon size={iconSize} aria-hidden="true" className="text-muted-foreground" />
      <span>{label}</span>
    </span>
  );
}
