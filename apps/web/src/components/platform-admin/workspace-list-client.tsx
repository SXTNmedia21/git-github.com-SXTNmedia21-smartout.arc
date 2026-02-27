"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";
import { workspaceColumns, type WorkspaceRow } from "./workspace-columns";

export function WorkspaceListClient({ data }: { data: WorkspaceRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={workspaceColumns}
      data={data}
      onRowClick={(row) => router.push(`/platform-admin/workspaces/${row.workspace_id}`)}
    />
  );
}
