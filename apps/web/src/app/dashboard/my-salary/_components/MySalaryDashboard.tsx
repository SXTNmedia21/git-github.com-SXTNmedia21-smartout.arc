/**
 * MySalaryDashboard — main layout for the Min Lønn page.
 *
 * Three-column layout on desktop:
 *   Left (w-72):  PeriodList — settled payslip periods
 *   Center (flex-1): PayslipDetail — hero + breakdown for selected period
 *   Right (w-72): BalancesSidebar — absence quotas + timebank
 *
 * On smaller screens the columns stack vertically: detail → periods → balances.
 *
 * All data is fetched once via useMySalary. Payslip line items load lazily
 * inside PayslipDetail when a calculation ID becomes available.
 */

"use client";

import { useState, useMemo } from "react";
import { useMySalary } from "../_hooks/use-my-salary";
import { PeriodList } from "./PeriodList";
import { PayslipDetail } from "./PayslipDetail";
import { BalancesSidebar } from "./BalancesSidebar";

// UI Events:
// - action: setSelectedPeriodId(id) — period row click triggers detail refresh
// - color-regime: emerald for paid/positive, amber for warning, red for depleted balances

export function MySalaryDashboard() {
  const { data, isLoading } = useMySalary();

  const payslips = data?.payslips ?? [];

  /** Selected period defaults to the most recent settled payslip */
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const activePeriodId = selectedPeriodId ?? payslips[0]?.period.id ?? null;

  const activePayslip = useMemo(
    () => payslips.find((p) => p.period.id === activePeriodId) ?? null,
    [payslips, activePeriodId],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      {/* Left: period list — fixed width, full height */}
      <div className="order-2 w-full shrink-0 lg:order-1 lg:w-72">
        <PeriodList
          payslips={payslips}
          selectedPeriodId={activePeriodId}
          onSelect={setSelectedPeriodId}
          isLoading={isLoading}
        />
      </div>

      {/* Center: payslip detail — expands to fill available space */}
      <div className="order-1 min-h-0 flex-1 lg:order-2">
        <PayslipDetail payslip={activePayslip} isLoading={isLoading} />
      </div>

      {/* Right: absence + timebank balances — fixed width */}
      <div className="order-3 w-full shrink-0 lg:w-72">
        <BalancesSidebar data={data} isLoading={isLoading} />
      </div>
    </div>
  );
}
