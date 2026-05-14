"use client";

/**
 * my-salary-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/my-salary surface.
 *
 * Why a bridge:
 *  - Keeps the page client component clean from voice-tool registration.
 *  - Mounts only when data is ready (payslips array + salaryData resolved).
 *    Prevents tools returning empty state before the first fetch completes.
 *
 * Data sourcing:
 *  - Receives live payslips, salaryData, and selectedPeriodId from the page
 *    via props. No duplicate fetch — reuses the existing useMySalary result.
 *
 * ADR-0238: /my-salary does not own a domain chat surface — no DomainChatOwnership needed.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useMySalaryTools } from "./use-my-salary-tools";
import type { MySalaryData, PayslipEntry } from "../_hooks/use-my-salary";

type MySalaryToolsBridgeProps = {
  payslips: PayslipEntry[];
  salaryData: MySalaryData | undefined;
  selectedPeriodId: string | null;
  setSelectedPeriodId: (id: string) => void;
};

export function MySalaryToolsBridge({
  payslips,
  salaryData,
  selectedPeriodId,
  setSelectedPeriodId,
}: MySalaryToolsBridgeProps) {
  const tools = useMySalaryTools({
    payslips,
    salaryData,
    selectedPeriodId,
    setSelectedPeriodId,
  });

  useRegisterTools("my-salary", tools);

  return null;
}
