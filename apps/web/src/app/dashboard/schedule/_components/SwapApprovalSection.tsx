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

import {
  useSwapRequests,
  useApproveSwap,
  useRespondToSwap,
  type SwapRequest,
} from "../_hooks/use-shift-swap";

// ── Status badge config ─────────────────────────────────────────────────────
// Uses semantic color tokens per Nordic Split spec

const STATUS_CONFIG = {
  pending_recipient: {
    label: "Venter på kollega",
    Icon: Clock,
    className: "border-warning text-warning",
  },
  pending_manager: {
    label: "Venter på godkjenning",
    Icon: UserCheck,
    className: "border-info text-info",
  },
  approved: {
    label: "Godkjent",
    Icon: CheckCircle,
    className: "border-success text-success",
  },
  rejected: {
    label: "Avvist",
    Icon: XCircle,
    className: "border-destructive text-destructive",
  },
} as const;

function SwapStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return null;

  const { label, Icon, className } = config;
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
            <span className="text-sm font-medium">Skiftbytte</span>
            <SwapStatusBadge status={ctx.status} />
          </div>
          <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">Forslagsstiller:</span>{" "}
              {ctx.requester_profile_id.slice(0, 8)}...
            </div>
            <div>
              <span className="font-medium">Mottaker:</span> {ctx.target_profile_id.slice(0, 8)}...
            </div>
          </div>
          {ctx.reason && (
            <p className="text-muted-foreground text-xs italic">&ldquo;{ctx.reason}&rdquo;</p>
          )}
          {ctx.validation_result?.tariff_delta !== undefined && (
            <p className="text-muted-foreground text-xs">
              Kostnadsendring: {ctx.validation_result.tariff_delta} kr/t
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {canApprove && (
            <>
              <Button size="sm" variant="outline" onClick={handleApprove}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                Godkjenn
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => setShowRejectInput(!showRejectInput)}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Avvis
              </Button>
            </>
          )}
          {canRespond && (
            <>
              <Button size="sm" variant="outline" onClick={handleAccept}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                Aksepter
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => setShowRejectInput(!showRejectInput)}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Avvis
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="mt-2 flex gap-2">
          <Textarea
            placeholder="Begrunnelse (valgfri)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={1}
            className="text-sm"
          />
          <Button size="sm" variant="destructive" onClick={handleReject}>
            Bekreft avvisning
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
          Ventende bytter ({activeSwaps.length})
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
