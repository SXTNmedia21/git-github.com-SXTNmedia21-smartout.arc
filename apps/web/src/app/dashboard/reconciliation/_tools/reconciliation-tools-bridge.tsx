"use client";

/**
 * reconciliation-tools-bridge.tsx — registers Botsson tools for /dashboard/reconciliation.
 *
 * Hosted inside ReconciliationPageClient so it captures live state:
 * selected reconciliation id, loaded rows, and the selectId UI action.
 * Returns null. Tools are unregistered automatically on unmount (route change).
 *
 * ADR-0238: this page has no in-page chat surface — owns_chat_surface: false.
 * No <DomainChatOwnership> needed.
 *
 * Write tools (lockReconciliation, revertReconciliation, confirmHours) are deferred:
 * those mutations require DashboardContext + toast feedback wired in DayDetail.
 * Documented in .claude/page-polish/dashboard-reconciliation.run.yml write_tool_debt.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useReconciliationTools, type ReconciliationToolInput } from "./use-reconciliation-tools";

export function ReconciliationToolsBridge(props: ReconciliationToolInput) {
  const tools = useReconciliationTools(props);
  useRegisterTools("reconciliation", tools);
  return null;
}
