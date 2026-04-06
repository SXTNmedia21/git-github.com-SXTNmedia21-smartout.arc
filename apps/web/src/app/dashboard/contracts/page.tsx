"use client";

/**
 * ContractsPage — /dashboard/contracts
 *
 * Reads workspace context from DashboardShell and renders the contracts DataTable.
 * Workspace ID is required — renders nothing while context is loading.
 */

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ContractsDataTable } from "./_components/contracts-data-table";

export default function ContractsPage() {
  const { workspaceData } = useContext(DashboardContext);

  if (!workspaceData?.workspace_id) return null;

  return <ContractsDataTable workspaceId={workspaceData.workspace_id} />;
}
