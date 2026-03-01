// ============================================
// variant-columns.tsx
// TanStack Table column definitions for the landing_variant table.
// Used by the variant list page to display all landing page variants
// with status, default flag, and action menu.
//
// Connected to: variant-list.tsx (table render)
//               platform-admin/landing/variants/page.tsx (data fetch)
// ============================================

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform-admin/status-badge";

/** Shape of a landing variant row as returned from Supabase. */
export type VariantRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export const variantColumns: ColumnDef<VariantRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">{row.original.slug}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
  },
  {
    accessorKey: "is_default",
    header: "Default",
    cell: ({ row }) =>
      row.original.is_default ? (
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Created
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">{formatDate(row.original.created_at)}</span>
    ),
  },
];
