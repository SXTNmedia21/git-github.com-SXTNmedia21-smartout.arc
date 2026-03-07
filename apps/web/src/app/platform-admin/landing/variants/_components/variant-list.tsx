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
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Pencil, Copy, Star, Archive, Layers, Loader2 } from "lucide-react";
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
import {
  archiveLandingVariant,
  duplicateLandingVariant,
  setLandingVariantAsDefault,
} from "../actions";

type VariantListProps = {
  variants: VariantRow[];
};

export function VariantList({ variants: initialVariants }: VariantListProps) {
  const router = useRouter();
  const [variants, setVariants] = useState(initialVariants);
  const [pendingAction, setPendingAction] = useState<{
    variantId: string;
    action: "duplicate" | "default" | "archive";
  } | null>(null);

  function actionBusy(variantId: string, action: "duplicate" | "default" | "archive"): boolean {
    return pendingAction?.variantId === variantId && pendingAction.action === action;
  }

  async function handleDuplicate(variantId: string) {
    setPendingAction({ variantId, action: "duplicate" });
    const result = await duplicateLandingVariant(variantId);

    if (!result.ok) {
      toast.error("Failed to duplicate variant", { description: result.error });
      setPendingAction(null);
      return;
    }

    if (result.variant) {
      setVariants((prev) =>
        [...prev, result.variant as VariantRow].sort((a, b) => a.sort_order - b.sort_order),
      );
    }
    toast.success(result.message);
    setPendingAction(null);
    router.refresh();
  }

  async function handleSetDefault(variantId: string) {
    setPendingAction({ variantId, action: "default" });
    const result = await setLandingVariantAsDefault(variantId);

    if (!result.ok) {
      toast.error("Failed to set default variant", { description: result.error });
      setPendingAction(null);
      return;
    }

    setVariants((prev) =>
      prev.map((variant) => ({ ...variant, is_default: variant.id === variantId })),
    );
    toast.success(result.message);
    setPendingAction(null);
    router.refresh();
  }

  async function handleArchive(variantId: string) {
    setPendingAction({ variantId, action: "archive" });
    const result = await archiveLandingVariant(variantId);

    if (!result.ok) {
      toast.error("Failed to archive variant", { description: result.error });
      setPendingAction(null);
      return;
    }

    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId ? { ...variant, status: "archived" } : variant,
      ),
    );
    toast.success(result.message);
    setPendingAction(null);
    router.refresh();
  }

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
                disabled={actionBusy(variant.id, "duplicate")}
                onClick={() => {
                  void handleDuplicate(variant.id);
                }}
              >
                {actionBusy(variant.id, "duplicate") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!variant.is_default && (
                <DropdownMenuItem
                  disabled={actionBusy(variant.id, "default")}
                  onClick={() => {
                    void handleSetDefault(variant.id);
                  }}
                >
                  {actionBusy(variant.id, "default") ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                  Set as Default
                </DropdownMenuItem>
              )}
              {variant.status !== "archived" && (
                <DropdownMenuItem
                  disabled={actionBusy(variant.id, "archive")}
                  onClick={() => {
                    void handleArchive(variant.id);
                  }}
                >
                  {actionBusy(variant.id, "archive") ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
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
