"use client";

/**
 * ProposalsListClient — inbox for pending wage_line_override proposals (T5.1).
 *
 * Displays a list of pending change_proposals with kind='wage_line_override'.
 * Each row shows: proposed_at (relative), proposer name, original → proposed
 * amount, delta, and reason snippet. Clicking routes to /dashboard/proposals/[id].
 *
 * Data is fetched via usePayrollProposals (30-second polling).
 * Admin-only action surface — BFF enforces role, UI renders for all but only
 * admins will reach this route (middleware / layout guards pending in T9.2 scope).
 *
 * Harness bridge: mounts <ProposalsToolsBridge> once data is ready so Botsson
 * can list, filter, and navigate proposals without query_smartout roundtrips.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { ArrowRight, ChevronRight, Clock, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/lib/workspace-context";
import { usePayrollProposals } from "../_hooks/use-payroll-proposals";
import type { ProposalListItem } from "../_hooks/use-payroll-proposals";
import { ProposalsToolsBridge } from "../_tools/proposals-tools-bridge";

type StatusFilter = "all" | "pending" | "applied" | "rejected";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNok(cents: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function deltaLabel(
  original: number | undefined,
  proposed: number | undefined,
): { text: string; positive: boolean } | null {
  if (original === undefined || proposed === undefined) return null;
  const delta = proposed - original;
  const pct = original !== 0 ? Math.round((delta / original) * 100) : 0;
  const sign = delta >= 0 ? "+" : "";
  return {
    text: `${sign}${formatNok(delta)} (${sign}${pct} %)`,
    positive: delta >= 0,
  };
}

function relativeTime(isoString: string): string {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true, locale: nb });
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ProposalRow({ item }: { item: ProposalListItem }) {
  const { changes } = item;
  const proposerName = item.profile?.display_name ?? "Ukjent";
  const delta = deltaLabel(changes.original_amount_cents, changes.proposed_amount_cents);

  return (
    <Link
      href={`/dashboard/proposals/${item.change_proposal_id}`}
      className="hover:bg-muted/40 group flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors"
    >
      <div className="min-w-0 flex-1">
        {/* Proposer + time */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{proposerName}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {relativeTime(item.created_at)}
          </span>
          <Badge variant="secondary" className="text-xs">
            Venter godkjenning
          </Badge>
        </div>

        {/* Amount diff */}
        {changes.original_amount_cents !== undefined &&
          changes.proposed_amount_cents !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {formatNok(changes.original_amount_cents)}
              </span>
              <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-foreground font-medium">
                {formatNok(changes.proposed_amount_cents)}
              </span>
              {delta && (
                <span
                  className={
                    delta.positive
                      ? "text-success text-xs font-medium"
                      : "text-destructive text-xs font-medium"
                  }
                >
                  {delta.text}
                </span>
              )}
            </div>
          )}

        {/* Reason snippet */}
        {changes.reason && (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            &ldquo;{changes.reason}&rdquo;
          </p>
        )}
      </div>

      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ─── Empty ───────────────────────────────────────────────────────────────────

function ProposalsEmpty() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="h-8 w-8 opacity-40" />
      <p className="text-sm">Ingen ventende override-forslag</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ProposalsListClient — renders the proposals inbox.
 *
 * Consumed by /dashboard/proposals/page.tsx (server shell + Suspense).
 * Mounts ProposalsToolsBridge once data is ready (non-null array) so Botsson
 * can query/filter/navigate proposals on this page.
 */
export function ProposalsListClient() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("pending");
  const {
    data: proposals,
    isLoading,
    isError,
    error,
  } = usePayrollProposals(workspace.workspace_id);

  function navigateToProposal(id: string) {
    router.push(`/dashboard/proposals/${id}`);
  }

  return (
    <>
      {/* Botsson harness — mount once proposals are loaded */}
      {proposals != null && (
        <ProposalsToolsBridge
          proposals={proposals}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          navigateToProposal={navigateToProposal}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Ventende lønns-overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ProposalsSkeleton />}

          {isError && (
            <div className="text-destructive py-4 text-sm">
              Kunne ikke laste forslag: {(error as Error).message}
            </div>
          )}

          {!isLoading && !isError && proposals && proposals.length === 0 && <ProposalsEmpty />}

          {!isLoading && !isError && proposals && proposals.length > 0 && (
            <div className="flex flex-col gap-2">
              {proposals.map((item) => (
                <ProposalRow key={item.change_proposal_id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
