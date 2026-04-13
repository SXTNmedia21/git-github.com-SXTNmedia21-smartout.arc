"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Loader2, Users, Building2, UserCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AudienceFilter =
  | { type: "all_users" }
  | { type: "super_admins" }
  | { type: "workspace"; workspaceId: string; role?: string; status?: string }
  | { type: "department"; workspaceId: string; departmentId: string }
  | { type: "role"; role: "owner" | "admin" | "manager" | "employee" }
  | { type: "status"; status: "active" | "trainee" | "inactive" | "offboarding" }
  | { type: "user_ids"; userIds: string[] };

type AudienceSelectorProps = {
  value: AudienceFilter | null;
  onChange: (filter: AudienceFilter) => void;
  workspaceId?: string;
  showWorkspaceFilter?: boolean;
};

type WorkspaceOption = {
  workspace_id: string;
  name: string;
  slug: string;
};

type DepartmentOption = {
  department_id: string;
  name: string;
};

type UserOption = {
  user_id: string;
  email: string;
  full_name: string;
};

const roleOptions = ["owner", "admin", "manager", "employee"] as const;
const statusOptions = ["active", "trainee", "inactive", "offboarding"] as const;

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function WorkspaceCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const fetchWorkspaces = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "20");
      const res = await fetch(`/api/platform-admin/communications/workspaces?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchWorkspaces(debouncedQuery);
    }
  }, [debouncedQuery, open, fetchWorkspaces]);

  return (
    <div className="relative space-y-1.5">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
        <Input
          value={selectedName || query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedName("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search workspaces..."
          className="h-8 pl-8 text-sm"
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-1 h-7 w-7"
            onClick={() => {
              setSelectedName("");
              setQuery("");
              onChange("", "");
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {loading && (
          <Loader2 className="text-muted-foreground absolute top-2 right-2.5 h-3.5 w-3.5 animate-spin" />
        )}
      </div>
      {open && options.length > 0 && (
        <div className="border-border bg-popover absolute z-50 w-full rounded-md border shadow-md">
          <div className="max-h-48 overflow-y-auto p-1">
            {options.map((ws) => (
              <button
                key={ws.workspace_id}
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                onClick={() => {
                  onChange(ws.workspace_id, ws.name);
                  setSelectedName(ws.name);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <Building2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{ws.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">{ws.slug}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentSelect({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [options, setOptions] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/platform-admin/communications/departments?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => setOptions(data.data ?? []))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder="Select department" />
      </SelectTrigger>
      <SelectContent>
        {options.map((dept) => (
          <SelectItem key={dept.department_id} value={dept.department_id}>
            {dept.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserSearchMultiSelect({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(
      `/api/platform-admin/communications/users?q=${encodeURIComponent(debouncedQuery)}&limit=10`,
    )
      .then((res) => res.json())
      .then((data) => setResults(data.data ?? []))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  function addUser(user: UserOption) {
    if (selectedIds.includes(user.user_id)) return;
    const newSelected = [...selectedUsers, user];
    setSelectedUsers(newSelected);
    onChange(newSelected.map((u) => u.user_id));
    setQuery("");
    setOpen(false);
  }

  function removeUser(userId: string) {
    const newSelected = selectedUsers.filter((u) => u.user_id !== userId);
    setSelectedUsers(newSelected);
    onChange(newSelected.map((u) => u.user_id));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2 left-2.5 h-3.5 w-3.5" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search by name or email (min 2 chars)..."
          className="h-8 pl-8 text-sm"
        />
        {loading && (
          <Loader2 className="text-muted-foreground absolute top-2 right-2.5 h-3.5 w-3.5 animate-spin" />
        )}
        {open && results.length > 0 && (
          <div className="border-border bg-popover absolute z-50 mt-1 w-full rounded-md border shadow-md">
            <div className="max-h-48 overflow-y-auto p-1">
              {results
                .filter((u) => !selectedIds.includes(u.user_id))
                .map((user) => (
                  <button
                    key={user.user_id}
                    type="button"
                    className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                    onClick={() => addUser(user)}
                  >
                    <UserCircle className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.full_name}</span>
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {user.email}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <Badge key={user.user_id} variant="secondary" className="gap-1 text-xs">
              {user.full_name || user.email}
              <button
                type="button"
                onClick={() => removeUser(user.user_id)}
                className="hover:text-destructive ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="text-muted-foreground text-xs">
          <Users className="mr-1 inline h-3 w-3" />
          {selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}

export function AudienceSelector({
  value,
  onChange,
  workspaceId,
  showWorkspaceFilter = true,
}: AudienceSelectorProps) {
  const audienceType = value?.type ?? "";

  function handleTypeChange(type: string) {
    switch (type) {
      case "all_users":
        onChange({ type: "all_users" });
        break;
      case "super_admins":
        onChange({ type: "super_admins" });
        break;
      case "workspace":
        onChange({ type: "workspace", workspaceId: workspaceId ?? "" });
        break;
      case "department":
        onChange({ type: "department", workspaceId: workspaceId ?? "", departmentId: "" });
        break;
      case "role":
        onChange({ type: "role", role: "employee" });
        break;
      case "status":
        onChange({ type: "status", status: "active" });
        break;
      case "user_ids":
        onChange({ type: "user_ids", userIds: [] });
        break;
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-muted-foreground text-xs font-medium">Audience</label>
      <Select value={audienceType} onValueChange={handleTypeChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select audience" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all_users">All Users</SelectItem>
          <SelectItem value="super_admins">All Super Admins</SelectItem>
          {showWorkspaceFilter && !workspaceId && (
            <SelectItem value="workspace">By Workspace</SelectItem>
          )}
          {showWorkspaceFilter && !workspaceId && (
            <SelectItem value="department">By Department</SelectItem>
          )}
          <SelectItem value="role">By Role</SelectItem>
          <SelectItem value="status">By Status</SelectItem>
          <SelectItem value="user_ids">Specific Users</SelectItem>
        </SelectContent>
      </Select>

      {/* Workspace picker */}
      {value?.type === "workspace" && !workspaceId && (
        <div className="space-y-2">
          <WorkspaceCombobox
            value={value.workspaceId}
            onChange={(id) => onChange({ type: "workspace", workspaceId: id })}
          />
          {value.workspaceId && (
            <div className="flex gap-2">
              <Select
                value={value.role ?? "all"}
                onValueChange={(role) =>
                  onChange({
                    type: "workspace",
                    workspaceId: value.workspaceId,
                    role: role === "all" ? undefined : role,
                    status: value.status,
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={value.status ?? "all"}
                onValueChange={(status) =>
                  onChange({
                    type: "workspace",
                    workspaceId: value.workspaceId,
                    role: value.role,
                    status: status === "all" ? undefined : status,
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Department picker */}
      {value?.type === "department" && !workspaceId && (
        <div className="space-y-2">
          <WorkspaceCombobox
            value={value.workspaceId}
            onChange={(id) => onChange({ type: "department", workspaceId: id, departmentId: "" })}
          />
          {value.workspaceId && (
            <DepartmentSelect
              workspaceId={value.workspaceId}
              value={value.departmentId}
              onChange={(id) =>
                onChange({ type: "department", workspaceId: value.workspaceId, departmentId: id })
              }
            />
          )}
        </div>
      )}

      {/* Role picker */}
      {value?.type === "role" && (
        <Select
          value={value.role}
          onValueChange={(role) => onChange({ type: "role", role: role as typeof value.role })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status picker */}
      {value?.type === "status" && (
        <Select
          value={value.status}
          onValueChange={(status) =>
            onChange({ type: "status", status: status as typeof value.status })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Individual user search */}
      {value?.type === "user_ids" && (
        <UserSearchMultiSelect
          selectedIds={value.userIds}
          onChange={(ids) => onChange({ type: "user_ids", userIds: ids })}
        />
      )}
    </div>
  );
}
