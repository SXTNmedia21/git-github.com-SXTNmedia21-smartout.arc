"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Shield,
  Users,
  Wrench,
  Monitor,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useResolveDeviation } from "../_hooks/useReconciliation";

type DeviationRow = {
  deviation_id: string;
  domain: string;
  subcategory: string | null;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  cost_impact: number | null;
  blocks_day_approval: boolean;
  resolution_notes: string | null;
};

type DeviationSectionProps = {
  deviations: DeviationRow[];
  profileId: string;
};

const DOMAIN_ICONS: Record<string, typeof Shield> = {
  safety: Shield,
  customer: Users,
  procedure: Wrench,
  system: Monitor,
  material: Package,
};

const DOMAIN_LABELS: Record<string, string> = {
  safety: "Sikkerhet",
  customer: "Kunde",
  procedure: "Prosedyre",
  system: "System",
  material: "Materiell",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground bg-muted",
  medium: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/20",
  high: "text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/20",
  critical: "text-destructive bg-destructive/10",
};

export function DeviationSection({ deviations, profileId }: DeviationSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState<string>("");
  const resolveMutation = useResolveDeviation();

  const blocking = deviations.filter((d) => d.blocks_day_approval);
  const openCount = deviations.filter((d) => d.status === "open").length;

  async function handleResolve(deviationId: string) {
    await resolveMutation.mutateAsync({
      deviationId,
      profileId,
      notes: resolveNotes,
    });
    setExpandedId(null);
    setResolveNotes("");
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Avvik</CardTitle>
          <div className="flex gap-2">
            {blocking.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {blocking.length} blokkerer
              </Badge>
            )}
            {openCount > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {openCount} apne
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {deviations.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Ingen avvik registrert</p>
        ) : (
          <div className="space-y-2">
            {deviations.map((dev) => {
              const DomainIcon = DOMAIN_ICONS[dev.domain] ?? AlertTriangle;
              const isExpanded = expandedId === dev.deviation_id;

              return (
                <div
                  key={dev.deviation_id}
                  className={cn(
                    "rounded-lg border transition-colors",
                    dev.blocks_day_approval && dev.status === "open"
                      ? "border-destructive/30 bg-destructive/5"
                      : "",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : dev.deviation_id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <DomainIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{dev.title}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {DOMAIN_LABELS[dev.domain] ?? dev.domain}
                        </Badge>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            SEVERITY_COLORS[dev.severity],
                          )}
                        >
                          {dev.severity}
                        </span>
                        <Badge
                          variant={dev.status === "resolved" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {dev.status}
                        </Badge>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="text-muted-foreground h-4 w-4" />
                    ) : (
                      <ChevronDown className="text-muted-foreground h-4 w-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t px-3 pt-2 pb-3">
                      {dev.description && (
                        <p className="text-muted-foreground text-sm">{dev.description}</p>
                      )}
                      {dev.cost_impact !== null && (
                        <p className="mt-1 text-xs">
                          Kostnadspåvirkning:{" "}
                          <span className="font-medium">
                            {new Intl.NumberFormat("nb-NO", {
                              style: "currency",
                              currency: "NOK",
                            }).format(dev.cost_impact)}
                          </span>
                        </p>
                      )}
                      {dev.resolution_notes && (
                        <p className="bg-muted/50 mt-2 rounded p-2 text-xs">
                          Løsning: {dev.resolution_notes}
                        </p>
                      )}

                      {dev.status === "open" && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={resolveNotes}
                            onChange={(e) => setResolveNotes(e.target.value)}
                            placeholder="Beskriv hvordan avviket ble håndtert..."
                            rows={2}
                            className="bg-background w-full rounded border px-3 py-2 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleResolve(dev.deviation_id)}
                            disabled={!resolveNotes.trim()}
                          >
                            Marker som løst
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
