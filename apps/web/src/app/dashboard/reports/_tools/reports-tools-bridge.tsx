"use client";

/**
 * reports-tools-bridge.tsx — registers Botsson tools for /dashboard/reports.
 *
 * Hosted INSIDE ReportsPageShell so it captures live state:
 *   - active tab
 *   - pre-loaded hook data (overview / people / staffing / training)
 *   - saved reports count
 *   - UI action refs (setActiveTab, openAiDrawer)
 *
 * Returns null. Tools are unregistered automatically on unmount (route change).
 * ADR-0238: owns_chat_surface=false — this page does NOT declare chat ownership.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useReportsTools, type ReportsToolInput } from "./use-reports-tools";

export function ReportsToolsBridge(props: ReportsToolInput) {
  const tools = useReportsTools(props);
  useRegisterTools("reports", tools);
  return null;
}
