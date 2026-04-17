import { Suspense } from "react";
import { ReconciliationPageClient } from "./_components/reconciliation-page-client";
import ReconciliationLoading from "./loading";

/**
 * /dashboard/reconciliation — Server Component shell.
 * Single Suspense boundary wrapping a single client boundary per ADR-0115.
 * Data is fetched client-side via `useReconciliationList`.
 */
export default function ReconciliationPage() {
  return (
    <Suspense fallback={<ReconciliationLoading />}>
      <ReconciliationPageClient />
    </Suspense>
  );
}
