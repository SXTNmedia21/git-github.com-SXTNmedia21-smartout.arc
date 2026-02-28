"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AudienceFilter =
  | { type: "all_users" }
  | { type: "super_admins" }
  | { type: "workspace"; workspaceId: string }
  | { type: "role"; role: "owner" | "admin" | "manager" | "employee" }
  | { type: "status"; status: "active" | "trainee" | "inactive" | "offboarding" }
  | { type: "user_ids"; userIds: string[] };

type AudienceSelectorProps = {
  value: AudienceFilter | null;
  onChange: (filter: AudienceFilter) => void;
  workspaceId?: string;
  showWorkspaceFilter?: boolean;
};

const roleOptions = ["owner", "admin", "manager", "employee"] as const;
const statusOptions = ["active", "trainee", "inactive", "offboarding"] as const;

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
          <SelectItem value="role">By Role</SelectItem>
          <SelectItem value="status">By Status</SelectItem>
        </SelectContent>
      </Select>

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

      {value?.type === "workspace" && !workspaceId && (
        <p className="text-muted-foreground text-xs">
          Workspace selector to be connected to workspace list API.
        </p>
      )}
    </div>
  );
}
