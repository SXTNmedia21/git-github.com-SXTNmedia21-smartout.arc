/**
 * ReconciliationPageClient — client boundary for /dashboard/reconciliation.
 *
 * Per ADR-0115 RSC migration pattern: the route's `page.tsx` is a Server
 * Component that wraps this single client boundary in `<Suspense>`. All
 * interactive state + data fetching for the daily reconciliation surface
 * lives here.
 *
 * Two-panel layout:
 *   Left (w-80):  DayList — all reconciliations for the workspace
 *   Right (flex-1): DayApproval — detail + approval controls for selected day
 */

"use client";

import { useState } from "react";
import { DayList } from "./DayList";
import { DayApproval } from "./DayApproval";
import { useReconciliationList } from "../_hooks/useReconciliation";

export function ReconciliationPageClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: reconciliations, isLoading } = useReconciliationList();

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left panel: Day list */}
      <div className="w-80 shrink-0">
        <DayList
          reconciliations={
            (reconciliations ?? []) as Array<{
              reconciliation_id: string;
              reconciliation_date: string;
              status: string;
              revenue_total: number | null;
              department_session: {
                department: {
                  name: string;
                };
              };
            }>
          }
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right panel: Approval view */}
      <div className="flex-1 overflow-y-auto">
        {selectedId ? (
          <DayApproval reconciliationId={selectedId} />
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {isLoading ? "Laster..." : "Velg en dag fra listen for a se detaljer"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
