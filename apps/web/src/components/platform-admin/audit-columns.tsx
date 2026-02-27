"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  admin: {
    first_name: string;
    last_name: string;
  } | null;
};

const entityColors: Record<string, string> = {
  workspace: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  subscription: "bg-green-500/10 text-green-400 border-green-500/20",
  contract: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  user: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  config: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export const auditColumns: ColumnDef<AuditRow>[] = [
  {
    accessorKey: "created_at",
    header: "Timestamp",
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleString("no-NO", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
  },
  {
    accessorFn: (row) => (row.admin ? `${row.admin.first_name} ${row.admin.last_name}` : "System"),
    id: "admin",
    header: "Admin",
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
  },
  {
    accessorKey: "entity_type",
    header: "Entity",
    cell: ({ getValue }) => {
      const type = getValue() as string;
      return (
        <Badge variant="outline" className={`text-xs capitalize ${entityColors[type] || ""}`}>
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "entity_id",
    header: "Entity ID",
    cell: ({ getValue }) => {
      const id = getValue() as string | null;
      return id ? (
        <span className="text-muted-foreground font-mono text-xs">{id.slice(0, 8)}...</span>
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      );
    },
  },
];
