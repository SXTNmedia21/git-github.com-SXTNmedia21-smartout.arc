"use client";

// Champions tab: filterable list of workspace profiles with per-user email compose action.

import { useState } from "react";
import { Trophy, Send, UserPlus } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";
import { InviteUserSheet } from "../invite-user-sheet";

export type ProfileRow = {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
};

type Props = {
  profiles: ProfileRow[];
  // Callback to open the shared ComposeEmailSheet (lives in the shell).
  onOpenCompose: (audience: AudienceFilter) => void;
  workspaceId: string;
};

export function ChampionsTab({ profiles, onOpenCompose, workspaceId }: Props) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== "all" && p.role !== roleFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <TabsContent value="champions" className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {profiles.length} {profiles.length === 1 ? "champion" : "champions"} totalt
          </span>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Invitér bruker
        </Button>
      </div>
      <InviteUserSheet open={inviteOpen} onOpenChange={setInviteOpen} workspaceId={workspaceId} />
      <div className="flex items-center gap-3">
        <Trophy className="text-muted-foreground h-4 w-4" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trainee">Trainee</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="offboarding">Offboarding</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{filteredProfiles.length} champions</span>
      </div>
      <div className="border-border rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.map((p) => (
              <tr key={p.profileId} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="text-muted-foreground px-4 py-3">{p.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs capitalize">
                    {p.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} size="sm" />
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {p.lastLogin ? new Date(p.lastLogin).toLocaleDateString("no-NO") : "Never"}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={
                      () =>
                        onOpenCompose({
                          type: "user_ids",
                          userIds: [p.userId],
                        } as unknown as AudienceFilter) // SAFETY: Supabase join returns union type; runtime shape matches the cast
                    }
                  >
                    <Send className="mr-1 h-3 w-3" /> Email
                  </Button>
                </td>
              </tr>
            ))}
            {filteredProfiles.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                  No champions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TabsContent>
  );
}
