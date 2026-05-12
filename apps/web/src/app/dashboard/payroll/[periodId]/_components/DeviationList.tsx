"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { DeviationRow } from "../_hooks/use-payroll-deviations";
import type { Database } from "@smartout/supabase";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type DeviationSeverity = Database["payroll"]["Enums"]["deviation_severity"];

const SEVERITY_CONFIG: Record<
  DeviationSeverity,
  {
    icon: React.FC<{ className?: string }>;
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    textClass: string;
  }
> = {
  error: {
    icon: AlertCircle,
    label: "Feil",
    variant: "destructive",
    textClass: "text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    label: "Advarsel",
    variant: "secondary",
    textClass: "text-amber-600",
  },
  info: {
    icon: Info,
    label: "Info",
    variant: "outline",
    textClass: "text-muted-foreground",
  },
};

type AcknowledgeDialogState = {
  deviationId: string;
  resolution: string;
} | null;

type Props = {
  deviations: DeviationRow[];
  isLoading: boolean;
  isPeriodOpen: boolean;
  onAcknowledge: (deviationId: string, resolution: string) => void;
  isAcknowledging: boolean;
};

/**
 * Deviation list for a period — shows all deviations sorted by severity.
 *
 * Error deviations that are unacknowledged block period lock.
 * Each row has an "Bekreft" button that opens an inline resolution field.
 * Acknowledged deviations are dimmed but remain visible for audit.
 */
export function DeviationList({
  deviations,
  isLoading,
  isPeriodOpen,
  onAcknowledge,
  isAcknowledging,
}: Props) {
  const [ackDialog, setAckDialog] = useState<AcknowledgeDialogState>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!deviations.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Ingen avvik funnet for denne perioden.
      </div>
    );
  }

  const unackedErrors = deviations.filter(
    (d) => d.severity === "error" && !d.acknowledged_at,
  ).length;

  return (
    <div className="flex flex-col gap-2">
      {unackedErrors > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {unackedErrors} ubehandlet feil-avvik. Perioden kan ikke låses før alle er bekreftet.
        </div>
      )}

      {deviations.map((d) => {
        const cfg = SEVERITY_CONFIG[d.severity] ?? SEVERITY_CONFIG.info;
        const SevIcon = cfg.icon;
        const isAcked = !!d.acknowledged_at;
        const isExpanded = ackDialog?.deviationId === d.id;

        return (
          <div key={d.id} className={`rounded-lg border px-4 py-3 ${isAcked ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.textClass}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={cfg.variant} className="text-xs">
                      {d.check_id}
                    </Badge>
                    <span className="text-muted-foreground text-xs">{d.profileDisplayName}</span>
                  </div>
                  <p className="text-foreground mt-1 text-sm">{d.message}</p>
                  {isAcked && d.acknowledged_at && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Bekreftet{" "}
                      {format(new Date(d.acknowledged_at), "d. MMM yyyy HH:mm", { locale: nb })}
                      {d.resolution ? ` — ${d.resolution}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Acknowledge button — only on open periods with unacked deviations */}
              {isPeriodOpen && !isAcked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() =>
                    setAckDialog(isExpanded ? null : { deviationId: d.id, resolution: "" })
                  }
                >
                  Bekreft
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </Button>
              )}
            </div>

            {/* Inline resolution input */}
            {isExpanded && ackDialog && (
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <input
                  type="text"
                  placeholder="Begrunn bekreftelsen (valgfritt)"
                  value={ackDialog.resolution}
                  onChange={(e) => setAckDialog({ deviationId: d.id, resolution: e.target.value })}
                  className="border-input bg-background placeholder:text-muted-foreground flex-1 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={isAcknowledging}
                  onClick={() => {
                    onAcknowledge(d.id, ackDialog.resolution);
                    setAckDialog(null);
                  }}
                >
                  {isAcknowledging ? "Lagrer…" : "Bekreft avvik"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAckDialog(null)}>
                  Avbryt
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
