import { Suspense } from "react";
import { PeriodDetailClient } from "./_components/PeriodDetailClient";

type Props = {
  params: Promise<{ periodId: string }>;
};

/**
 * /dashboard/payroll/[periodId] — Period detail page.
 *
 * Server Component shell — single Suspense boundary per ADR-0115.
 * Data is fetched client-side via usePayrollPeriod, usePayrollLines,
 * and usePayrollDeviations (workspace-scoped via RLS).
 *
 * ADR-0133: web-only manager authoring surface.
 * Mobile reads employee lønnsgrunnlag via /dashboard/my-salary.
 */
export default async function PeriodDetailPage({ params }: Props) {
  const { periodId } = await params;

  return (
    <Suspense fallback={<PeriodDetailSkeleton />}>
      <PeriodDetailClient periodId={periodId} />
    </Suspense>
  );
}

function PeriodDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="bg-muted h-8 w-48 animate-pulse rounded" />
      <div className="bg-muted h-4 w-64 animate-pulse rounded" />
      <div className="bg-muted mt-4 h-64 animate-pulse rounded-lg" />
    </div>
  );
}
