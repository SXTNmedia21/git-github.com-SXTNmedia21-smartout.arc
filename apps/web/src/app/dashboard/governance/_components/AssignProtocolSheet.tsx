"use client";

/**
 * Sheet for admins to assign a protocol to one or more employees.
 * Opens from GovernanceOverview (per-protocol) or CompetenceMatrix (protocol picker).
 * Uses Command component for searchable multi-select of employees.
 * Connected to: useBulkAssignProtocol mutation
 */

import { useState, useMemo, useCallback } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useBulkAssignProtocol } from "../_hooks/use-assignment-mutations";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AssignProtocolSheetProps {
  /** When provided, locks the sheet to this protocol (opened from GovernanceOverview) */
  protocolId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EmployeeOption = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  departmentName: string | null;
};

type ProtocolOption = {
  protocolId: string;
  name: string;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AssignProtocolSheet({
  protocolId: fixedProtocolId,
  open,
  onOpenChange,
}: AssignProtocolSheetProps) {
  const { workspace } = useWorkspace();
  const bulkAssign = useBulkAssignProtocol();

  const [selectedProtocolId, setSelectedProtocolId] = useState<string>(fixedProtocolId ?? "");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());

  const activeProtocolId = fixedProtocolId ?? selectedProtocolId;

  // Fetch active protocols (only when no fixed protocol)
  const { data: protocols } = useQuery({
    queryKey: ["governance", "protocols-list", workspace.workspace_id],
    enabled: open && !fixedProtocolId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProtocolOption[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .select("protocol_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return (data ?? []).map((p) => ({
        protocolId: p.protocol_id,
        name: p.name,
      }));
    },
  });

  // Fetch eligible employees (active/trainee, not already assigned to selected protocol)
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["governance", "assignable-employees", workspace.workspace_id, activeProtocolId],
    enabled: open && !!activeProtocolId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<EmployeeOption[]> => {
      const supabase = createClient();

      // Fetch all active/trainee profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, department:department_id(name)")
        .eq("workspace_id", workspace.workspace_id)
        .in("profile_status", ["active", "trainee"])
        .order("display_name");

      if (profileError) throw profileError;

      // Fetch existing assignments for this protocol
      const { data: existing, error: assignError } = await supabase
        .from("protocol_assignment")
        .select("profile_id")
        .eq("protocol_id", activeProtocolId)
        .eq("workspace_id", workspace.workspace_id);

      if (assignError) throw assignError;

      const assignedSet = new Set((existing ?? []).map((a) => a.profile_id));

      return (profiles ?? [])
        .filter((p) => !assignedSet.has(p.profile_id))
        .map((p) => {
          const dept = p.department as unknown as { name: string } | null;
          return {
            profileId: p.profile_id,
            displayName: p.display_name ?? "Ukjent",
            avatarUrl: p.avatar_url,
            departmentName: dept?.name ?? null,
          };
        });
    },
  });

  const stableEmployees = useMemo(() => employees ?? [], [employees]);

  const toggleProfile = useCallback((profileId: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!activeProtocolId || selectedProfileIds.size === 0) return;

    bulkAssign.mutate(
      {
        protocolId: activeProtocolId,
        profileIds: Array.from(selectedProfileIds),
      },
      {
        onSuccess: () => {
          setSelectedProfileIds(new Set());
          setSelectedProtocolId("");
          onOpenChange(false);
        },
      },
    );
  }, [activeProtocolId, selectedProfileIds, bulkAssign, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setSelectedProfileIds(new Set());
        if (!fixedProtocolId) setSelectedProtocolId("");
      }
      onOpenChange(nextOpen);
    },
    [fixedProtocolId, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Tildel protokoll
          </SheetTitle>
          <SheetDescription>Velg ansatte som skal tildeles protokollen manuelt.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
          {/* Protocol selector (only when not fixed) */}
          {!fixedProtocolId && (
            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-medium">Protokoll</label>
              <Select value={selectedProtocolId} onValueChange={setSelectedProtocolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg protokoll..." />
                </SelectTrigger>
                <SelectContent>
                  {(protocols ?? []).map((p) => (
                    <SelectItem key={p.protocolId} value={p.protocolId}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected count badge */}
          {selectedProfileIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedProfileIds.size} valgt</Badge>
              <button
                type="button"
                onClick={() => setSelectedProfileIds(new Set())}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Fjern alle
              </button>
            </div>
          )}

          {/* Employee multi-select with search */}
          <div className="border-border flex-1 overflow-hidden rounded-lg border">
            {!activeProtocolId ? (
              <div className="text-muted-foreground flex items-center justify-center p-8 text-sm">
                Velg en protokoll forst
              </div>
            ) : loadingEmployees ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Command className="h-full">
                <CommandInput placeholder="Sok etter ansatt..." />
                <CommandList className="max-h-[400px]">
                  <CommandEmpty>Ingen ansatte tilgjengelige</CommandEmpty>
                  <CommandGroup>
                    {stableEmployees.map((emp) => {
                      const isSelected = selectedProfileIds.has(emp.profileId);
                      return (
                        <CommandItem
                          key={emp.profileId}
                          value={emp.displayName}
                          onSelect={() => toggleProfile(emp.profileId)}
                          className="flex items-center gap-3"
                        >
                          <div
                            className={`border-primary flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                              isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={emp.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">
                              {getInitials(emp.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{emp.displayName}</p>
                            {emp.departmentName && (
                              <p className="text-muted-foreground text-[10px]">
                                {emp.departmentName}
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleSubmit}
            disabled={!activeProtocolId || selectedProfileIds.size === 0 || bulkAssign.isPending}
            className="w-full"
          >
            {bulkAssign.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Tildel {selectedProfileIds.size > 0 ? `(${selectedProfileIds.size})` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
