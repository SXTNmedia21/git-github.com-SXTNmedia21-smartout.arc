---
title: "Module 6 Training — Sub-project A: Admin Assignment CRUD"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: training
tags: [training, module-6, admin, assignment, crud, governance]
---

# Module 6 Training — Sub-project A: Admin Assignment CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins the ability to manually assign, waive, and revoke protocol assignments from the governance UI. This is the first user-facing feature built on top of Sub-project 0's schema foundation (`workspace_id`, `assigned_via`, `assigned_by`, `waived_by`, `waived_reason`, `status` enum with `waived` value).

**Architecture:** Mutation-first approach. Build TanStack Query mutations following the exact pattern in `use-governance-mutations.ts` (createClient + emit + toast + invalidate). UI components use shadcn Sheet and AlertDialog patterns already established in the governance module. Wire new actions into existing ProtocolEmployeeList, CompetenceMatrix, and GovernanceOverview components.

**Tech Stack:** TypeScript, React, TanStack Query, shadcn/ui (Sheet, AlertDialog, Command), Supabase client, `@smartout/telemetry` emit, sonner toast

**Depends on:** Sub-project 0 (Schema Foundation) — must be merged first. Requires `protocol_assignment.workspace_id`, `assigned_via` enum, `waived_by`, `waived_reason`, `status='waived'` enum value.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `apps/web/src/app/dashboard/governance/_hooks/use-assignment-mutations.ts` | TanStack mutations: assign, waive, revoke, bulk assign |
| `apps/web/src/app/dashboard/governance/_components/AssignProtocolSheet.tsx` | Sheet UI for selecting employees and assigning a protocol |
| `apps/web/src/app/dashboard/governance/_components/WaiveAssignmentDialog.tsx` | AlertDialog for confirming waiver with reason |

### Modified files
| File | Change |
|------|--------|
| `apps/web/src/app/dashboard/governance/_components/ProtocolEmployeeList.tsx` | Add row actions dropdown (waive, revoke) per employee |
| `apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx` | Add "Tildel" button per protocol card header |
| `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx` | Add "Tildel protokoll" button in header that opens AssignProtocolSheet |

---

## Task 1: Assignment Mutations Hook

**Files:**
- Create: `apps/web/src/app/dashboard/governance/_hooks/use-assignment-mutations.ts`

**Pattern reference:** Follow `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts` exactly — same imports, same structure, same error handling.

- [ ] **Step 1: Create the mutations hook file**

```typescript
// apps/web/src/app/dashboard/governance/_hooks/use-assignment-mutations.ts
"use client";

/**
 * TanStack Query mutations for protocol assignment management.
 * Handles assign, waive, revoke, and bulk assign operations.
 * Every mutation calls emit() from @smartout/telemetry on success.
 * Connected to: AssignProtocolSheet, WaiveAssignmentDialog, ProtocolEmployeeList
 */

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { dashboardKeys } from "@/app/dashboard/_hooks";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type AssignProtocolInput = {
  protocolId: string;
  profileId: string;
  protocolVersion?: string;
};

type BulkAssignProtocolInput = {
  protocolId: string;
  profileIds: string[];
  protocolVersion?: string;
};

type WaiveAssignmentInput = {
  assignmentId: string;
  reason: string;
};

type RevokeAssignmentInput = {
  assignmentId: string;
  protocolId: string;
};

// ══════════════════════════════════════════════════════════════
// Assign Protocol (single)
// ══════════════════════════════════════════════════════════════

export function useAssignProtocol() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: AssignProtocolInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol_assignment")
        .insert({
          protocol_id: input.protocolId,
          profile_id: input.profileId,
          workspace_id: workspace.workspace_id,
          assigned_via: "manual",
          assigned_by: profileId!,
          status: "not_started",
          protocol_version: input.protocolVersion ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-protocol-assigned",
          context: data.assignment_id,
        },
      });
      toast.success("Protokoll tildelt");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: () => {
      toast.error("Kunne ikke tildele protokoll");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Bulk Assign Protocol
// ══════════════════════════════════════════════════════════════

export function useBulkAssignProtocol() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: BulkAssignProtocolInput) => {
      const supabase = createClient();

      const rows = input.profileIds.map((pid) => ({
        protocol_id: input.protocolId,
        profile_id: pid,
        workspace_id: workspace.workspace_id,
        assigned_via: "manual" as const,
        assigned_by: profileId!,
        status: "not_started" as const,
        protocol_version: input.protocolVersion ?? null,
      }));

      const { data, error } = await supabase
        .from("protocol_assignment")
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-protocol-bulk-assigned",
          context: `${data.length} assignments`,
        },
      });
      toast.success(`${data.length} ansatte tildelt protokoll`);
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: () => {
      toast.error("Kunne ikke tildele protokoll til ansatte");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Waive Assignment
// ══════════════════════════════════════════════════════════════

export function useWaiveAssignment() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: WaiveAssignmentInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol_assignment")
        .update({
          status: "waived",
          waived_by: profileId!,
          waived_reason: input.reason,
        })
        .eq("assignment_id", input.assignmentId)
        .eq("workspace_id", workspace.workspace_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-assignment-waived",
          context: data.assignment_id,
        },
      });
      toast.success("Tildeling frafalt");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: () => {
      toast.error("Kunne ikke frafalle tildeling");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Revoke Assignment (delete — only if not completed)
// ══════════════════════════════════════════════════════════════

export function useRevokeAssignment() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: RevokeAssignmentInput) => {
      const supabase = createClient();

      // Guard: never delete completed assignments
      const { data: existing, error: fetchError } = await supabase
        .from("protocol_assignment")
        .select("assignment_id, status")
        .eq("assignment_id", input.assignmentId)
        .eq("workspace_id", workspace.workspace_id)
        .single();

      if (fetchError) throw fetchError;
      if (existing.status === "completed") {
        throw new Error("Kan ikke fjerne en fullført tildeling");
      }

      const { error } = await supabase
        .from("protocol_assignment")
        .delete()
        .eq("assignment_id", input.assignmentId)
        .eq("workspace_id", workspace.workspace_id);

      if (error) throw error;
      return { assignmentId: input.assignmentId, protocolId: input.protocolId };
    },

    onSuccess: (result) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-assignment-revoked",
          context: result.assignmentId,
        },
      });
      toast.success("Tildeling fjernet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.protocolAssignees(workspace.workspace_id, result.protocolId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke fjerne tildeling",
      );
    },
  });
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd apps/web && pnpm tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 2: AssignProtocolSheet Component

**Files:**
- Create: `apps/web/src/app/dashboard/governance/_components/AssignProtocolSheet.tsx`

**Dependencies:** `useBulkAssignProtocol` from Task 1, shadcn `Sheet`, `Command` (for employee multi-select with search), `Button`, `Badge`.

- [ ] **Step 1: Verify shadcn Command component exists**

```bash
ls apps/web/src/components/ui/command.tsx
```

If missing, install: `cd apps/web && pnpm dlx shadcn@latest add command`

- [ ] **Step 2: Create the AssignProtocolSheet component**

```tsx
// apps/web/src/app/dashboard/governance/_components/AssignProtocolSheet.tsx
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

  const [selectedProtocolId, setSelectedProtocolId] = useState<string>(
    fixedProtocolId ?? "",
  );
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );

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
    queryKey: [
      "governance",
      "assignable-employees",
      workspace.workspace_id,
      activeProtocolId,
    ],
    enabled: open && !!activeProtocolId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<EmployeeOption[]> => {
      const supabase = createClient();

      // Fetch all active/trainee profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select(
          "profile_id, display_name, avatar_url, department:department_id(name)",
        )
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

      const assignedSet = new Set(
        (existing ?? []).map((a) => a.profile_id),
      );

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
          <SheetDescription>
            Velg ansatte som skal tildeles protokollen manuelt.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
          {/* Protocol selector (only when not fixed) */}
          {!fixedProtocolId && (
            <div className="space-y-1.5">
              <label className="text-foreground text-sm font-medium">
                Protokoll
              </label>
              <Select
                value={selectedProtocolId}
                onValueChange={setSelectedProtocolId}
              >
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
              <Badge variant="secondary">
                {selectedProfileIds.size} valgt
              </Badge>
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
                Velg en protokoll først
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
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={emp.avatarUrl ?? undefined}
                            />
                            <AvatarFallback className="text-[9px]">
                              {getInitials(emp.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {emp.displayName}
                            </p>
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
            disabled={
              !activeProtocolId ||
              selectedProfileIds.size === 0 ||
              bulkAssign.isPending
            }
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
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd apps/web && pnpm tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 3: WaiveAssignmentDialog Component

**Files:**
- Create: `apps/web/src/app/dashboard/governance/_components/WaiveAssignmentDialog.tsx`

**Dependencies:** `useWaiveAssignment` from Task 1, shadcn `AlertDialog`, `Textarea`, `Button`.

- [ ] **Step 1: Create the WaiveAssignmentDialog component**

```tsx
// apps/web/src/app/dashboard/governance/_components/WaiveAssignmentDialog.tsx
"use client";

/**
 * Confirmation dialog for waiving a protocol assignment.
 * Requires a reason (text input) before submitting.
 * Connected to: useWaiveAssignment mutation, ProtocolEmployeeList row actions
 */

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useWaiveAssignment } from "../_hooks/use-assignment-mutations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface WaiveAssignmentDialogProps {
  assignmentId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaiveAssignmentDialog({
  assignmentId,
  employeeName,
  open,
  onOpenChange,
}: WaiveAssignmentDialogProps) {
  const waive = useWaiveAssignment();
  const [reason, setReason] = useState("");

  const handleConfirm = useCallback(() => {
    if (!reason.trim()) return;

    waive.mutate(
      { assignmentId, reason: reason.trim() },
      {
        onSuccess: () => {
          setReason("");
          onOpenChange(false);
        },
      },
    );
  }, [assignmentId, reason, waive, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setReason("");
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Frafalle tildeling?</AlertDialogTitle>
          <AlertDialogDescription>
            Du er i ferd med a frafalle protokolltildelingen for{" "}
            <span className="text-foreground font-medium">{employeeName}</span>.
            Denne handlingen kan ikke angres automatisk.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="waive-reason">Begrunnelse (pakrevd)</Label>
          <Textarea
            id="waive-reason"
            placeholder="Forklar hvorfor tildelingen frafalles..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={waive.isPending}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || waive.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {waive.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Frafalle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd apps/web && pnpm tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 4: Wire into Existing UI

**Files:**
- Modify: `apps/web/src/app/dashboard/governance/_components/ProtocolEmployeeList.tsx`
- Modify: `apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx`
- Modify: `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`

### 4a: ProtocolEmployeeList — Add Row Actions

- [ ] **Step 1: Add imports and state for row actions**

Add these imports to the top of `ProtocolEmployeeList.tsx`:

```typescript
import { MoreHorizontal, ShieldOff, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRevokeAssignment } from "../_hooks/use-assignment-mutations";
import { WaiveAssignmentDialog } from "./WaiveAssignmentDialog";
```

- [ ] **Step 2: Add waive dialog state and revoke mutation inside the component**

Inside the `ProtocolEmployeeList` component function, after the existing state declarations, add:

```typescript
const revoke = useRevokeAssignment();
const [waiveTarget, setWaiveTarget] = useState<{
  assignmentId: string;
  displayName: string;
} | null>(null);
```

- [ ] **Step 3: Add row actions dropdown to each employee row**

In the employee row button area, between the status display and the ChevronDown icon, add a dropdown menu. Replace the existing actions area (the `<div>` containing status icon + label + ChevronDown) with an expanded version that includes the dropdown:

```tsx
<div className="flex items-center gap-1.5">
  {statusDisplay.icon}
  <span className={`text-xs font-medium ${statusDisplay.className}`}>
    {statusDisplay.label}
  </span>
</div>

{/* Row actions */}
{assignee.status !== "completed" && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          setWaiveTarget({
            assignmentId: assignee.assignmentId,
            displayName: assignee.displayName,
          });
        }}
      >
        <ShieldOff className="mr-2 h-3.5 w-3.5" />
        Frafalle
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          revoke.mutate({
            assignmentId: assignee.assignmentId,
            protocolId,
          });
        }}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Fjern tildeling
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

- [ ] **Step 4: Add WaiveAssignmentDialog at the bottom of the component return**

After the closing `</div>` of the employee list, before the final closing `</div>`, add:

```tsx
{/* Waive dialog */}
{waiveTarget && (
  <WaiveAssignmentDialog
    assignmentId={waiveTarget.assignmentId}
    employeeName={waiveTarget.displayName}
    open={!!waiveTarget}
    onOpenChange={(open) => {
      if (!open) setWaiveTarget(null);
    }}
  />
)}
```

### 4b: GovernanceOverview — Add "Tildel" Button

- [ ] **Step 5: Add imports and state to GovernanceOverview.tsx**

Add these imports:

```typescript
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignProtocolSheet } from "./AssignProtocolSheet";
```

Add state inside the component:

```typescript
const [assignProtocolId, setAssignProtocolId] = useState<string | null>(null);
```

- [ ] **Step 6: Add "Tildel" button to each protocol card header**

In the protocol card header button, add a "Tildel" button between the progress bar area and the ChevronDown icon. Insert this just before `<ChevronDown`:

```tsx
<Button
  variant="ghost"
  size="sm"
  className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
  onClick={(e) => {
    e.stopPropagation();
    setAssignProtocolId(protocol.protocolId);
  }}
>
  <UserPlus className="mr-1 h-3.5 w-3.5" />
  Tildel
</Button>
```

- [ ] **Step 7: Add AssignProtocolSheet at the bottom of the component return**

After the closing `</div>` of the protocols list, before the final closing tag, add:

```tsx
{/* Assign sheet */}
<AssignProtocolSheet
  protocolId={assignProtocolId ?? undefined}
  open={!!assignProtocolId}
  onOpenChange={(open) => {
    if (!open) setAssignProtocolId(null);
  }}
/>
```

### 4c: CompetenceMatrix — Add "Tildel protokoll" Button

- [ ] **Step 8: Add imports and state to CompetenceMatrix.tsx**

Add these imports:

```typescript
import { UserPlus } from "lucide-react";
import { AssignProtocolSheet } from "@/app/dashboard/governance/_components/AssignProtocolSheet";
```

Add state inside the component:

```typescript
const [assignSheetOpen, setAssignSheetOpen] = useState(false);
```

- [ ] **Step 9: Add "Tildel protokoll" button in the header**

In the header area (the `<div className="flex items-center justify-between gap-4">`), add a button after the department filter section. Inside the first `<div>` (the one with the title and description), or as a sibling, add:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => setAssignSheetOpen(true)}
>
  <UserPlus className="mr-1.5 h-4 w-4" />
  Tildel protokoll
</Button>
```

- [ ] **Step 10: Add AssignProtocolSheet at the bottom of the component return**

After the closing `</div>` of the matrix table container, before the final closing `</div>`, add:

```tsx
{/* Assign sheet (no fixed protocol — user picks) */}
<AssignProtocolSheet
  open={assignSheetOpen}
  onOpenChange={setAssignSheetOpen}
/>
```

- [ ] **Step 11: Verify all modified files compile**

```bash
cd apps/web && pnpm tsc --noEmit --pretty 2>&1 | head -30
```

---

## Task 5: Typecheck and Commit

- [ ] **Step 1: Run full monorepo typecheck**

```bash
pnpm turbo typecheck
```

Fix any errors. Common issues:
- Missing shadcn components (install with `pnpm dlx shadcn@latest add <component>`)
- Import path mismatches
- Type mismatches with Supabase generated types (use `as const` for enum literals)

- [ ] **Step 2: Verify no lint errors in new/modified files**

```bash
pnpm turbo lint -- --max-warnings=0 2>&1 | tail -20
```

- [ ] **Step 3: Stage and commit**

```bash
git add \
  apps/web/src/app/dashboard/governance/_hooks/use-assignment-mutations.ts \
  apps/web/src/app/dashboard/governance/_components/AssignProtocolSheet.tsx \
  apps/web/src/app/dashboard/governance/_components/WaiveAssignmentDialog.tsx \
  apps/web/src/app/dashboard/governance/_components/ProtocolEmployeeList.tsx \
  apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx \
  apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx

git commit -m "feat(governance): add admin protocol assignment CRUD (assign, waive, revoke, bulk)

Sub-project A of Module 6 Training. Adds:
- Assignment mutations hook (assign, bulk assign, waive, revoke)
- AssignProtocolSheet with employee multi-select
- WaiveAssignmentDialog with required reason
- Row actions in ProtocolEmployeeList (waive, revoke per employee)
- Tildel button in GovernanceOverview per protocol card
- Tildel protokoll button in CompetenceMatrix header

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Checklist

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] New mutations follow the exact pattern from `use-governance-mutations.ts` (createClient, emit, toast, invalidateQueries)
- [ ] Every mutation calls `emit()` with a unique `trackingId`
- [ ] Toast messages are in Norwegian
- [ ] No hardcoded colors — all use CSS variables or Tailwind semantic classes
- [ ] `workspace_id` is always included in Supabase queries (RLS compliance)
- [ ] Revoke mutation guards against deleting completed assignments
- [ ] Waive dialog requires a reason before submitting
- [ ] AssignProtocolSheet filters out already-assigned employees
- [ ] Query invalidation covers: `governanceOverview`, `protocolAssignees`, `competence-matrix`
- [ ] All new components are `"use client"` (mutations require client context)
- [ ] No `any` types — all properly typed
- [ ] Component file headers explain what + why + connected to
