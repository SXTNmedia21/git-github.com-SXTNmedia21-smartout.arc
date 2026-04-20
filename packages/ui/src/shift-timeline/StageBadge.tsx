// packages/ui/src/shift-timeline/StageBadge.tsx
"use client";

/**
 * StageBadge — small status chip rendered next to a stage label.
 *
 * Variant indicates the concrete situation (deviation raised, punched in,
 * pending approval, locked etc.). Copy is passed in from the composed
 * component so i18n lives one level up; the primitive just provides the
 * shape, color and accessible label wiring.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, AlertOctagon, Clock, LogIn, LogOut, Lock } from "lucide-react";
import { cn } from "../lib/utils";
import type { StageBadgeVariant } from "./types";

export type StageBadgeProps = {
  variant: StageBadgeVariant;
  label: string;
  title?: string;
  className?: string;
};

const ICONS: Record<StageBadgeVariant, LucideIcon> = {
  deviation: AlertTriangle,
  blocking: AlertOctagon,
  "pending-approval": Clock,
  "punched-in": LogIn,
  "punched-out": LogOut,
  locked: Lock,
};

const VARIANT_CLASSES: Record<StageBadgeVariant, string> = {
  deviation: "bg-muted/60 text-foreground [--badge-icon:oklch(0.75_0.15_55)]",
  blocking: "bg-destructive/10 text-destructive [--badge-icon:var(--color-destructive)]",
  "pending-approval": "bg-muted/60 text-muted-foreground [--badge-icon:var(--color-primary)]",
  "punched-in": "bg-muted/60 text-foreground [--badge-icon:oklch(0.65_0.2_145)]",
  "punched-out": "bg-muted/60 text-muted-foreground [--badge-icon:var(--color-muted-foreground)]",
  locked: "bg-muted/60 text-muted-foreground [--badge-icon:var(--color-muted-foreground)]",
};

export function StageBadge({ variant, label, title, className }: StageBadgeProps) {
  const Icon = ICONS[variant];
  return (
    <span
      // Static chip — interaction handled by the enclosing stage button.
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        "hover:ring-primary/30 transition-[box-shadow] duration-150 hover:ring-1",
        VARIANT_CLASSES[variant],
        className,
      )}
      title={title ?? label}
      aria-label={title ?? label}
    >
      <Icon aria-hidden className="h-3 w-3" style={{ color: "var(--badge-icon)" }} />
      <span>{label}</span>
    </span>
  );
}
