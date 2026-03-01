// ============================================
// variant-list.tsx
// Client component for the landing variant list page.
// Renders a DataTable of all landing_variant rows with
// an actions dropdown for each row (Edit, Duplicate,
// Set as Default, Archive).
//
// Connected to: variant-columns.tsx (column definitions)
//               platform-admin/landing/variants/page.tsx (server data)
// ============================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, Pencil, Copy, Star, Archive, Layers } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/platform-admin/data-table";
import { variantColumns, type VariantRow } from "./variant-columns";

type VariantListProps = {
  variants: VariantRow[];
};

export function VariantList({ variants: initialVariants }: VariantListProps) {
  const [variants] = useState(initialVariants);

  // Combine base columns with the actions column
  const columnsWithActions = [
    ...variantColumns,
    {
      id: "actions" as const,
      cell: ({ row }: { row: { original: VariantRow } }) => {
        const variant = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/platform-admin/landing/variants/${variant.id}`}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  toast.info("Duplicate is not yet implemented");
                }}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!variant.is_default && (
                <DropdownMenuItem
                  onClick={() => {
                    toast.info("Set as default is not yet implemented");
                  }}
                >
                  <Star className="h-4 w-4" />
                  Set as Default
                </DropdownMenuItem>
              )}
              {variant.status !== "archived" && (
                <DropdownMenuItem
                  onClick={() => {
                    toast.info("Archive is not yet implemented");
                  }}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Layers className="h-3.5 w-3.5" />
          {variants.length} variants
        </div>
        <Button asChild size="sm">
          <Link href="/platform-admin/landing/variants/new">
            <Plus className="h-4 w-4" />
            Ny variant
          </Link>
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columnsWithActions} data={variants} />
    </div>
  );
}
