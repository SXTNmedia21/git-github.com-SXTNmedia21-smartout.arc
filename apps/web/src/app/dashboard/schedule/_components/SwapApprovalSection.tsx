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

import { useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  X,
  Clock,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

import {
  useSwapRequests,
  useApproveSwap,
  useRespondToSwap,
  useCancelSwap,
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

function SwapCard({
  swap,
  isManager,
  profileNames,
  currentProfileId,
}: {
  swap: SwapRequest;
  isManager: boolean;
  profileNames: Map<string, string>;
  currentProfileId: string | null;
}) {
  const approveSwap = useApproveSwap();
  const respondToSwap = useRespondToSwap();
  const cancelSwap = useCancelSwap();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const { t } = useTranslation("swap");

  const ctx = swap.context;
  const canApprove = isManager && ctx.status === "pending_manager";
  const canRespond = !isManager && ctx.status === "pending_recipient";
  const canCancel =
    currentProfileId === ctx.requester_profile_id &&
    (ctx.status === "pending_recipient" || ctx.status === "pending_manager");

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
              {profileNames.get(ctx.requester_profile_id) ?? t("swap.unknownProfile")}
            </div>
            <div>
              <span className="font-medium">{t("swap.recipient")}</span>{" "}
              {profileNames.get(ctx.target_profile_id) ?? t("swap.unknownProfile")}
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
          {canCancel && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={cancelSwap.isPending}
              onClick={() => cancelSwap.mutate(swap.id)}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Kanseller
            </Button>
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
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("swap");

  // Filter to only show actionable swaps
  const activeSwaps = (swaps ?? []).filter(
    (s) => s.context.status === "pending_recipient" || s.context.status === "pending_manager",
  );

  // Collect unique profile IDs from all active swaps for name resolution
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    for (const swap of activeSwaps) {
      ids.add(swap.context.requester_profile_id);
      ids.add(swap.context.target_profile_id);
    }
    return [...ids];
  }, [activeSwaps]);

  // Resolve profile IDs to display names
  const { data: profileNames } = useQuery({
    queryKey: ["profiles", "display-names", profileIds],
    enabled: profileIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .in("profile_id", profileIds);

      const map = new Map<string, string>();
      for (const p of data ?? []) {
        map.set(p.profile_id, p.display_name ?? t("swap.unknownProfile"));
      }
      return map;
    },
  });

  if (isLoading || activeSwaps.length === 0) return null;

  const resolvedNames = profileNames ?? new Map<string, string>();

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
            <SwapCard
              key={swap.id}
              swap={swap}
              isManager={isAdmin}
              profileNames={resolvedNames}
              currentProfileId={profileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
