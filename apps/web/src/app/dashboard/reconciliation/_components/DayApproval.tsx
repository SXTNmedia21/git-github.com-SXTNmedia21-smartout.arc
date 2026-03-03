"use client";

import { useState, useContext } from "react";
import { CheckCircle2, XCircle, MessageSquare, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { RevenueSection } from "./RevenueSection";
import { ShiftApprovalSection } from "./ShiftApprovalSection";
import { DeviationSection } from "./DeviationSection";
import {
  useReconciliationDetail,
  useApproveReconciliation,
  useRejectReconciliation,
} from "../_hooks/useReconciliation";

type DayApprovalProps = {
  reconciliationId: string;
};

export function DayApproval({ reconciliationId }: DayApprovalProps) {
  const dashCtx = useContext(DashboardContext);
  const profileId = dashCtx.profileId ?? "";

  const { data: detail, isLoading } = useReconciliationDetail(reconciliationId);
  const approveMutation = useApproveReconciliation();
  const rejectMutation = useRejectReconciliation();

  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground text-sm">Kunne ikke laste avstemming</p>
      </div>
    );
  }

  const images = (detail.settlement_image ?? []) as Array<{
    image_id: string;
    source_type: string;
    ocr_confidence: number | null;
    storage_path: string;
  }>;

  const shiftApprovals = (detail.shift_approval ?? []) as Array<{
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
      profile_id: string;
      start_time: string;
      end_time: string;
    } | null;
  }>;

  const deviations = (detail.deviation ?? []) as Array<{
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
  }>;

  const blockingDeviations = deviations.filter((d) => d.blocks_day_approval && d.status === "open");
  const pendingShifts = shiftApprovals.filter((s) => s.status === "pending");

  const canApprove =
    detail.status === "awaiting_approval" &&
    blockingDeviations.length === 0 &&
    pendingShifts.length === 0;

  async function handleApprove() {
    await approveMutation.mutateAsync({
      reconciliationId,
      profileId,
      notes: approvalNotes || undefined,
    });
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await rejectMutation.mutateAsync({
      reconciliationId,
      reason: rejectReason,
    });
    setShowRejectForm(false);
    setRejectReason("");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {new Date(detail.reconciliation_date + "T00:00:00").toLocaleDateString("nb-NO", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Badge variant="outline">{detail.status}</Badge>
            {detail.revenue_total !== null && (
              <span>
                Omsetning:{" "}
                {new Intl.NumberFormat("nb-NO", {
                  style: "currency",
                  currency: "NOK",
                  maximumFractionDigits: 0,
                }).format(Number(detail.revenue_total))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Precondition warnings */}
      {blockingDeviations.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-destructive text-sm font-medium">
              {blockingDeviations.length} blokkerende avvik ma loses for godkjenning
            </p>
          </CardContent>
        </Card>
      )}
      {pendingShifts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {pendingShifts.length} vakter venter pa godkjenning
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Omsetning</TabsTrigger>
          <TabsTrigger value="shifts">
            Vakter
            {pendingShifts.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px]">
                {pendingShifts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deviations">
            Avvik
            {deviations.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[10px]">
                {deviations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <RevenueSection
            revenueTotal={detail.revenue_total ? Number(detail.revenue_total) : null}
            revenueCard={detail.revenue_card ? Number(detail.revenue_card) : null}
            revenueCash={detail.revenue_cash ? Number(detail.revenue_cash) : null}
            revenueVat={detail.revenue_vat ? Number(detail.revenue_vat) : null}
            revenueTransactions={detail.revenue_transactions}
            revenueSource={detail.revenue_source}
            images={images}
          />
        </TabsContent>

        <TabsContent value="shifts" className="mt-4">
          <ShiftApprovalSection approvals={shiftApprovals} profileId={profileId} />
        </TabsContent>

        <TabsContent value="deviations" className="mt-4">
          <DeviationSection deviations={deviations} profileId={profileId} />
        </TabsContent>
      </Tabs>

      {/* Approval actions */}
      {detail.status === "awaiting_approval" && (
        <Card>
          <CardContent className="p-4">
            {showRejectForm ? (
              <div className="space-y-3">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Begrunnelse for avvisning..."
                  rows={3}
                  className="bg-background w-full rounded border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || rejectMutation.isPending}
                  >
                    {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Avvis
                  </Button>
                  <Button variant="ghost" onClick={() => setShowRejectForm(false)}>
                    Avbryt
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Notater (valgfritt)..."
                  rows={2}
                  className="bg-background mb-3 w-full rounded border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={!canApprove || approveMutation.isPending}
                  >
                    {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Godkjenn dagen
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectForm(true)}>
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Avvis
                  </Button>
                  <Button variant="ghost">
                    <MessageSquare className="mr-1.5 h-4 w-4" />
                    Be om avklaring
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Already approved */}
      {detail.status === "approved" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">Dagen er godkjent</p>
              {detail.approval_notes && (
                <p className="text-muted-foreground text-xs">{detail.approval_notes}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
