"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";
import { CreateKeyDialog } from "./create-key-dialog";
import { KeySecretDisplay } from "./key-secret-display";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiKeyRow = {
  id: string;
  workspace_id: string | null;
  workspace_name: string | null;
  name: string;
  description: string | null;
  key_type: string;
  environment: string;
  key_prefix: string;
  version: string;
  rotation_number: number;
  scopes: string[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  grace_period_ends_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type SecretRow = {
  id: string;
  workspace_id: string | null;
  workspace_name: string | null;
  provider: string;
  environment: string;
  vault_secret_name: string;
  description: string | null;
  last_rotated_at: string | null;
  last_rotated_by: string | null;
  rotation_reminder_days: number;
  expires_at: string | null;
  is_active: boolean;
  last_verified_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeysPageClient() {
  // Data state
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Keys table state
  const [keySorting, setKeySorting] = useState<SortingState>([]);
  const [keyGlobalFilter, setKeyGlobalFilter] = useState("");
  const [keyStatusFilter, setKeyStatusFilter] = useState<string>("all");

  // Secrets table state
  const [secretSorting, setSecretSorting] = useState<SortingState>([]);
  const [secretGlobalFilter, setSecretGlobalFilter] = useState("");

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [rotateResult, setRotateResult] = useState<{
    open: boolean;
    plaintextKey: string;
  }>({ open: false, plaintextKey: "" });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "default" | "destructive";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "default",
    onConfirm: () => {},
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, secretsRes] = await Promise.all([
        fetch("/api/platform-admin/keys"),
        fetch("/api/platform-admin/secrets"),
      ]);

      const [keysJson, secretsJson] = await Promise.all([keysRes.json(), secretsRes.json()]);

      if (keysRes.ok && keysJson.data) setKeys(keysJson.data);
      if (secretsRes.ok && secretsJson.data) setSecrets(secretsJson.data);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Key actions
  // ---------------------------------------------------------------------------

  async function handleRotate(key: ApiKeyRow) {
    try {
      const res = await fetch(`/api/platform-admin/keys/${key.id}/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grace_period: "48 hours" }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to rotate key");
        return;
      }

      setRotateResult({ open: true, plaintextKey: json.data.plaintext_key });
      toast.success("Key rotated successfully");
      fetchData();
    } catch {
      toast.error("Network error");
    }
  }

  async function handleRevoke(key: ApiKeyRow) {
    try {
      const res = await fetch(`/api/platform-admin/keys/${key.id}/revoke`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Failed to revoke key");
        return;
      }

      toast.success(`Revoked ${json.data.versions_revoked} key version(s)`);
      fetchData();
    } catch {
      toast.error("Network error");
    }
  }

  // ---------------------------------------------------------------------------
  // Keys columns
  // ---------------------------------------------------------------------------

  const keyColumns = useMemo<ColumnDef<ApiKeyRow>[]>(
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
            Name
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            {row.original.workspace_name && (
              <span className="text-muted-foreground ml-2 text-xs">
                {row.original.workspace_name}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "key_prefix",
        header: "Key Prefix",
        cell: ({ row }) => (
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
            {row.original.key_prefix}
          </code>
        ),
      },
      {
        accessorKey: "key_type",
        header: "Type",
        cell: ({ row }) => <StatusBadge status={row.original.key_type} size="sm" />,
      },
      {
        accessorKey: "environment",
        header: "Env",
        cell: ({ row }) => <StatusBadge status={row.original.environment} size="sm" />,
      },
      {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => <StatusBadge status={row.original.version} size="sm" />,
      },
      {
        accessorKey: "rate_limit_per_minute",
        header: () => <span className="block text-right">Rate Limit</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground block text-right text-xs">
            {row.original.rate_limit_per_minute}/min
          </span>
        ),
      },
      {
        accessorKey: "last_used_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Used
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.last_used_at)}
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
          const key = row.original;
          const isRevoked = key.version === "revoked";

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isRevoked}
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: "Rotate API Key",
                      description: `Rotate "${key.name}"? The old key will have a 48-hour grace period before becoming invalid.`,
                      confirmLabel: "Rotate",
                      variant: "default",
                      onConfirm: () => handleRotate(key),
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Rotate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isRevoked}
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: "Revoke API Key",
                      description: `Revoke "${key.name}" and all related versions? This action cannot be undone. Any services using this key will lose access immediately.`,
                      confirmLabel: "Revoke",
                      variant: "destructive",
                      onConfirm: () => handleRevoke(key),
                    });
                  }}
                >
                  <ShieldX className="h-4 w-4" />
                  Revoke
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [],
  );

  // ---------------------------------------------------------------------------
  // Secrets columns
  // ---------------------------------------------------------------------------

  const secretColumns = useMemo<ColumnDef<SecretRow>[]>(
    () => [
      {
        accessorKey: "provider",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Provider
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.provider}</span>,
      },
      {
        accessorKey: "vault_secret_name",
        header: "Vault Name",
        cell: ({ row }) => (
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
            {row.original.vault_secret_name}
          </code>
        ),
      },
      {
        accessorKey: "environment",
        header: "Env",
        cell: ({ row }) => <StatusBadge status={row.original.environment} size="sm" />,
      },
      {
        accessorKey: "last_rotated_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Rotated
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.last_rotated_at)}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.is_active ? "active" : "inactive"} size="sm" />
        ),
      },
      {
        id: "actions",
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => toast.info("Secret rotation is not yet implemented")}
              >
                <RefreshCw className="h-4 w-4" />
                Rotate Secret
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toast.info("Secret deactivation is not yet implemented")}
              >
                <ShieldX className="h-4 w-4" />
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  // ---------------------------------------------------------------------------
  // Filtered data
  // ---------------------------------------------------------------------------

  const filteredKeys = useMemo(() => {
    if (keyStatusFilter === "all") return keys;
    return keys.filter((k) => k.version === keyStatusFilter);
  }, [keys, keyStatusFilter]);

  // ---------------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------------

  const keysTable = useReactTable({
    data: filteredKeys,
    columns: keyColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setKeySorting,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const key = row.original;
      return (
        key.name.toLowerCase().includes(search) ||
        key.key_prefix.toLowerCase().includes(search) ||
        (key.workspace_name?.toLowerCase().includes(search) ?? false)
      );
    },
    state: { sorting: keySorting, globalFilter: keyGlobalFilter },
    onGlobalFilterChange: setKeyGlobalFilter,
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  const secretsTable = useReactTable({
    data: secrets,
    columns: secretColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSecretSorting,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const secret = row.original;
      return (
        secret.provider.toLowerCase().includes(search) ||
        secret.vault_secret_name.toLowerCase().includes(search)
      );
    },
    state: { sorting: secretSorting, globalFilter: secretGlobalFilter },
    onGlobalFilterChange: setSecretGlobalFilter,
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading key data...</div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API Keys & Secrets</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage API keys and external secrets for the platform
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Key
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="keys" className="mt-6">
        <TabsList>
          <TabsTrigger value="keys" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="secrets" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            External Secrets
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys">
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by name, prefix, or workspace..."
                  value={keyGlobalFilter}
                  onChange={(e) => setKeyGlobalFilter(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <Select value={keyStatusFilter} onValueChange={setKeyStatusFilter}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All versions</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="previous">Previous</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <KeyRound className="h-3.5 w-3.5" />
                  {filteredKeys.length} keys
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {keysTable.getHeaderGroups().map((headerGroup) => (
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
                  {keysTable.getRowModel().rows?.length ? (
                    keysTable.getRowModel().rows.map((row) => (
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
                        colSpan={keyColumns.length}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No API keys found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                Page {keysTable.getState().pagination.pageIndex + 1} of {keysTable.getPageCount()}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => keysTable.previousPage()}
                  disabled={!keysTable.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => keysTable.nextPage()}
                  disabled={!keysTable.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* External Secrets Tab */}
        <TabsContent value="secrets">
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by provider or vault name..."
                  value={secretGlobalFilter}
                  onChange={(e) => setSecretGlobalFilter(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Lock className="h-3.5 w-3.5" />
                {secrets.length} secrets
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {secretsTable.getHeaderGroups().map((headerGroup) => (
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
                  {secretsTable.getRowModel().rows?.length ? (
                    secretsTable.getRowModel().rows.map((row) => (
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
                        colSpan={secretColumns.length}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No external secrets found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                Page {secretsTable.getState().pagination.pageIndex + 1} of{" "}
                {secretsTable.getPageCount()}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => secretsTable.previousPage()}
                  disabled={!secretsTable.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => secretsTable.nextPage()}
                  disabled={!secretsTable.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Key Dialog */}
      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchData} />

      {/* Rotate Result Dialog */}
      <Dialog
        open={rotateResult.open}
        onOpenChange={(open) => setRotateResult((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Key Rotated</DialogTitle>
            <DialogDescription>
              Your new API key has been generated. The old key has a 48-hour grace period.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <KeySecretDisplay secretKey={rotateResult.plaintextKey} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </>
  );
}
