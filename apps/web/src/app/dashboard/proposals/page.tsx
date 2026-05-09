import { Suspense } from "react";
import { ProposalsListClient } from "./_components/ProposalsListClient";

/**
 * /dashboard/proposals — Admin inbox for pending wage_line_override proposals (T5.1).
 *
 * Server Component shell — single Suspense boundary per ADR-0115.
 * Data fetched client-side via usePayrollProposals (TanStack Query, 30-second polling).
 *
 * Access: admin only. BFF enforces role on all mutations.
 * ADR-0133: web-only authoring surface (mobile executes, not approves).
 */
export default function ProposalsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl">Override-innboks</h1>
        <p className="text-muted-foreground text-sm">
          Ventende lønns-override forslag fra ledere som krever godkjenning.
        </p>
      </div>

      <Suspense fallback={<ProposalsListSkeleton />}>
        <ProposalsListClient />
      </Suspense>
    </div>
  );
}

function ProposalsListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
