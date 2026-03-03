"use client";

import { Circle, CheckCircle2, AlertCircle, Clock, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ReconciliationRow = {
  reconciliation_id: string;
  reconciliation_date: string;
  status: string;
  revenue_total: number | null;
  department_session: {
    department: {
      name: string;
    };
  };
};

type DayListProps = {
  reconciliations: ReconciliationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const STATUS_CONFIG: Record<string, { icon: typeof Circle; color: string; label: string }> = {
  open: {
    icon: Circle,
    color: "text-muted-foreground",
    label: "Apen",
  },
  submitted: {
    icon: Clock,
    color: "text-amber-500",
    label: "Innsendt",
  },
  awaiting_approval: {
    icon: AlertCircle,
    color: "text-amber-500",
    label: "Venter godkjenning",
  },
  approved: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    label: "Godkjent",
  },
  locked: {
    icon: Lock,
    color: "text-muted-foreground",
    label: "Last",
  },
  unreconciled: {
    icon: AlertCircle,
    color: "text-destructive",
    label: "Ikke avstemt",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "--";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DayList({ reconciliations, selectedId, onSelect }: DayListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dager</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-2">
        {reconciliations.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-sm">Ingen avstemminger funnet</p>
        )}
        {reconciliations.map((recon) => {
          const config = STATUS_CONFIG[recon.status] ?? STATUS_CONFIG.open!;
          const StatusIcon = config.icon;
          const isSelected = recon.reconciliation_id === selectedId;

          return (
            <button
              key={recon.reconciliation_id}
              type="button"
              onClick={() => onSelect(recon.reconciliation_id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                isSelected ? "bg-primary/10 ring-primary/30 ring-1" : "hover:bg-muted/50",
              )}
            >
              <StatusIcon className={cn("h-4 w-4 shrink-0", config.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {formatDate(recon.reconciliation_date)}
                  </span>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", config.color)}>
                    {config.label}
                  </Badge>
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>{recon.department_session?.department?.name ?? "Ukjent avd."}</span>
                  <span>{formatAmount(recon.revenue_total)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
