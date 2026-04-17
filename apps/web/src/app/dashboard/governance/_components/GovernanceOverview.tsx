"use client";

import { useState } from "react";
import {
  Settings,
  Flame,
  Users,
  AlertTriangle,
  Key,
  CreditCard,
  ShieldCheck,
  ChevronDown,
  ClipboardList,
  UserPlus,
} from "lucide-react";
import type { ProtocolOverviewItem } from "@/app/dashboard/_hooks/dashboard-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProtocolEmployeeList } from "./ProtocolEmployeeList";
import { AssignProtocolSheet } from "./AssignProtocolSheet";

// UI Events:
// - interaction: click toggles accordion — only one protocol open at a time
// - color-regime: green (100%), orange (50-99%), red (<50%)
// - visual: progress bar per protocol card

const POLICY_TYPE_ICONS: Record<string, typeof Settings> = {
  operational: Settings,
  haccp: Flame,
  hr: Users,
  safety: AlertTriangle,
  access: Key,
  payroll: CreditCard,
  custom: ShieldCheck,
};

const POLICY_TYPE_LABELS: Record<string, string> = {
  operational: "Drift",
  haccp: "HACCP",
  hr: "HR",
  safety: "Sikkerhet",
  access: "Tilgang",
  payroll: "Lønn",
  custom: "Egendefinert",
};

function getCompletionStatus(percent: number) {
  if (percent >= 100) return "good" as const;
  if (percent >= 50) return "warning" as const;
  return "critical" as const;
}

const STATUS_COLORS = {
  good: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    ring: "ring-emerald-500/20",
  },
  warning: {
    bar: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    ring: "ring-orange-500/20",
  },
  critical: {
    bar: "bg-red-500",
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: "border-red-500/20 bg-red-500/10 text-red-500",
    ring: "ring-red-500/20",
  },
} as const;

interface GovernanceOverviewProps {
  protocols: ProtocolOverviewItem[];
}

export function GovernanceOverview({ protocols }: GovernanceOverviewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignProtocolId, setAssignProtocolId] = useState<string | null>(null);

  if (protocols.length === 0) {
    return (
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <ClipboardList className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="text-foreground mb-2 text-xl font-bold">Ingen aktive protokoller</h2>
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          Det finnes ingen aktive protokoller i dette arbeidsområdet ennå.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {protocols.map((protocol) => {
        const status = getCompletionStatus(protocol.completionPercent);
        const colors = STATUS_COLORS[status];
        const Icon = POLICY_TYPE_ICONS[protocol.policyType] ?? ShieldCheck;
        const typeLabel = POLICY_TYPE_LABELS[protocol.policyType] ?? "Egendefinert";
        const isExpanded = expandedId === protocol.protocolId;

        return (
          <div
            key={protocol.protocolId}
            className={`border-border bg-card overflow-hidden rounded-xl border transition-all duration-300 ${
              isExpanded ? "shadow-lg" : "hover:shadow-md"
            }`}
          >
            {/* Protocol card header */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : protocol.protocolId)}
              className="hover:bg-accent/50 flex w-full items-center gap-4 p-4 text-left transition-colors"
            >
              <div className={`rounded-lg border p-2 ${colors.icon}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground truncate text-sm font-semibold">
                    {protocol.protocolName}
                  </h3>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${colors.badge}`}>
                    {typeLabel}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${colors.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${protocol.completionPercent}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs font-medium">
                    {protocol.completedCount}/{protocol.totalAssigned} ansatte
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setAssignProtocolId(protocol.protocolId);
                }}
              >
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                Tildel
              </Button>

              <ChevronDown
                className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-300 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Expanded content */}
            <div
              className={`overflow-hidden border-t transition-all duration-300 ease-out ${
                isExpanded
                  ? "border-border max-h-[600px] opacity-100"
                  : "max-h-0 border-transparent opacity-0"
              }`}
            >
              <div className="p-4">
                {isExpanded && <ProtocolEmployeeList protocolId={protocol.protocolId} />}
              </div>
            </div>
          </div>
        );
      })}

      {/* Assign sheet */}
      <AssignProtocolSheet
        protocolId={assignProtocolId ?? undefined}
        open={!!assignProtocolId}
        onOpenChange={(open) => {
          if (!open) setAssignProtocolId(null);
        }}
      />
    </div>
  );
}
