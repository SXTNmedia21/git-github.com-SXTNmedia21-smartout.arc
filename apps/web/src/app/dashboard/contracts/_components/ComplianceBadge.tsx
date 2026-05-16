"use client";

/**
 * ComplianceBadge — Displays a compliance validation result.
 *
 * Three levels: ok (green check), warning (amber triangle), blocker (red X).
 * Uses role="status" and aria-live for screen reader announcements.
 */

import * as React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { ComplianceLevel } from "@smartout/utils";

type ComplianceBadgeProps = {
  level: ComplianceLevel;
  message: string;
};

const CONFIG = {
  ok: {
    icon: CheckCircle,
    className: "text-success-foreground bg-success/10 border-success/30",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-warning-foreground bg-warning/10 border-warning/30",
  },
  blocker: {
    icon: XCircle,
    className: "text-destructive bg-destructive/10 border-destructive/30",
  },
} as const;

export function ComplianceBadge({ level, message }: ComplianceBadgeProps) {
  const { icon: Icon, className } = CONFIG[level];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{message}</span>
    </div>
  );
}
