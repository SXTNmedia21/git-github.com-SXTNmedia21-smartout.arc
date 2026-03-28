---
title: Governance Admin UI — Implementation Plan
status: approved
updated: 2026-03-25
created: 2026-03-25
module: governance
tags: [governance, protocol, training, readiness, admin, ui, implementation]
---

# Governance Admin UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the governance admin page showing protocol completion per employee with progressive disclosure (protocol cards → employee list → journey map).

**Architecture:** Replace the `/dashboard/governance` placeholder with a client-side interactive page. Three TanStack Query hooks fetch data progressively (overview → assignees → journey). Components use click-to-expand pattern with existing shadcn/ui primitives. No new DB tables or migrations needed — uses existing governance tables.

**Tech Stack:** React 19, TanStack Query v5, Supabase client, shadcn/ui (Card, Collapsible, Badge, Avatar), Tailwind CSS variables, Lucide icons.

---

## Prerequisites

### Step 0: Add shadcn accordion and progress components

Run:

```bash
cd apps/web && npx shadcn@latest add accordion progress
```

Expected: Two new files created in `apps/web/src/components/ui/`.

---

## Task 1: Add governance query keys and types

**Files:**

- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-types.ts`

**Step 1: Add query keys**

In `dashboard-keys.ts`, add after the `leaderPulse` entry:

```typescript
  // Governance
  governanceOverview: (workspaceId: string) =>
    ["dashboard", "governance-overview", workspaceId] as const,

  protocolAssignees: (workspaceId: string, protocolId: string) =>
    ["dashboard", "protocol-assignees", workspaceId, protocolId] as const,

  protocolJourney: (workspaceId: string, assignmentId: string) =>
    ["dashboard", "protocol-journey", workspaceId, assignmentId] as const,
```

**Step 2: Add types**

In `dashboard-types.ts`, add at the end:

```typescript
export type ProtocolOverviewItem = {
  protocolId: string;
  protocolName: string;
  protocolDescription: string | null;
  policyType: string;
  totalAssigned: number;
  completedCount: number;
  pendingCount: number;
  expiredCount: number;
  completionPercent: number;
};

export type ProtocolAssignee = {
  assignmentId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: "pending" | "completed" | "expired";
  assignedAt: string;
  completedAt: string | null;
};

export type JourneyPhase = {
  name: string;
  type: "procedures" | "test" | "confirmation";
  total: number;
  completed: number;
  status: "not_started" | "in_progress" | "completed";
};

export type JourneyStep = {
  stepId: string;
  title: string;
  description: string;
  stepOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
  isCompleted: boolean;
};

export type ProtocolJourneyData = {
  phases: JourneyPhase[];
  steps: JourneyStep[];
};
```

**Step 3: Export new types from index.ts**

In `apps/web/src/app/dashboard/_hooks/index.ts`, add:

```typescript
export type {
  ProtocolOverviewItem,
  ProtocolAssignee,
  JourneyPhase,
  JourneyStep,
  ProtocolJourneyData,
} from "./dashboard-types";
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/dashboard-keys.ts apps/web/src/app/dashboard/_hooks/dashboard-types.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(governance): add query keys and types for governance UI"
```

---

## Task 2: Create useGovernanceOverview hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { ProtocolOverviewItem } from "./dashboard-types";

/**
 * Fetches all active protocols for the workspace with aggregated assignment counts.
 * Connected to: GovernanceOverview component
 */
export function useGovernanceOverview() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.governanceOverview(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProtocolOverviewItem[]> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      // Fetch active protocols with their policy type
      const { data: protocols, error: protocolError } = await supabase
        .from("protocol")
        .select("protocol_id, name, description, status, policy:policy_id(policy_type)")
        .eq("workspace_id", wsId)
        .eq("status", "active");

      if (protocolError) throw protocolError;
      if (!protocols || protocols.length === 0) return [];

      // Fetch all assignments for these protocols
      const protocolIds = protocols.map((p) => p.protocol_id);
      const { data: assignments, error: assignmentError } = await supabase
        .from("protocol_assignment")
        .select("protocol_id, status")
        .in("protocol_id", protocolIds);

      if (assignmentError) throw assignmentError;

      // Aggregate per protocol
      const assignmentMap = new Map<
        string,
        { completed: number; pending: number; expired: number; total: number }
      >();
      for (const a of assignments ?? []) {
        const existing = assignmentMap.get(a.protocol_id) ?? {
          completed: 0,
          pending: 0,
          expired: 0,
          total: 0,
        };
        existing.total++;
        if (a.status === "completed") existing.completed++;
        else if (a.status === "pending") existing.pending++;
        else if (a.status === "expired") existing.expired++;
        assignmentMap.set(a.protocol_id, existing);
      }

      const result: ProtocolOverviewItem[] = protocols.map((p) => {
        const counts = assignmentMap.get(p.protocol_id) ?? {
          completed: 0,
          pending: 0,
          expired: 0,
          total: 0,
        };
        return {
          protocolId: p.protocol_id,
          protocolName: p.name,
          protocolDescription: p.description,
          policyType:
            (p.policy as unknown as { policy_type: string } | null)?.policy_type ?? "custom",
          totalAssigned: counts.total,
          completedCount: counts.completed,
          pendingCount: counts.pending,
          expiredCount: counts.expired,
          completionPercent:
            counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 100,
        };
      });

      // Sort by worst completion first
      result.sort((a, b) => a.completionPercent - b.completionPercent);

      return result;
    },
  });
}
```

**Step 2: Export from index.ts**

Add to `apps/web/src/app/dashboard/_hooks/index.ts`:

```typescript
export { useGovernanceOverview } from "./use-governance-overview";
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-governance-overview.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(governance): add useGovernanceOverview hook"
```

---

## Task 3: Create useProtocolAssignees hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-protocol-assignees.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { ProtocolAssignee } from "./dashboard-types";

/**
 * Fetches all assignees for a specific protocol with profile details.
 * Connected to: ProtocolEmployeeList component
 */
export function useProtocolAssignees(protocolId: string | null) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.protocolAssignees(workspaceId ?? "none", protocolId ?? "none"),
    enabled: !!workspaceId && !!protocolId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ProtocolAssignee[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("protocol_assignment")
        .select(
          `
          assignment_id,
          profile_id,
          status,
          assigned_at,
          completed_at,
          profile!inner(display_name, avatar_url, role, workspace_id)
        `,
        )
        .eq("protocol_id", protocolId!)
        .eq("profile.workspace_id", workspaceId!);

      if (error) throw error;

      return (data ?? []).map((a) => {
        const profile = a.profile as unknown as {
          display_name: string;
          avatar_url: string | null;
          role: string;
        };
        return {
          assignmentId: a.assignment_id,
          profileId: a.profile_id,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          role: profile.role,
          status: a.status,
          assignedAt: a.assigned_at,
          completedAt: a.completed_at,
        };
      });
    },
  });
}
```

**Step 2: Export from index.ts**

Add to `apps/web/src/app/dashboard/_hooks/index.ts`:

```typescript
export { useProtocolAssignees } from "./use-protocol-assignees";
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-protocol-assignees.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(governance): add useProtocolAssignees hook"
```

---

## Task 4: Create useProtocolJourney hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { ProtocolJourneyData, JourneyPhase, JourneyStep } from "./dashboard-types";

/**
 * Fetches the journey detail for a specific protocol assignment:
 * procedure steps, knowledge test status, confirmation status.
 * Connected to: EmployeeJourneyMap component
 */
export function useProtocolJourney(protocolId: string | null, assignmentId: string | null) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.protocolJourney(workspaceId ?? "none", assignmentId ?? "none"),
    enabled: !!workspaceId && !!protocolId && !!assignmentId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ProtocolJourneyData> => {
      const supabase = createClient();

      // Fetch procedures and their steps for this protocol
      const { data: procedures, error: procError } = await supabase
        .from("procedure")
        .select(
          "procedure_id, name, sort_order, procedure_step(step_id, title, description, step_order, is_required, estimated_minutes)",
        )
        .eq("protocol_id", protocolId!)
        .eq("is_active", true)
        .order("sort_order");

      if (procError) throw procError;

      // Fetch knowledge tests for this protocol
      const { data: tests, error: testError } = await supabase
        .from("knowledge_test")
        .select("knowledge_test_id, name")
        .eq("protocol_id", protocolId!)
        .eq("is_active", true);

      if (testError) throw testError;

      // Fetch confirmations for this protocol
      const { data: confirmations, error: confError } = await supabase
        .from("confirmation")
        .select("confirmation_id, name")
        .eq("protocol_id", protocolId!)
        .eq("is_active", true);

      if (confError) throw confError;

      // Build steps from all procedures
      const allSteps: JourneyStep[] = [];
      for (const proc of procedures ?? []) {
        const steps =
          (proc.procedure_step as unknown as Array<{
            step_id: string;
            title: string;
            description: string;
            step_order: number;
            is_required: boolean;
            estimated_minutes: number | null;
          }>) ?? [];
        for (const s of steps) {
          allSteps.push({
            stepId: s.step_id,
            title: s.title,
            description: s.description,
            stepOrder: s.step_order,
            isRequired: s.is_required,
            estimatedMinutes: s.estimated_minutes,
            // NOTE: Step completion tracking not in DB yet.
            // For MVP, we mark all as not completed.
            // When protocol_assignment has component progress fields, we can query actual status.
            isCompleted: false,
          });
        }
      }
      allSteps.sort((a, b) => a.stepOrder - b.stepOrder);

      const totalSteps = allSteps.length;
      const completedSteps = allSteps.filter((s) => s.isCompleted).length;

      // Build phases
      const phases: JourneyPhase[] = [
        {
          name: "Lær",
          type: "procedures",
          total: totalSteps,
          completed: completedSteps,
          status:
            completedSteps === 0
              ? "not_started"
              : completedSteps === totalSteps
                ? "completed"
                : "in_progress",
        },
        {
          name: "Test",
          type: "test",
          total: tests?.length ?? 0,
          completed: 0, // No test attempt tracking in MVP
          status: "not_started",
        },
        {
          name: "Signér",
          type: "confirmation",
          total: confirmations?.length ?? 0,
          completed: 0, // No confirmation signature tracking in MVP
          status: "not_started",
        },
      ];

      return { phases, steps: allSteps };
    },
  });
}
```

**Step 2: Export from index.ts**

Add to `apps/web/src/app/dashboard/_hooks/index.ts`:

```typescript
export { useProtocolJourney } from "./use-protocol-journey";
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts apps/web/src/app/dashboard/_hooks/index.ts
git commit -m "feat(governance): add useProtocolJourney hook"
```

---

## Task 5: Create GovernanceOverview component (protocol cards)

**Files:**

- Create: `apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx`

**Step 1: Create the component**

This is the main view — a grid of protocol cards showing completion percentages. Each card is clickable and expands to show the employee list.

```typescript
"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Flame,
  Users,
  AlertTriangle,
  Key,
  CreditCard,
  Settings,
  ChevronDown,
} from "lucide-react";
import type { ProtocolOverviewItem } from "@/app/dashboard/_hooks/dashboard-types";
import { ProtocolEmployeeList } from "./ProtocolEmployeeList";

const POLICY_TYPE_ICONS: Record<string, typeof ShieldCheck> = {
  operational: Settings,
  haccp: Flame,
  hr: Users,
  safety: AlertTriangle,
  access: Key,
  payroll: CreditCard,
  custom: ShieldCheck,
};

const POLICY_TYPE_LABELS: Record<string, string> = {
  operational: "Drift",
  haccp: "HACCP",
  hr: "HR",
  safety: "Sikkerhet",
  access: "Tilgang",
  payroll: "Lønn",
  custom: "Egendefinert",
};

function getCompletionStatus(percent: number): "good" | "warning" | "critical" {
  if (percent >= 100) return "good";
  if (percent >= 50) return "warning";
  return "critical";
}

const STATUS_COLORS = {
  good: { bar: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  warning: { bar: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  critical: { bar: "bg-red-500", text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
};

interface GovernanceOverviewProps {
  protocols: ProtocolOverviewItem[];
}

export function GovernanceOverview({ protocols }: GovernanceOverviewProps) {
  const [expandedProtocolId, setExpandedProtocolId] = useState<string | null>(null);

  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-12">
        <ShieldCheck className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">Ingen aktive protokoller</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Opprett en policy med protokoll for å komme i gang.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {protocols.map((protocol) => {
        const status = getCompletionStatus(protocol.completionPercent);
        const colors = STATUS_COLORS[status];
        const Icon = POLICY_TYPE_ICONS[protocol.policyType] ?? ShieldCheck;
        const isExpanded = expandedProtocolId === protocol.protocolId;

        return (
          <div key={protocol.protocolId} className="flex flex-col">
            <button
              type="button"
              onClick={() => setExpandedProtocolId(isExpanded ? null : protocol.protocolId)}
              className={`flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/5 ${
                isExpanded ? `${colors.border} border` : "border-border"
              }`}
            >
              {/* Icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}>
                <Icon className={`h-5 w-5 ${colors.text}`} />
              </div>

              {/* Name + type */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {protocol.protocolName}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {POLICY_TYPE_LABELS[protocol.policyType] ?? protocol.policyType}
                  </span>
                </div>
                {protocol.protocolDescription && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {protocol.protocolDescription}
                  </p>
                )}
              </div>

              {/* Completion */}
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <span className={`text-lg font-bold ${colors.text}`}>
                    {protocol.completedCount}/{protocol.totalAssigned}
                  </span>
                  <p className="text-[10px] text-muted-foreground">ansatte</p>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${colors.bar}`}
                    style={{ width: `${protocol.completionPercent}%` }}
                  />
                </div>

                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {/* Expanded: employee list */}
            {isExpanded && (
              <div className="mt-1 ml-14 rounded-xl border border-border bg-card/50 p-4">
                <ProtocolEmployeeList protocolId={protocol.protocolId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx
git commit -m "feat(governance): add GovernanceOverview protocol card grid"
```

---

## Task 6: Create ProtocolEmployeeList component

**Files:**

- Create: `apps/web/src/app/dashboard/governance/_components/ProtocolEmployeeList.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProtocolAssignees } from "@/app/dashboard/_hooks";
import { EmployeeJourneyMap } from "./EmployeeJourneyMap";

type FilterType = "all" | "done" | "not_done";

interface ProtocolEmployeeListProps {
  protocolId: string;
}

export function ProtocolEmployeeList({ protocolId }: ProtocolEmployeeListProps) {
  const { data: assignees, isLoading } = useProtocolAssignees(protocolId);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!assignees || assignees.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Ingen ansatte tildelt denne protokollen
      </p>
    );
  }

  const filtered = assignees.filter((a) => {
    if (filter === "done") return a.status === "completed";
    if (filter === "not_done") return a.status !== "completed";
    return true;
  });

  const doneCount = assignees.filter((a) => a.status === "completed").length;
  const notDoneCount = assignees.length - doneCount;

  return (
    <div className="flex flex-col gap-3">
      {/* Filter tabs */}
      <div className="flex gap-1">
        {([
          { key: "all" as const, label: `Alle (${assignees.length})` },
          { key: "done" as const, label: `Fullført (${doneCount})` },
          { key: "not_done" as const, label: `Gjenstår (${notDoneCount})` },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Employee rows */}
      <div className="flex flex-col gap-1">
        {filtered.map((assignee) => {
          const isDone = assignee.status === "completed";
          const isExpired = assignee.status === "expired";
          const isExpanded = expandedAssignmentId === assignee.assignmentId;
          const initials = assignee.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div key={assignee.assignmentId} className="flex flex-col">
              <button
                type="button"
                onClick={() => setExpandedAssignmentId(isExpanded ? null : assignee.assignmentId)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={assignee.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>

                <span className="flex-1 text-sm text-foreground">{assignee.displayName}</span>

                {isDone ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Fullført
                  </span>
                ) : isExpired ? (
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <Clock className="h-4 w-4" />
                    Utløpt
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Circle className="h-4 w-4" />
                    Ikke fullført
                  </span>
                )}

                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded: journey map */}
              {isExpanded && (
                <div className="mb-2 ml-10 rounded-lg border border-border bg-background p-3">
                  <EmployeeJourneyMap
                    protocolId={protocolId}
                    assignmentId={assignee.assignmentId}
                    assignmentStatus={assignee.status}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/governance/_components/ProtocolEmployeeList.tsx
git commit -m "feat(governance): add ProtocolEmployeeList component"
```

---

## Task 7: Create EmployeeJourneyMap component

**Files:**

- Create: `apps/web/src/app/dashboard/governance/_components/EmployeeJourneyMap.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { BookOpen, GraduationCap, FileSignature, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useProtocolJourney } from "@/app/dashboard/_hooks";
import type { JourneyPhase } from "@/app/dashboard/_hooks/dashboard-types";

const PHASE_ICONS: Record<JourneyPhase["type"], typeof BookOpen> = {
  procedures: BookOpen,
  test: GraduationCap,
  confirmation: FileSignature,
};

const PHASE_STATUS_STYLES = {
  completed: {
    circle: "bg-emerald-500 text-white",
    connector: "bg-emerald-500",
    label: "text-emerald-500",
  },
  in_progress: {
    circle: "bg-orange-500/20 text-orange-500 ring-2 ring-orange-500",
    connector: "bg-muted",
    label: "text-orange-500",
  },
  not_started: {
    circle: "bg-muted text-muted-foreground",
    connector: "bg-muted",
    label: "text-muted-foreground",
  },
};

interface EmployeeJourneyMapProps {
  protocolId: string;
  assignmentId: string;
  assignmentStatus: "pending" | "completed" | "expired";
}

export function EmployeeJourneyMap({
  protocolId,
  assignmentId,
  assignmentStatus,
}: EmployeeJourneyMapProps) {
  const { data: journey, isLoading } = useProtocolJourney(protocolId, assignmentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!journey) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Ingen prosedyrer funnet for denne protokollen
      </p>
    );
  }

  // If assignment is completed, override all phases to completed
  const phases = assignmentStatus === "completed"
    ? journey.phases.map((p) => ({ ...p, status: "completed" as const, completed: p.total }))
    : journey.phases;

  return (
    <div className="flex flex-col gap-4">
      {/* Journey phase map */}
      <div className="flex items-center justify-between gap-2">
        {phases.map((phase, i) => {
          const Icon = PHASE_ICONS[phase.type];
          const styles = PHASE_STATUS_STYLES[phase.status];
          const isLast = i === phases.length - 1;

          return (
            <div key={phase.type} className="flex flex-1 items-center">
              {/* Phase circle */}
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${styles.circle}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] font-medium ${styles.label}`}>
                  {phase.name}
                </span>
                {phase.total > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {phase.completed}/{phase.total}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className={`mx-2 h-0.5 flex-1 rounded-full ${styles.connector}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step checklist */}
      {journey.steps.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Prosedyresteg
          </p>
          {journey.steps.map((step) => {
            const isDone = assignmentStatus === "completed" || step.isCompleted;
            return (
              <div key={step.stepId} className="flex items-start gap-2 py-1">
                {isDone ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <span className={`text-xs ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {step.title}
                  </span>
                  {step.estimatedMinutes && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      ~{step.estimatedMinutes} min
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/governance/_components/EmployeeJourneyMap.tsx
git commit -m "feat(governance): add EmployeeJourneyMap component"
```

---

## Task 8: Create OverdueAlerts component (timeline strip)

**Files:**

- Create: `apps/web/src/app/dashboard/governance/_components/OverdueAlerts.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { ProtocolAssignee } from "@/app/dashboard/_hooks/dashboard-types";

interface OverdueAlertsProps {
  /** All assignees across all protocols that are expired or overdue */
  expiredAssignees: Array<{
    protocolName: string;
    displayName: string;
    assignedAt: string;
  }>;
}

function daysOverdue(assignedAt: string): number {
  const assigned = new Date(assignedAt);
  const now = new Date();
  return Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24));
}

export function OverdueAlerts({ expiredAssignees }: OverdueAlertsProps) {
  if (expiredAssignees.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-xs font-medium text-red-500">
          {expiredAssignees.length} utløpte tildelinger
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {expiredAssignees.slice(0, 5).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 text-red-500/60" />
            <span className="font-medium text-foreground">{item.displayName}</span>
            <span>—</span>
            <span>{item.protocolName}</span>
            <span className="text-red-500/80">
              {daysOverdue(item.assignedAt)} dager siden
            </span>
          </div>
        ))}
        {expiredAssignees.length > 5 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            + {expiredAssignees.length - 5} til
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/governance/_components/OverdueAlerts.tsx
git commit -m "feat(governance): add OverdueAlerts timeline strip"
```

---

## Task 9: Wire up the governance page

**Files:**

- Modify: `apps/web/src/app/dashboard/governance/page.tsx`

**Step 1: Replace the placeholder page**

```typescript
"use client";

import { ShieldCheck, Loader2 } from "lucide-react";
import { useGovernanceOverview } from "@/app/dashboard/_hooks";
import { GovernanceOverview } from "./_components/GovernanceOverview";
import { OverdueAlerts } from "./_components/OverdueAlerts";

export default function GovernancePage() {
  const { data: protocols, isLoading, error } = useGovernanceOverview();

  // Collect expired assignees across all protocols for the alert strip
  const expiredAssignees = (protocols ?? []).flatMap((p) =>
    Array.from({ length: p.expiredCount }, () => ({
      protocolName: p.protocolName,
      displayName: "", // We don't have individual names at overview level
      assignedAt: "", // Would need separate query for individual expired items
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Governance
          </h1>
          <p className="text-sm text-muted-foreground">
            Protokollstatus og ansattes fremdrift
          </p>
        </div>

        {/* Summary stat */}
        {protocols && protocols.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {protocols.length} aktive protokoller
            </span>
          </div>
        )}
      </div>

      {/* Overdue alerts */}
      {protocols && protocols.some((p) => p.expiredCount > 0) && (
        <OverdueAlerts
          expiredAssignees={protocols
            .filter((p) => p.expiredCount > 0)
            .map((p) => ({
              protocolName: p.protocolName,
              displayName: `${p.expiredCount} ansatte`,
              assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            }))}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-sm text-red-500">Kunne ikke laste governance-data</p>
          <p className="mt-1 text-xs text-muted-foreground">{(error as Error).message}</p>
        </div>
      )}

      {/* Protocol cards */}
      {protocols && <GovernanceOverview protocols={protocols} />}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors. If there are type errors from Supabase join shapes, fix the type assertions in the hooks.

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/governance/page.tsx
git commit -m "feat(governance): wire up governance page with protocol overview and alerts"
```

---

## Task 10: Visual test and final polish

**Step 1: Start dev server**

Run:

```bash
pnpm --filter web dev
```

**Step 2: Navigate to governance page**

Open: `http://localhost:3050/dashboard/governance`

**Step 3: Verify**

- [ ] Page loads without errors
- [ ] If no protocols exist: empty state shows "Ingen aktive protokoller"
- [ ] If protocols exist: cards show with completion %, color coding, expand/collapse
- [ ] Clicking a card shows employee list with done/not done
- [ ] Clicking an employee shows journey map with phases and step checklist
- [ ] Overdue alerts show if any expired assignments exist
- [ ] Loading skeleton shows while data loads

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(governance): governance admin UI MVP — protocol cards, employee list, journey map"
```

---

## File Summary

| Action | File                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Modify | `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`                        |
| Modify | `apps/web/src/app/dashboard/_hooks/dashboard-types.ts`                       |
| Modify | `apps/web/src/app/dashboard/_hooks/index.ts`                                 |
| Create | `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts`               |
| Create | `apps/web/src/app/dashboard/_hooks/use-protocol-assignees.ts`                |
| Create | `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts`                  |
| Create | `apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx`   |
| Create | `apps/web/src/app/dashboard/governance/_components/ProtocolEmployeeList.tsx` |
| Create | `apps/web/src/app/dashboard/governance/_components/EmployeeJourneyMap.tsx`   |
| Create | `apps/web/src/app/dashboard/governance/_components/OverdueAlerts.tsx`        |
| Modify | `apps/web/src/app/dashboard/governance/page.tsx`                             |
