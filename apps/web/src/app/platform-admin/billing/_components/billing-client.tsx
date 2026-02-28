"use client";

import { useState, useMemo } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import {
  ArrowUpDown,
  Building2,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  MoreHorizontal,
  Mail,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

export type CompanyRow = {
  company_id: string;
  name: string;
  org_number: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

export type MrrDataPoint = {
  metric_date: string;
  metric_value: number;
};

type BillingClientProps = {
  companies: CompanyRow[];
  mrrData: MrrDataPoint[];
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleDateString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const ALL_STATUSES = "all";
const ALL_PLANS = "all";

export function BillingClient({ companies, mrrData }: BillingClientProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [planFilter, setPlanFilter] = useState(ALL_PLANS);

  // Email sheet state
  const [emailSheet, setEmailSheet] = useState<{
    open: boolean;
    audience?: AudienceFilter;
  }>({ open: false });

  // KPI calculations
  const active = companies.filter((c) => c.subscription_status === "active").length;
  const trial = companies.filter((c) => c.subscription_status === "trial").length;
  const pastDue = companies.filter((c) => c.subscription_status === "past_due").length;

  // MRR sparkline data for KPI card
  const mrrSparkline = mrrData.map((d) => d.metric_value);
  const latestMrr = mrrData.length > 0 ? mrrData[mrrData.length - 1]!.metric_value : 0;
  const previousMrr = mrrData.length > 1 ? mrrData[mrrData.length - 2]!.metric_value : 0;
  const mrrTrend =
    previousMrr > 0
      ? {
          value: Math.round(((latestMrr - previousMrr) / previousMrr) * 100),
          isPositive: latestMrr >= previousMrr,
        }
      : undefined;

  // Chart data for MRR trend
  const chartData = mrrData.map((d) => ({
    date: new Date(d.metric_date).toLocaleDateString("no-NO", {
      month: "short",
      day: "numeric",
    }),
    mrr: d.metric_value,
  }));

  // Unique plans for filter dropdown
  const uniquePlans = useMemo(() => {
    const plans = new Set<string>();
    for (const c of companies) {
      if (c.subscription_plan) plans.add(c.subscription_plan);
    }
    return Array.from(plans).sort();
  }, [companies]);

  // Filtered data
  const filteredCompanies = useMemo(() => {
    let result = companies;
    if (statusFilter !== ALL_STATUSES) {
      result = result.filter((c) => c.subscription_status === statusFilter);
    }
    if (planFilter !== ALL_PLANS) {
      result = result.filter((c) => c.subscription_plan === planFilter);
    }
    return result;
  }, [companies, statusFilter, planFilter]);

  function handleSendPaymentReminder(_company: CompanyRow) {
    setEmailSheet({
      open: true,
      // The compose sheet will handle audience resolution at the API layer
      audience: { type: "all_users" } as AudienceFilter,
    });
  }

  function handleEmailPastDue() {
    setStatusFilter("past_due");
    setEmailSheet({
      open: true,
      audience: { type: "status", status: "active" } as AudienceFilter,
    });
  }

  const columns = useMemo<ColumnDef<CompanyRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Company
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "org_number",
        header: "Org.nr",
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs">
            {row.original.org_number || "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "subscription_plan",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Plan
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="capitalize">{row.original.subscription_plan || "\u2014"}</span>
        ),
      },
      {
        accessorKey: "subscription_status",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <StatusBadge status={row.original.subscription_status || "unknown"} size="sm" />
        ),
      },
      {
        accessorKey: "trial_ends_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Trial Ends
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.trial_ends_at)}
          </span>
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
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const company = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSendPaymentReminder(company)}>
                  <Mail className="h-4 w-4" />
                  Send Payment Reminder
                </DropdownMenuItem>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem disabled>
                        <ExternalLink className="h-4 w-4" />
                        View in Stripe
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent side="left">Stripe integration coming</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredCompanies,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  return (
    <>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Active" value={active} icon={Building2} />
          <KpiCard label="Trial" value={trial} icon={CreditCard} />
          <KpiCard label="Past Due" value={pastDue} icon={AlertTriangle} danger={pastDue > 0} />
          <KpiCard
            label="MRR"
            value={latestMrr > 0 ? `${latestMrr.toLocaleString("no-NO")} kr` : "\u2014"}
            icon={TrendingUp}
            trend={mrrTrend}
            sparklineData={mrrSparkline.length > 1 ? mrrSparkline : undefined}
          />
        </div>

        {/* MRR Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MRR Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      stroke="hsl(var(--border))"
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        color: "hsl(var(--popover-foreground))",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`${value.toLocaleString("no-NO")} kr`, "MRR"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="mrr"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
                No MRR data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filter bar + table */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PLANS}>All Plans</SelectItem>
                {uniquePlans.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {pastDue > 0 && (
              <Button variant="outline" size="sm" onClick={handleEmailPastDue}>
                <Mail className="h-3.5 w-3.5" />
                Email All Past Due
              </Button>
            )}

            <span className="text-muted-foreground text-xs">
              {filteredCompanies.length} companies
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
                      No companies found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Email compose sheet */}
      <ComposeEmailSheet
        open={emailSheet.open}
        onOpenChange={(open) => setEmailSheet({ open })}
        defaultAudience={emailSheet.audience}
      />
    </>
  );
}
