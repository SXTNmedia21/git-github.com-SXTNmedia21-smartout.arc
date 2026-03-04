"use client";

import { AlertTriangle } from "lucide-react";

// UI Events:
// - visual: red-tinted alert card for expired protocol assignments
// - visual: shows up to 5 items with overflow indicator

interface OverdueAlertItem {
  protocolName: string;
  displayName: string;
  assignedAt: string;
}

interface OverdueAlertsProps {
  expiredAssignees: OverdueAlertItem[];
}

function daysSince(dateStr: string): number {
  const assigned = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - assigned.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function OverdueAlerts({ expiredAssignees }: OverdueAlertsProps) {
  if (expiredAssignees.length === 0) return null;

  const visible = expiredAssignees.slice(0, 5);
  const remaining = expiredAssignees.length - visible.length;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm font-semibold text-red-500">
          {expiredAssignees.length} utløpte tildelinger
        </span>
      </div>

      <ul className="space-y-2">
        {visible.map((item, i) => (
          <li
            key={`${item.protocolName}-${item.displayName}-${i}`}
            className="text-muted-foreground flex items-center gap-2 text-xs"
          >
            <span className="text-foreground font-medium">{item.displayName}</span>
            <span className="text-muted-foreground/60">&mdash;</span>
            <span>{item.protocolName}</span>
            <span className="text-muted-foreground/60">&mdash;</span>
            <span className="text-red-400">{daysSince(item.assignedAt)} dager siden</span>
          </li>
        ))}
      </ul>

      {remaining > 0 && <p className="text-muted-foreground mt-2 text-xs">+ {remaining} til</p>}
    </div>
  );
}
