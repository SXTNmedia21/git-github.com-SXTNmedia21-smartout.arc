"use client";

import { useState } from "react";
import { Check, Edit2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useApproveShiftHours } from "../_hooks/useReconciliation";

type ShiftApprovalRow = {
  approval_id: string;
  shift_id: string;
  punch_in: string | null;
  punch_out: string | null;
  planned_hours: number;
  calculated_hours: number | null;
  approved_hours: number | null;
  status: string;
  system_deviations: unknown;
  schedule_shift: {
    employee_id: string | null;
    start_time: string;
    end_time: string;
  } | null;
};

type ShiftApprovalSectionProps = {
  approvals: ShiftApprovalRow[];
  profileId: string;
};

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "destructive" | "outline" | "secondary" }
> = {
  pending: { label: "Venter", variant: "outline" },
  approved: { label: "Godkjent", variant: "default" },
  edited: { label: "Redigert", variant: "secondary" },
  disputed: { label: "Bestridt", variant: "destructive" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHours(h: number | null): string {
  if (h === null) return "--";
  return `${h.toFixed(1)}t`;
}

export function ShiftApprovalSection({ approvals, profileId }: ShiftApprovalSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState<string>("");
  const [editJustification, setEditJustification] = useState<string>("");
  const approveMutation = useApproveShiftHours();

  const totalPlanned = approvals.reduce((sum, a) => sum + Number(a.planned_hours), 0);
  const totalActual = approvals.reduce((sum, a) => sum + (Number(a.calculated_hours) || 0), 0);
  const totalApproved = approvals.reduce((sum, a) => sum + (Number(a.approved_hours) || 0), 0);

  async function handleApprove(approvalId: string, hours: number) {
    await approveMutation.mutateAsync({
      approvalId,
      approvedHours: hours,
      profileId,
    });
  }

  async function handleEditSubmit(approvalId: string) {
    await approveMutation.mutateAsync({
      approvalId,
      approvedHours: parseFloat(editHours),
      profileId,
      justification: editJustification,
    });
    setEditingId(null);
    setEditHours("");
    setEditJustification("");
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Vaktgodkjenning</CardTitle>
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span>Planlagt: {formatHours(totalPlanned)}</span>
            <span>Faktisk: {formatHours(totalActual)}</span>
            <span className="text-foreground font-medium">
              Godkjent: {formatHours(totalApproved)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {approvals.map((approval) => {
            const statusConfig = STATUS_LABELS[approval.status] ?? STATUS_LABELS.pending!;
            const isEditing = editingId === approval.approval_id;

            return (
              <div
                key={approval.approval_id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Clock className="text-muted-foreground h-4 w-4 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      {formatTime(approval.punch_in)} - {formatTime(approval.punch_out)}
                    </span>
                    <Badge variant={statusConfig.variant} className="text-[10px]">
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex gap-3 text-xs">
                    <span>Planlagt: {formatHours(approval.planned_hours)}</span>
                    <span>Beregnet: {formatHours(approval.calculated_hours)}</span>
                    {approval.approved_hours !== null && (
                      <span className="text-foreground font-medium">
                        Godkjent: {formatHours(approval.approved_hours)}
                      </span>
                    )}
                  </div>

                  {/* Edit form */}
                  {isEditing && (
                    <div className="bg-muted/50 mt-2 flex flex-col gap-2 rounded-lg p-2">
                      <input
                        type="number"
                        step="0.5"
                        value={editHours}
                        onChange={(e) => setEditHours(e.target.value)}
                        placeholder="Timer"
                        className="bg-background w-24 rounded border px-2 py-1 text-sm"
                      />
                      <input
                        type="text"
                        value={editJustification}
                        onChange={(e) => setEditJustification(e.target.value)}
                        placeholder="Begrunnelse (obligatorisk)"
                        className="bg-background rounded border px-2 py-1 text-sm"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleEditSubmit(approval.approval_id)}
                          disabled={!editHours || !editJustification}
                        >
                          Lagre
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {approval.status === "pending" && !isEditing && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleApprove(
                          approval.approval_id,
                          Number(approval.calculated_hours ?? approval.planned_hours),
                        )
                      }
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(approval.approval_id);
                        setEditHours(String(approval.calculated_hours ?? approval.planned_hours));
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
