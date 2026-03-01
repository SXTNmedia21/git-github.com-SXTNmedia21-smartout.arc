"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type IntegrityCheck = {
  name: string;
  status: "pass" | "warn" | "error";
  message: string;
};

type IntegrityChecksCardProps = {
  checks: IntegrityCheck[] | null;
  loading: boolean;
  onRun: () => void;
};

const statusConfig = {
  pass: { icon: CheckCircle2, color: "text-emerald-500" },
  warn: { icon: AlertTriangle, color: "text-orange-500" },
  error: { icon: XCircle, color: "text-red-500" },
} as const;

export function IntegrityChecksCard({ checks, loading, onRun }: IntegrityChecksCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Data Integrity Checks</h3>
        <Button variant="outline" size="sm" onClick={onRun} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          {loading ? "Running..." : "Run Checks"}
        </Button>
      </div>
      {checks ? (
        <div className="space-y-2">
          {checks.map((check, i) => {
            const cfg = statusConfig[check.status];
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-start gap-2 rounded-md border px-3 py-2">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{check.name}</p>
                  <p className="text-muted-foreground text-xs">{check.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Click &ldquo;Run Checks&rdquo; to verify data integrity via watchdog-integrity edge
          function.
        </p>
      )}
    </Card>
  );
}
