"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { cn } from "@/lib/utils";
import { type ApiEndpoint, apiRegistry, categoryLabels, serviceLabels } from "./api-registry";

const methodColors: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  POST: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  PUT: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  PATCH: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20",
  DELETE: "bg-red-500/15 text-red-500 border-red-500/20",
};

type FilterKey = "all" | ApiEndpoint["category"];
type ServiceFilterKey = "all" | ApiEndpoint["service"];

export function ApiRegistryTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterKey>("all");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilterKey>("all");
  const debouncedFilter = useDebounce(globalFilter, 300);

  const filteredData = useMemo(() => {
    let data = apiRegistry;
    if (categoryFilter !== "all") {
      data = data.filter((e) => e.category === categoryFilter);
    }
    if (serviceFilter !== "all") {
      data = data.filter((e) => e.service === serviceFilter);
    }
    return data;
  }, [categoryFilter, serviceFilter]);

  const columns = useMemo<ColumnDef<ApiEndpoint>[]>(
    () => [
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("font-mono text-[10px]", methodColors[row.original.method])}
          >
            {row.original.method}
          </Badge>
        ),
        size: 80,
      },
      {
        accessorKey: "path",
        header: "Path",
        cell: ({ row }) => <code className="text-xs">{row.original.path}</code>,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.description}</span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {categoryLabels[row.original.category]}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: "auth",
        header: "Auth",
        cell: ({ row }) => <StatusBadge status={row.original.auth} size="sm" />,
        size: 110,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
        size: 80,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const ep = row.original;
      return (
        ep.path.toLowerCase().includes(search) ||
        ep.description.toLowerCase().includes(search) ||
        ep.method.toLowerCase().includes(search)
      );
    },
    state: { sorting, globalFilter: debouncedFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const categories: FilterKey[] = [
    "all",
    "system",
    "dashboard",
    "platform-admin",
    "webhook",
    "edge-function",
    "contract-service",
  ];
  const services: ServiceFilterKey[] = ["all", "web", "contract-service", "supabase"];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search endpoints..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {cat === "all" ? "All" : categoryLabels[cat]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {services.map((svc) => (
            <button
              key={svc}
              onClick={() => setServiceFilter(svc)}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                serviceFilter === svc
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {svc === "all" ? "All Services" : serviceLabels[svc]}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {filteredData.length} endpoints
        </span>
      </div>

      {/* Table */}
      <div className="border-border rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-medium tracking-wider uppercase"
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  No endpoints found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
