"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, User, FileText, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { DeviationRow } from "@smartout/hms";
import { useUpdateDeviation } from "../_hooks/use-update-deviation";

type Props = {
  deviation: DeviationRow | null;
  open: boolean;
  onClose: () => void;
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  medium: "bg-warning text-warning-foreground",
  low: "bg-info text-info-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Apen",
  acknowledged: "Tildelt",
  escalated: "Eskalert",
  resolved: "Lukket",
};

const DOMAIN_LABELS: Record<string, string> = {
  safety: "Sikkerhet",
  customer: "Kunde",
  procedure: "Prosedyre",
  system: "System",
  material: "Materiell",
};

export function DeviationDetailDrawer({ deviation, open, onClose }: Props) {
  const updateDeviation = useUpdateDeviation();
  const [resolutionNotes, setResolutionNotes] = useState("");

  if (!deviation) return null;

  const isResolved = deviation.status === "resolved";

  function handleStatusChange(status: "acknowledged" | "escalated") {
    updateDeviation.mutate(
      { deviationId: deviation!.deviationId, action: "status", status },
      { onSuccess: () => onClose() },
    );
  }

  function handleResolve() {
    if (!resolutionNotes.trim()) return;
    updateDeviation.mutate(
      {
        deviationId: deviation!.deviationId,
        action: "resolve",
        resolutionNotes: resolutionNotes.trim(),
      },
      {
        onSuccess: () => {
          setResolutionNotes("");
          onClose();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] overflow-y-auto sm:w-[520px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span
              className={`${SEVERITY_COLORS[deviation.severity] ?? "bg-muted"} rounded px-2 py-0.5 text-[10px] font-semibold`}
            >
              {deviation.severity.toUpperCase()}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {STATUS_LABELS[deviation.status] ?? deviation.status}
            </Badge>
          </div>
          <SheetTitle className="text-left">{deviation.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Description */}
          {deviation.description && (
            <div>
              <Label className="text-muted-foreground text-xs">Beskrivelse</Label>
              <p className="text-foreground mt-1 text-sm">{deviation.description}</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <Label className="text-muted-foreground text-[10px]">Kategori</Label>
              <p className="text-foreground mt-0.5 font-medium capitalize">
                {DOMAIN_LABELS[deviation.domain] ?? deviation.domain}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-[10px]">Avdeling</Label>
              <p className="text-foreground mt-0.5 font-medium">
                {deviation.departmentName ?? "—"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-[10px]">Rapportert av</Label>
              <p className="text-foreground mt-0.5 font-medium">{deviation.reporterName ?? "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-[10px]">Opprettet</Label>
              <p className="text-foreground mt-0.5 font-medium">
                {new Date(deviation.createdAt).toLocaleString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Linked context */}
          {(deviation.sourceTaskId || deviation.procedureId) && (
            <div className="border-border space-y-1 rounded-lg border p-3">
              <Label className="text-muted-foreground text-[10px]">Koblet kontekst</Label>
              {deviation.sourceTaskId && (
                <p className="text-foreground flex items-center gap-1.5 text-xs">
                  <Clock className="h-3 w-3" /> Oppgave: {deviation.sourceTaskId.slice(0, 8)}...
                </p>
              )}
              {deviation.procedureId && (
                <p className="text-foreground flex items-center gap-1.5 text-xs">
                  <FileText className="h-3 w-3" /> Prosedyre: {deviation.procedureId.slice(0, 8)}...
                </p>
              )}
            </div>
          )}

          {/* Resolution info (if resolved) */}
          {isResolved && (
            <div className="border-success/30 bg-success/5 rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2">
                <CheckCircle2 className="text-success h-4 w-4" />
                <span className="text-success text-sm font-medium">Lukket</span>
              </div>
              {deviation.resolutionNotes && (
                <p className="text-foreground mt-1 text-xs">{deviation.resolutionNotes}</p>
              )}
              {deviation.resolverName && (
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                  <User className="h-3 w-3" /> {deviation.resolverName} ·{" "}
                  {deviation.resolvedAt
                    ? new Date(deviation.resolvedAt).toLocaleString("nb-NO", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
              )}
            </div>
          )}

          {/* Actions (admin, not resolved) */}
          {!isResolved && (
            <>
              {/* Status change buttons */}
              <div className="flex gap-2">
                {deviation.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("acknowledged")}
                    disabled={updateDeviation.isPending}
                  >
                    Tildel
                  </Button>
                )}
                {(deviation.status === "open" || deviation.status === "acknowledged") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("escalated")}
                    disabled={updateDeviation.isPending}
                  >
                    Eskaler
                  </Button>
                )}
              </div>

              {/* Resolution form */}
              <div className="border-border space-y-2 rounded-lg border p-3">
                <Label className="text-sm font-semibold">Lukk avvik</Label>
                <Textarea
                  placeholder="Beskriv hva som ble gjort for a lukke avviket..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={handleResolve}
                  disabled={!resolutionNotes.trim() || updateDeviation.isPending}
                  className="w-full"
                >
                  {updateDeviation.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                  )}
                  Lukk avvik
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
