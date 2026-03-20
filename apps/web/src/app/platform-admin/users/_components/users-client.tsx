"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Mail,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  KeyRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

const ComposeEmailSheet = dynamic(
  () =>
    import("@/components/platform-admin/compose-email-sheet").then((mod) => mod.ComposeEmailSheet),
  { ssr: false },
);

export type UserRow = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_godmode: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  workspace_count: number;
};

type UsersClientProps = {
  users: UserRow[];
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getUserName(user: UserRow): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || "—";
}

export function UsersClient({ users: initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedFilter = useDebounce(globalFilter, 300);

  // Confirmation dialog state
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

  // Email sheet state
  const [emailSheet, setEmailSheet] = useState<{
    open: boolean;
    audience?: AudienceFilter;
  }>({ open: false });

  async function toggleGodmode(userId: string, currentValue: boolean) {
    try {
      const res = await fetch("/api/platform-admin/users/toggle-super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isGodmode: !currentValue }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast.error(err.error ?? "Failed to update user");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, is_godmode: !currentValue } : u)),
      );
      toast.success(currentValue ? "Super admin access revoked" : "Super admin access granted");
    } catch {
      toast.error("Network error");
    }
  }

  function handleSendEmail(user: UserRow) {
    setEmailSheet({
      open: true,
      audience: { type: "user_ids" as const, userIds: [user.user_id] } as AudienceFilter,
    });
  }

  function handleBulkEmail() {
    const selectedUserIds = table.getSelectedRowModel().rows.map((r) => r.original.user_id);
    if (selectedUserIds.length === 0) return;
    setEmailSheet({
      open: true,
      audience: { type: "user_ids" as const, userIds: selectedUserIds } as AudienceFilter,
    });
  }

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table: t }) => (
          <Checkbox
            checked={
              t.getIsAllPageRowsSelected() || (t.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => t.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        size: 40,
      },
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
        accessorFn: (row) => getUserName(row),
        cell: ({ row }) => <span className="font-medium">{getUserName(row.original)}</span>,
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
      },
      {
        accessorKey: "workspace_count",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Workspaces
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.workspace_count}</span>
        ),
      },
      {
        accessorKey: "is_godmode",
        header: "Role",
        cell: ({ row }) =>
          row.original.is_godmode ? (
            <Badge
              variant="outline"
              className="border-purple-500/20 bg-purple-500/10 text-xs text-purple-400"
            >
              Godmode
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">User</span>
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
        accessorKey: "last_login_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Login
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.last_login_at)}
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
          const user = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSendEmail(user)}>
                  <Mail className="h-4 w-4" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: user.is_godmode ? "Revoke Godmode" : "Grant Godmode",
                      description: user.is_godmode
                        ? `Remove godmode access from ${getUserName(user)} (${user.email})?`
                        : `Grant godmode access to ${getUserName(user)} (${user.email})? This gives full platform control.`,
                      confirmLabel: user.is_godmode ? "Revoke" : "Grant",
                      variant: user.is_godmode ? "destructive" : "default",
                      onConfirm: () => toggleGodmode(user.user_id, user.is_godmode),
                    });
                  }}
                >
                  {user.is_godmode ? (
                    <>
                      <ShieldOff className="h-4 w-4" />
                      Revoke Godmode
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Grant Godmode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: "Reset Password",
                      description: `Send a password reset email to ${user.email}? This is a placeholder action.`,
                      confirmLabel: "Send Reset",
                      variant: "default",
                      onConfirm: () => {
                        toast.info("Password reset is not yet implemented");
                      },
                    });
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
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

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const user = row.original;
      const name = getUserName(user).toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      return name.includes(search) || email.includes(search);
    },
    state: { sorting, rowSelection, globalFilter: debouncedFilter },
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  const selectedCount = table.getSelectedRowModel().rows.length;

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name or email..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            {users.length} users
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
            <span className="text-muted-foreground text-sm">{selectedCount} selected</span>
            <Button variant="outline" size="sm" onClick={handleBulkEmail}>
              <Mail className="h-3.5 w-3.5" />
              Email Selected
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="border-border overflow-x-auto rounded-md border">
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
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
                    No users found.
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

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />

      {/* Email compose sheet */}
      <ComposeEmailSheet
        open={emailSheet.open}
        onOpenChange={(open) => setEmailSheet({ open })}
        defaultAudience={emailSheet.audience}
      />
    </>
  );
}
