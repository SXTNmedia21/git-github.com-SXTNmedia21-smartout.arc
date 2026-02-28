"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Mail, Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";

export type WorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string | null;
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

const columns: ColumnDef<WorkspaceRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: "Workspace",
    cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
  },
  {
    id: "company",
    header: "Company",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.company?.name ?? "\u2014"}</span>
    ),
  },
  {
    id: "plan",
    header: "Plan",
    cell: ({ row }) => (
      <span className="capitalize">{row.original.company?.subscription_plan ?? "\u2014"}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.company?.subscription_status ?? "unknown"} size="sm" />
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {new Date(row.getValue("created_at") as string).toLocaleDateString("no-NO")}
      </span>
    ),
  },
];

export function WorkspaceListEnhanced({ data }: { data: WorkspaceRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = data;
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) || (r.company?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (planFilter !== "all")
      result = result.filter((r) => r.company?.subscription_plan === planFilter);
    if (statusFilter !== "all")
      result = result.filter((r) => r.company?.subscription_status === statusFilter);
    return result;
  }, [data, globalFilter, planFilter, statusFilter]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
    initialState: { pagination: { pageSize: 20 } },
    getRowId: (row) => row.workspace_id,
  });

  const selectedIds = Object.keys(rowSelection);
  const selectedCount = selectedIds.length;

  function exportCsv() {
    const selected = filtered.filter((w) => rowSelection[w.workspace_id]);
    const rows = selected.map((w) =>
      [
        w.name,
        w.company?.name ?? "",
        w.company?.subscription_plan ?? "",
        w.company?.subscription_status ?? "",
        new Date(w.created_at).toLocaleDateString("no-NO"),
      ].join(","),
    );
    const csv = ["Workspace,Company,Plan,Status,Created", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspaces.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search workspaces..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="bg-muted/50 flex items-center gap-3 rounded-md border p-2">
          <span className="text-muted-foreground text-sm">{selectedCount} selected</span>
          <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
            <Mail className="mr-1 h-3 w-3" /> Email Selected
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-3 w-3" /> Export CSV
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border-border rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-xs font-medium tracking-wider uppercase">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/platform-admin/workspaces/${row.original.workspace_id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{filtered.length} workspaces</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ComposeEmailSheet open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}
