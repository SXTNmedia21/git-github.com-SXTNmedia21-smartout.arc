"use client";

/**
 * SwapApprovalSection — shows pending shift swap requests in the schedule view.
 *
 * Managers see swaps awaiting their approval (status = pending_manager).
 * Employees see their own pending swap requests.
 * Renders as a collapsible strip below the proposal banner.
 *
 * Connected to: use-shift-swap.ts (queries + mutations)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";

import {
  useSwapRequests,
  useApproveSwap,
  useRespondToSwap,
  type SwapRequest,
} from "../_hooks/use-shift-swap";

// ── Status badge config ─────────────────────────────────────────────────────
// Uses semantic color tokens per Nordic Split spec

const STATUS_STYLE = {
  pending_recipient: { Icon: Clock, className: "border-warning text-warning" },
  pending_manager: { Icon: UserCheck, className: "border-info text-info" },
  approved: { Icon: CheckCircle, className: "border-success text-success" },
  rejected: { Icon: XCircle, className: "border-destructive text-destructive" },
} as const;

/** Maps swap status to the corresponding i18n key */
const STATUS_I18N_KEY: Record<string, string> = {
  pending_recipient: "swap.pendingRecipient",
  pending_manager: "swap.pendingManager",
  approved: "swap.approved",
  rejected: "swap.rejected",
};

function SwapStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status as keyof typeof STATUS_STYLE];
  const { t } = useTranslation("swap");
  if (!style) return null;

  const { Icon, className } = style;
  const label = t(STATUS_I18N_KEY[status] ?? status);
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ── Swap Card ───────────────────────────────────────────────────────────────

function SwapCard({ swap, isManager }: { swap: SwapRequest; isManager: boolean }) {
  const approveSwap = useApproveSwap();
  const respondToSwap = useRespondToSwap();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const { t } = useTranslation("swap");

  const ctx = swap.context;
  const canApprove = isManager && ctx.status === "pending_manager";
  const canRespond = !isManager && ctx.status === "pending_recipient";

  function handleApprove() {
    approveSwap.mutate({ swapId: swap.id, approved: true });
  }

  function handleReject() {
    if (canApprove) {
      approveSwap.mutate({
        swapId: swap.id,
        approved: false,
        reason: rejectReason || undefined,
      });
    } else if (canRespond) {
      respondToSwap.mutate({
        swapId: swap.id,
        accepted: false,
        reason: rejectReason || undefined,
      });
    }
    setShowRejectInput(false);
    setRejectReason("");
  }

  function handleAccept() {
    respondToSwap.mutate({ swapId: swap.id, accepted: true });
  }

  return (
    <div className="border-border bg-background/80 rounded-lg border p-3 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">{t("swap.shiftSwap")}</span>
            <SwapStatusBadge status={ctx.status} />
          </div>
          <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">{t("swap.requester")}</span>{" "}
              {ctx.requester_profile_id.slice(0, 8)}...
            </div>
            <div>
              <span className="font-medium">{t("swap.recipient")}</span>{" "}
              {ctx.target_profile_id.slice(0, 8)}...
            </div>
          </div>
          {ctx.reason && (
            <p className="text-muted-foreground text-xs italic">&ldquo;{ctx.reason}&rdquo;</p>
          )}
          {ctx.validation_result?.tariff_delta !== undefined && (
            <p className="text-muted-foreground text-xs">
              {t("swap.tariffDelta", { amount: String(ctx.validation_result.tariff_delta) })}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {canApprove && (
            <>
              <Button size="sm" variant="outline" onClick={handleApprove}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                {t("swap.approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => setShowRejectInput(!showRejectInput)}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                {t("swap.reject")}
              </Button>
            </>
          )}
          {canRespond && (
            <>
              <Button size="sm" variant="outline" onClick={handleAccept}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                {t("swap.accept")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => setShowRejectInput(!showRejectInput)}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                {t("swap.reject")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="mt-2 flex gap-2">
          <Textarea
            placeholder={t("swap.reason")}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={1}
            className="text-sm"
          />
          <Button size="sm" variant="destructive" onClick={handleReject}>
            {t("swap.confirmRejection")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────────────────

export function SwapApprovalSection({ isAdmin }: { isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const { data: swaps, isLoading } = useSwapRequests();
  const { t } = useTranslation("swap");

  // Filter to only show actionable swaps
  const activeSwaps = (swaps ?? []).filter(
    (s) => s.context.status === "pending_recipient" || s.context.status === "pending_manager",
  );

  if (isLoading || activeSwaps.length === 0) return null;

  return (
    <div className="border-border border-b px-4 py-2">
      <button
        className="flex w-full items-center justify-between text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          {t("swap.pendingSwaps")} ({activeSwaps.length})
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {activeSwaps.map((swap) => (
            <SwapCard key={swap.id} swap={swap} isManager={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
