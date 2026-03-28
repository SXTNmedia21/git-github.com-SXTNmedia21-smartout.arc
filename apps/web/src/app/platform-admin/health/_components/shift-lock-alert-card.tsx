"use client";

// ============================================
// shift-lock-alert-card.tsx
// Platform-admin alert card for temporal shift lock rollout health.
// Why: makes override risk and off-mode drift visible in one glance.
// ============================================

import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type ShiftLockHealth = {
  severity: "normal" | "warning" | "critical";
  total_attempts_24h: number;
  override_attempts_24h: number;
  override_rate_pct_24h: number;
  off_workspaces: number;
  shadow_workspaces: number;
  enforce_workspaces: number;
  active_workspaces: number;
  evaluated_at: string;
} | null;

type ShiftLockAlertCardProps = {
  shiftLock: ShiftLockHealth;
  id?: string;
  highlighted?: boolean;
};

const severityConfig = {
  normal: {
    label: "Shift Lock Stable",
    icon: CheckCircle2,
    cardClass: "border-emerald-500/20 bg-emerald-500/5",
    textClass: "text-emerald-500",
  },
  warning: {
    label: "Shift Lock Warning",
    icon: AlertTriangle,
    cardClass: "border-orange-500/20 bg-orange-500/5",
    textClass: "text-orange-500",
  },
  critical: {
    label: "Shift Lock Critical",
    icon: XCircle,
    cardClass: "border-destructive/30 bg-destructive/5",
    textClass: "text-destructive",
  },
} as const;

/**
 * Renders platform-level shift lock health and alerts.
 *
 * @param shiftLock - Aggregated shift lock health from status API.
 * @returns Alert card with severity, key counts, and thresholds.
 */
export function ShiftLockAlertCard({
  shiftLock,
  id,
  highlighted = false,
}: ShiftLockAlertCardProps) {
  if (!shiftLock) {
    return (
      <Card className="border-border p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium">Shift lock alert data unavailable</p>
        </div>
      </Card>
    );
  }

  const config = severityConfig[shiftLock.severity];
  const Icon = config.icon;

  return (
    <Card
      id={id}
      className={cn(
        "p-4 transition-shadow",
        config.cardClass,
        highlighted && "ring-primary ring-2",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.textClass)} />
          <p className={cn("text-sm font-semibold", config.textClass)}>{config.label}</p>
        </div>
        <p className="text-muted-foreground text-xs">
          Evaluated {new Date(shiftLock.evaluated_at).toLocaleTimeString("no-NO")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Metric label="Attempts 24h" value={String(shiftLock.total_attempts_24h)} />
        <Metric label="Overrides 24h" value={String(shiftLock.override_attempts_24h)} />
        <Metric label="Override rate" value={`${shiftLock.override_rate_pct_24h}%`} />
        <Metric label="Workspaces off" value={String(shiftLock.off_workspaces)} />
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-xs">
        <span>Enforce: {shiftLock.enforce_workspaces}</span>
        <span>Shadow: {shiftLock.shadow_workspaces}</span>
        <span>Active workspaces: {shiftLock.active_workspaces}</span>
        <span>Thresholds: warning ≥ 5% · critical ≥ 15% or off &gt; 0</span>
      </div>
    </Card>
  );
}

/**
 * Compact label-value renderer for alert metrics.
 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/60 rounded-md border p-2">
      <p className="text-muted-foreground text-[11px] uppercase">{label}</p>
      <p className="text-foreground text-base font-semibold">{value}</p>
    </div>
  );
}
