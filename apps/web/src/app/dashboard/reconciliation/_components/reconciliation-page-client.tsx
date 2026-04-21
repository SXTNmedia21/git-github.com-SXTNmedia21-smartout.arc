/**
 * ReconciliationPageClient — client boundary for /dashboard/reconciliation.
 *
 * Per ADR-0115 RSC migration pattern: the route's `page.tsx` is a Server
 * Component that wraps this single client boundary in `<Suspense>`.
 *
 * Layout model (daily-operation recon-v2 — designbundle Avstemming.html):
 *   Mode 1 (no selection): DayList full-width — uke-oversikt with filter-chips,
 *     counters, CSV export. User clicks a row → enters detail mode.
 *   Mode 2 (selection): DayDetail full-width — 1fr + 380px sticky approve panel
 *     internally; 6 tabs in content lane. Back button returns to list.
 */

"use client";

import { useState } from "react";
import { DayList } from "./DayList";
import { DayDetail } from "./DayDetail";
import { useReconciliationList } from "../_hooks/useReconciliation";

type ReconciliationRow = {
  reconciliation_id: string;
  reconciliation_date: string;
  status: string;
  revenue_total: number | null;
  total_actual_hours: number | null;
  total_labor_cost: number | null;
  labor_percentage: number | null;
  locked_at?: string | null;
  department_session: {
    department: { name: string };
  } | null;
};

export function ReconciliationPageClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: reconciliations } = useReconciliationList();

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {selectedId ? (
        <DayDetail reconciliationId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <DayList
          reconciliations={(reconciliations ?? []) as ReconciliationRow[]}
          selectedId={null}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}
