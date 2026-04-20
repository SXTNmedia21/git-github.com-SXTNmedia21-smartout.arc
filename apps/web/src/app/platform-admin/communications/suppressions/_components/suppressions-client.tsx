/**
 * Suppressions Client — Interactive table with search, filter, add, and delete.
 *
 * WHY: Platform admins need to inspect and manage suppressed emails
 * to unblock legitimate recipients or manually suppress problematic addresses.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Search, Plus, Trash2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/platform-admin/data-table";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";

type SuppressionRow = {
  suppression_id: string;
  email: string;
  reason: string;
  source: string | null;
  created_at: string | null;
};

type ReasonFilter = "all" | "bounce" | "unsubscribe" | "complaint" | "manual";

const REASON_BADGE_STYLES: Record<string, string> = {
  bounce: "bg-red-500/15 text-red-500 border-red-500/20",
  unsubscribe: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  complaint: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20",
  manual: "bg-blue-500/15 text-blue-500 border-blue-500/20",
};

const REASON_FILTERS: { value: ReasonFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bounce", label: "Bounce" },
  { value: "unsubscribe", label: "Unsubscribe" },
  { value: "complaint", label: "Complaint" },
  { value: "manual", label: "Manual" },
];

function ReasonBadge({ reason }: { reason: string }) {
  const style = REASON_BADGE_STYLES[reason] ?? "bg-secondary text-secondary-foreground";
  return (
    <Badge variant="outline" className={style}>
      {reason}
    </Badge>
  );
}

type SuppressionsClientProps = {
  initialData: SuppressionRow[];
  initialTotal: number;
};

export function SuppressionsClient({ initialData, initialTotal }: SuppressionsClientProps) {
  const [data, setData] = useState<SuppressionRow[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [loading, setLoading] = useState(false);

  // Add suppression dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<SuppressionRow | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async (q: string, reason: ReasonFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (q) params.set("q", q);
      if (reason !== "all") params.set("reason", reason);

      const res = await fetch(`/api/platform-admin/communications/suppressions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const json = await res.json();
      setData(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load suppressions");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when search or filter changes
  useEffect(() => {
    // Skip initial fetch — we already have server data
    if (debouncedSearch === "" && reasonFilter === "all") {
      setData(initialData);
      setTotal(initialTotal);
      return;
    }
    fetchData(debouncedSearch, reasonFilter);
  }, [debouncedSearch, reasonFilter, fetchData, initialData, initialTotal]);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;

    setAddLoading(true);
    try {
      const res = await fetch("/api/platform-admin/communications/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), reason: "manual" }),
      });

      if (res.status === 409) {
        toast.error("Email is already suppressed");
        return;
      }

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to add suppression");
        return;
      }

      toast.success(`Suppressed ${addEmail.trim()}`);
      setAddEmail("");
      setAddOpen(false);
      fetchData(debouncedSearch, reasonFilter);
    } catch {
      toast.error("Failed to add suppression");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch("/api/platform-admin/communications/suppressions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suppression_id: deleteTarget.suppression_id }),
      });

      if (!res.ok) {
        toast.error("Failed to remove suppression");
        return;
      }

      toast.success(`Removed suppression for ${deleteTarget.email}`);
      setDeleteTarget(null);
      fetchData(debouncedSearch, reasonFilter);
    } catch {
      toast.error("Failed to remove suppression");
    }
  };

  const columns: ColumnDef<SuppressionRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="font-mono text-sm">{row.original.email}</span>
          </div>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => <ReasonBadge reason={row.original.reason} />,
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{row.original.source ?? "-"}</span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Date Added",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.created_at
              ? new Date(row.original.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row.original);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      {/* Toolbar: search, filters, add button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1">
            {REASON_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={reasonFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setReasonFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add suppression
        </Button>
      </div>

      {/* Count */}
      <p className="text-muted-foreground text-sm">
        {total} suppressed email{total !== 1 ? "s" : ""}
        {loading ? " (loading...)" : ""}
      </p>

      {/* Table */}
      <DataTable columns={columns} data={data} />

      {/* Add suppression dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Email Suppression</DialogTitle>
            <DialogDescription>
              Manually suppress an email address. This address will not receive any platform
              communications until removed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              type="email"
              placeholder="user@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={addLoading || !addEmail.trim()}>
              {addLoading ? "Adding..." : "Add suppression"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove Suppression"
        description={`Are you sure you want to remove the suppression for ${deleteTarget?.email ?? ""}? This email will be able to receive platform communications again.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
