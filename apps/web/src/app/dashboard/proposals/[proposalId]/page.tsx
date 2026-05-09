import { Suspense } from "react";
import { ProposalDetailClient } from "../_components/ProposalDetailClient";

type Props = {
  params: Promise<{ proposalId: string }>;
};

/**
 * /dashboard/proposals/[proposalId] — Proposal detail + approve/reject (T5.2).
 *
 * Server Component shell — single Suspense boundary per ADR-0115.
 * Data fetched client-side via usePayrollProposal (TanStack Query).
 *
 * Approve action: calls /api/payroll/approve-proposal (BFF POST).
 * Reject action: calls /api/payroll/reject-proposal (BFF POST).
 *
 * ADR-0133: web-only admin review surface. Mobile does not author approvals.
 * ADR-0151: workspace identity is server-derived in BFF; never from URL params.
 */
export default async function ProposalDetailPage({ params }: Props) {
  const { proposalId } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Suspense fallback={<ProposalDetailSkeleton />}>
        <ProposalDetailClient proposalId={proposalId} />
      </Suspense>
    </div>
  );
}

function ProposalDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted h-8 w-48 animate-pulse rounded" />
      <div className="bg-muted h-48 animate-pulse rounded-lg" />
      <div className="bg-muted h-24 animate-pulse rounded-lg" />
    </div>
  );
}
