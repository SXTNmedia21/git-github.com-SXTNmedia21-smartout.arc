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

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { DayList } from "./DayList";
import { DayDetail } from "./DayDetail";
import { useReconciliationList } from "../_hooks/useReconciliation";
import { ReconciliationToolsBridge } from "../_tools/reconciliation-tools-bridge";

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
  const reduceMotion = useReducedMotion();

  // Bridge tool input — stable shape for Botsson harness tools.
  // rows are cast to the bridge's narrower shape (subset of full DB row).
  const bridgeInput = useMemo(
    () => ({
      selectedId,
      rows: (reconciliations ?? []) as ReconciliationRow[],
      uiActions: { selectId: setSelectedId },
    }),
    [selectedId, reconciliations],
  );

  const fade = reduceMotion
    ? {
        initial: false as const,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: motionTokens.exitMs / 2000 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: {
          duration: motionTokens.exitMs / 1000,
          ease: motionTokens.easingArray,
        },
      };

  const stateKey = selectedId ? "detail" : "list";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 pt-1 md:p-6 md:pt-3">
      {/* Ambient orb — low-intensity orange radial gradient, always-on for v1 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-56 -bottom-64 h-[720px] w-[720px] transition-[background] duration-500"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--brand-orange) 8%, transparent) 0%, transparent 65%)",
        }}
      />

      {/* Botsson harness — registers reconciliation tools while this route is mounted */}
      <ReconciliationToolsBridge {...bridgeInput} />

      <AnimatePresence mode="wait">
        {stateKey === "detail" && selectedId ? (
          <motion.div
            key="detail"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col"
          >
            <DayDetail reconciliationId={selectedId} onBack={() => setSelectedId(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col"
          >
            <DayList
              reconciliations={(reconciliations ?? []) as ReconciliationRow[]}
              selectedId={null}
              onSelect={setSelectedId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
