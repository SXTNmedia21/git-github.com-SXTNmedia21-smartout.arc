"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export type WorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  company: {
    company_id: string;
    name: string;
    org_number: string;
    subscription_plan: string | null;
    subscription_status: string | null;
  } | null;
};

const statusVariant: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  past_due: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  paused: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const workspaceColumns: ColumnDef<WorkspaceRow>[] = [
  {
    accessorKey: "name",
    header: "Workspace",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorFn: (row) => row.company?.name,
    id: "company",
    header: "Company",
  },
  {
    accessorFn: (row) => row.company?.org_number,
    id: "org_number",
    header: "Org.nr",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground font-mono text-xs">{getValue() as string}</span>
    ),
  },
  {
    accessorFn: (row) => row.company?.subscription_plan || "—",
    id: "plan",
    header: "Plan",
    cell: ({ getValue }) => {
      const plan = getValue() as string;
      return plan !== "—" ? (
        <Badge variant="outline" className="text-xs capitalize">
          {plan}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorFn: (row) => row.company?.subscription_status || "unknown",
    id: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      return (
        <Badge
          variant="outline"
          className={`text-xs capitalize ${statusVariant[status] || statusVariant.paused}`}
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("no-NO"),
  },
];
