import { Suspense } from "react";
import { PayrollPeriodsClient } from "./_components/PayrollPeriodsClient";

/**
 * /dashboard/payroll — Manager payroll period list.
 *
 * Server Component shell — single Suspense boundary per ADR-0115.
 * Data is fetched client-side via usePayrollPeriods (workspace-scoped).
 *
 * Access: admin / manager only (enforced server-side via resolvePayrollAuth
 * in the BFF routes; UI shows all periods without role check since managers
 * must see them to drill down).
 *
 * ADR-0133: authoring surfaces are web-only. Mobile reads lønnsgrunnlag via
 * /dashboard/my-salary — this manager view is never built for mobile.
 */
export default function PayrollPage() {
  return (
    <Suspense fallback={<PayrollPeriodsSkeleton />}>
      <PayrollPeriodsClient />
    </Suspense>
  );
}

function PayrollPeriodsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
