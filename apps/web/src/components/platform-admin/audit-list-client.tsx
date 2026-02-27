"use client";

import { DataTable } from "./data-table";
import { auditColumns, type AuditRow } from "./audit-columns";

export function AuditListClient({ data }: { data: AuditRow[] }) {
  return <DataTable columns={auditColumns} data={data} />;
}
