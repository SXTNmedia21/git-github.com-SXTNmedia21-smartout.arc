"use client";

import { useState } from "react";
import { DayList } from "./DayList";
import { DayApproval } from "./DayApproval";
import { useReconciliationList } from "../_hooks/useReconciliation";

export function ReconciliationDashboard() {
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
