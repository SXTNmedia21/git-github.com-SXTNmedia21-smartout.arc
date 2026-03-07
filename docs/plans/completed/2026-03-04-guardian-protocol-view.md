---
title: Guardian Protocol View — Implementation Plan
status: draft
updated: 2026-03-04
created: 2026-03-04
module: guardian
tags: [guardian, protocol, dashboard, roadmap, mission, season, implementation]
---

# Guardian Protocol View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Guardian" admin view to the dashboard that shows all active roadmaps, missions, journeys, certifications, and signals — modulated by the current season's intensity.

**Architecture:** New 5th admin view tab ("Guardian") in the existing DashboardShell view switcher. One new view component (`GuardianView.tsx`) with 3 sections: Season Pulse (intensity dial driven by current season), Active Protocols (live journeys/missions with status), and Signal Feed (guardian signals). Two new TanStack Query hooks for data fetching. Season drives notification intensity multiplier across the system.

**Tech Stack:** React 19, TanStack Query v5, Supabase client, shadcn/ui, Tailwind CSS variables, Lucide icons.

---

## Prerequisites

### Step 0: Enable godmode for the user

```sql
-- Run against local Supabase
UPDATE public.user_identity
SET is_godmode = true
WHERE email = (SELECT email FROM auth.users LIMIT 1);
```

Run: `npx supabase db reset` or execute directly via `psql` / Supabase Studio.

---

## Task 1: Add "Guardian" to AdminViewType

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Extend the type**

In `DashboardShell.tsx`, find:

```typescript
export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity";
```

Change to:

```typescript
export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity" | "guardian";
```

**Step 2: Add the tab button**

Find the 4 admin view buttons (Tactical, Strategisk, Avstemming, Aktivitet). After the Aktivitet button, add:

```tsx
<button
  onClick={() => setAdminView("guardian")}
  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
    adminView === "guardian"
      ? isDark
        ? "bg-zinc-800 text-white shadow-sm"
        : "bg-white text-zinc-900 shadow-sm"
      : isDark
        ? "text-zinc-400 hover:text-zinc-200"
        : "text-zinc-500 hover:text-zinc-700"
  }`}
>
  <Shield className="h-3.5 w-3.5" />
  Guardian
</button>
```

Add `Shield` to the lucide-react imports.

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): add Guardian to admin view types"
```

---

## Task 2: Create useGuardianData hook

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/useGuardianData.ts`

**Step 1: Write the hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────

export type GuardianSignalRow = {
  id: string;
  signal_type: string;
  domain: string;
  severity: "info" | "warning" | "critical";
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  title: string;
  description: string | null;
  status: "active" | "acknowledged" | "resolved" | "dismissed";
  created_at: string;
};

export type ActiveMissionRow = {
  id: string;
  mission_id: string;
  mission_name: string;
  mission_mode: string;
  channel: string;
  status: string;
  current_stage_id: string | null;
  stage_index: number;
  total_stages: number;
  profile_display_name: string | null;
  journey_title: string | null;
  guardian_whisper_count: number;
  created_at: string;
  updated_at: string;
};

export type SeasonPulse = {
  season_name: string;
  season_id: string;
  start_date: string;
  end_date: string;
  price_factor: number;
  budget_status: string;
  total_target_revenue: number;
  day_factor_today: number;
  is_high_intensity: boolean;
};

export type GuardianData = {
  signals: GuardianSignalRow[];
  activeSessions: ActiveMissionRow[];
  seasonPulse: SeasonPulse | null;
  counts: {
    activeSignals: number;
    criticalSignals: number;
    activeMissions: number;
    activeJourneys: number;
  };
};

// ─── Hook ────────────────────────────────────────────────────────

export function useGuardianData(workspaceId: string | null) {
  const supabase = createClient();

  // Guardian signals
  const signalsQuery = useQuery({
    queryKey: ["guardian-signals", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("guardian_signal")
        .select(
          "id, signal_type, domain, severity, entity_type, entity_id, entity_label, title, description, status, created_at",
        )
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GuardianSignalRow[];
    },
    enabled: !!workspaceId,
    refetchInterval: 30_000, // Match Guardian's 30s eval loop
  });

  // Active engine sessions (missions + agent sessions)
  const sessionsQuery = useQuery({
    queryKey: ["guardian-sessions", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("engine_sessions")
        .select(
          `
          id,
          mission_id,
          channel,
          status,
          current_stage_id,
          stage_index,
          guardian_whisper_count,
          created_at,
          updated_at,
          engine_missions!inner(id, name, mode),
          profile!left(display_name),
          journey!left(title)
        `,
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Count stages per mission for progress
      const missionIds = [
        ...new Set(
          (data ?? [])
            .map((s: Record<string, unknown>) => {
              const mission = s.engine_missions as Record<string, unknown> | null;
              return mission?.id as string;
            })
            .filter(Boolean),
        ),
      ];

      let stageCounts: Record<string, number> = {};
      if (missionIds.length > 0) {
        const { data: stages } = await supabase
          .from("engine_stages")
          .select("mission_id")
          .in("mission_id", missionIds);
        stageCounts = (stages ?? []).reduce(
          (acc: Record<string, number>, s: Record<string, unknown>) => {
            const mid = s.mission_id as string;
            acc[mid] = (acc[mid] || 0) + 1;
            return acc;
          },
          {},
        );
      }

      return (data ?? []).map((s: Record<string, unknown>) => {
        const mission = s.engine_missions as Record<string, unknown> | null;
        const profile = s.profile as Record<string, unknown> | null;
        const journey = s.journey as Record<string, unknown> | null;
        const mid = mission?.id as string;
        return {
          id: s.id as string,
          mission_id: s.mission_id as string,
          mission_name: (mission?.name as string) ?? "Agent Session",
          mission_mode: (mission?.mode as string) ?? "agent",
          channel: s.channel as string,
          status: s.status as string,
          current_stage_id: s.current_stage_id as string | null,
          stage_index: s.stage_index as number,
          total_stages: stageCounts[mid] || 0,
          profile_display_name: (profile?.display_name as string) ?? null,
          journey_title: (journey?.title as string) ?? null,
          guardian_whisper_count: (s.guardian_whisper_count as number) ?? 0,
          created_at: s.created_at as string,
          updated_at: s.updated_at as string,
        } satisfies ActiveMissionRow;
      });
    },
    enabled: !!workspaceId,
    refetchInterval: 15_000,
  });

  // Current season pulse
  const seasonQuery = useQuery({
    queryKey: ["guardian-season-pulse", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const today = new Date().toISOString().slice(0, 10);
      const dayOfWeek = new Date().getDay(); // 0=Sun → remap: Mon=0
      const isoDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      // Find the active season that contains today
      const { data: seasons } = await supabase
        .from("season")
        .select("season_id, name, start_date, end_date")
        .eq("workspace_id", workspaceId)
        .lte("start_date", today)
        .gte("end_date", today)
        .limit(1);

      if (!seasons?.length) return null;
      const season = seasons[0] as Record<string, unknown>;

      // Get budget for this season
      const { data: budgets } = await supabase
        .from("season_budget")
        .select("season_price_factor, status, total_target_revenue, season_budget_id")
        .eq("season_id", season.season_id as string)
        .limit(1);

      const budget = (budgets?.[0] ?? null) as Record<string, unknown> | null;

      // Get today's day_factor
      let dayFactorToday = 1.0;
      if (budget) {
        const { data: dayFactors } = await supabase
          .from("day_factor")
          .select("factor")
          .eq("season_budget_id", budget.season_budget_id as string)
          .eq("weekday", isoDay)
          .limit(1);
        if (dayFactors?.length) {
          dayFactorToday = (dayFactors[0] as Record<string, unknown>).factor as number;
        }
      }

      const priceFactor = (budget?.season_price_factor as number) ?? 1.0;

      return {
        season_name: season.name as string,
        season_id: season.season_id as string,
        start_date: season.start_date as string,
        end_date: season.end_date as string,
        price_factor: priceFactor,
        budget_status: (budget?.status as string) ?? "draft",
        total_target_revenue: (budget?.total_target_revenue as number) ?? 0,
        day_factor_today: dayFactorToday,
        is_high_intensity: priceFactor * dayFactorToday > 1.5,
      } satisfies SeasonPulse;
    },
    enabled: !!workspaceId,
    refetchInterval: 60_000, // Season data changes slowly
  });

  const signals = useMemo(() => signalsQuery.data ?? [], [signalsQuery.data]);
  const activeSessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  const counts = useMemo(
    () => ({
      activeSignals: signals.filter((s) => s.status === "active").length,
      criticalSignals: signals.filter((s) => s.severity === "critical").length,
      activeMissions: activeSessions.filter((s) => s.mission_mode !== "agent").length,
      activeJourneys: activeSessions.filter((s) => s.journey_title !== null).length,
    }),
    [signals, activeSessions],
  );

  return {
    signals,
    activeSessions,
    seasonPulse: seasonQuery.data ?? null,
    counts,
    isLoading: signalsQuery.isLoading || sessionsQuery.isLoading || seasonQuery.isLoading,
  } satisfies GuardianData & { isLoading: boolean };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/useGuardianData.ts
git commit -m "feat(guardian): add useGuardianData hook with signals, sessions, season pulse"
```

---

## Task 3: Create GuardianView component

**Files:**

- Create: `apps/web/src/components/dashboard/GuardianView.tsx`

**Step 1: Write the component**

This is the core view. Three sections stacked vertically:

1. **Season Pulse** — shows current season intensity (price_factor × day_factor), a visual intensity indicator, and whether the system is in high/low mode
2. **Active Protocols** — cards for every active mission/journey session. Shows mission name, stage progress, channel, whisper count, and the person doing it
3. **Signal Feed** — recent guardian signals with severity colors

```typescript
"use client";

import { useContext, useMemo } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useGuardianData } from "@/app/dashboard/_hooks/useGuardianData";
import {
  Shield,
  Activity,
  Zap,
  AlertTriangle,
  Info,
  Radio,
  User,
  Clock,
  MessageSquare,
  Compass,
} from "lucide-react";

interface GuardianViewProps {
  isDark: boolean;
}

// ─── Season Pulse ─────────────────────────────────────────

function SeasonPulseSection({
  seasonPulse,
  isDark,
}: {
  seasonPulse: ReturnType<typeof useGuardianData>["seasonPulse"];
  isDark: boolean;
}) {
  if (!seasonPulse) {
    return (
      <div className={`rounded-xl border p-6 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"}`}>
        <div className="flex items-center gap-2 text-zinc-500">
          <Compass className="h-4 w-4" />
          <span className="text-sm font-medium">Ingen aktiv sesong</span>
        </div>
      </div>
    );
  }

  const intensity = seasonPulse.price_factor * seasonPulse.day_factor_today;
  const intensityPct = Math.min(Math.round(intensity * 100), 300);
  const isHigh = intensity > 1.5;
  const isMedium = intensity > 1.0 && intensity <= 1.5;

  const intensityColor = isHigh
    ? "text-orange-400"
    : isMedium
      ? "text-emerald-400"
      : "text-blue-400";

  const intensityBg = isHigh
    ? "bg-orange-500/10 border-orange-500/20"
    : isMedium
      ? "bg-emerald-500/10 border-emerald-500/20"
      : "bg-blue-500/10 border-blue-500/20";

  const intensityLabel = isHigh ? "Hoysesong" : isMedium ? "Normal" : "Lavsesong";

  return (
    <div className={`rounded-xl border p-6 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`h-4 w-4 ${intensityColor}`} />
          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Season Pulse
          </span>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-bold ${intensityBg} ${intensityColor}`}>
          {intensityLabel}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-zinc-500">Sesong</div>
          <div className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {seasonPulse.season_name}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Prisfaktor</div>
          <div className={`text-sm font-bold ${intensityColor}`}>
            {seasonPulse.price_factor.toFixed(1)}x
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Dagfaktor</div>
          <div className={`text-sm font-bold ${intensityColor}`}>
            {seasonPulse.day_factor_today.toFixed(1)}x
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Intensitet</div>
          <div className={`text-sm font-bold ${intensityColor}`}>
            {intensityPct}%
          </div>
        </div>
      </div>

      {/* Intensity bar */}
      <div className="mt-4">
        <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isHigh ? "bg-orange-500" : isMedium ? "bg-emerald-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(intensityPct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Active Protocol Card ─────────────────────────────────

function ProtocolCard({
  session,
  isDark,
}: {
  session: ReturnType<typeof useGuardianData>["activeSessions"][number];
  isDark: boolean;
}) {
  const progress = session.total_stages > 0
    ? Math.round((session.stage_index / session.total_stages) * 100)
    : 0;

  const elapsed = useMemo(() => {
    const ms = Date.now() - new Date(session.created_at).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }, [session.created_at]);

  return (
    <div className={`rounded-lg border p-4 ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-emerald-400" />
          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {session.mission_name}
          </span>
        </div>
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          {session.channel}
        </span>
      </div>

      {session.journey_title && (
        <div className="mb-2 text-xs text-zinc-500">
          Roadmap: {session.journey_title}
        </div>
      )}

      <div className="mb-3 flex items-center gap-4 text-xs text-zinc-500">
        {session.profile_display_name && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {session.profile_display_name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {elapsed}
        </span>
        {session.guardian_whisper_count > 0 && (
          <span className="flex items-center gap-1 text-orange-400">
            <MessageSquare className="h-3 w-3" />
            {session.guardian_whisper_count} whispers
          </span>
        )}
      </div>

      {/* Stage progress */}
      {session.total_stages > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Stage {session.stage_index + 1}/{session.total_stages}</span>
            <span>{progress}%</span>
          </div>
          <div className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}>
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Signal Row ───────────────────────────────────────────

function SignalRow({
  signal,
  isDark,
}: {
  signal: ReturnType<typeof useGuardianData>["signals"][number];
  isDark: boolean;
}) {
  const severityIcon = signal.severity === "critical"
    ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
    : signal.severity === "warning"
      ? <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
      : <Info className="h-3.5 w-3.5 text-blue-400" />;

  const severityColor = signal.severity === "critical"
    ? "border-red-500/20 bg-red-500/5"
    : signal.severity === "warning"
      ? "border-orange-500/20 bg-orange-500/5"
      : "border-blue-500/20 bg-blue-500/5";

  const timeAgo = useMemo(() => {
    const ms = Date.now() - new Date(signal.created_at).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "nå";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }, [signal.created_at]);

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${severityColor}`}>
      <div className="mt-0.5">{severityIcon}</div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
          {signal.title}
        </div>
        {signal.description && (
          <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">{signal.description}</div>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span>{signal.domain}</span>
          {signal.entity_label && (
            <>
              <span>·</span>
              <span>{signal.entity_label}</span>
            </>
          )}
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────

export function GuardianView({ isDark }: GuardianViewProps) {
  const { workspaceData } = useContext(DashboardContext);
  const { signals, activeSessions, seasonPulse, counts, isLoading } = useGuardianData(
    workspaceData?.workspace_id ?? null
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Shield className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Laster Guardian...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`h-5 w-5 ${isDark ? "text-white" : "text-zinc-900"}`} />
            <h2 className={`text-lg font-black tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              Guardian Protocol
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{counts.activeMissions} missions</span>
            <span>·</span>
            <span>{counts.activeJourneys} journeys</span>
            <span>·</span>
            <span className={counts.criticalSignals > 0 ? "font-bold text-red-400" : ""}>
              {counts.activeSignals} signals
            </span>
          </div>
        </div>

        {/* 1. Season Pulse */}
        <SeasonPulseSection seasonPulse={seasonPulse} isDark={isDark} />

        {/* 2. Active Protocols */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Zap className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />
            <span className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Aktive protokoller
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className={`rounded-xl border p-8 text-center ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"}`}>
              <Radio className="mx-auto mb-2 h-5 w-5 text-zinc-500" />
              <p className="text-sm text-zinc-500">Ingen aktive sessions</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeSessions.map((session) => (
                <ProtocolCard key={session.id} session={session} isDark={isDark} />
              ))}
            </div>
          )}
        </div>

        {/* 3. Signal Feed */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />
            <span className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Signaler
            </span>
          </div>

          {signals.length === 0 ? (
            <div className={`rounded-xl border p-8 text-center ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"}`}>
              <Shield className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
              <p className="text-sm text-zinc-500">Ingen aktive signaler — alt ser bra ut</p>
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map((signal) => (
                <SignalRow key={signal.id} signal={signal} isDark={isDark} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/GuardianView.tsx
git commit -m "feat(guardian): create GuardianView with season pulse, active protocols, signal feed"
```

---

## Task 4: Wire GuardianView into AdminDashboard

**Files:**

- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`

**Step 1: Add import and route**

Add import:

```typescript
import { GuardianView } from "./GuardianView";
```

In the view routing JSX, change the final ternary. Find:

```tsx
) : (
  <ActivityView isDark={isDark} />
)}
```

Replace with:

```tsx
) : adminView === "activity" ? (
  <ActivityView isDark={isDark} />
) : (
  <GuardianView isDark={isDark} />
)}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/AdminDashboard.tsx
git commit -m "feat(guardian): wire GuardianView into admin dashboard router"
```

---

## Task 5: Typecheck

**Step 1: Run typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

**Step 2: Fix any type issues**

Common fixes:

- Supabase query return types may need `as unknown as` casts
- DashboardContext type may need updating if `workspaceData` shape changed

**Step 3: Commit fixes if any**

```bash
git add -u
git commit -m "fix(guardian): resolve type errors in GuardianView"
```

---

## Task 6: Enable godmode for user

**Step 1: Set is_godmode**

Connect to local Supabase and run:

```sql
UPDATE public.user_identity
SET is_godmode = true
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
```

**Step 2: Verify**

```sql
SELECT user_id, email, is_godmode FROM public.user_identity WHERE is_godmode = true;
```

---

## Future Tasks (not in this PR)

These are the next pieces once the base Guardian view is live:

1. **Season Intensity Multiplier** — Add `notification_intensity` column to `season_budget` (or compute from price_factor × day_factor). Wire it into notification dispatch so high season = more frequent nudges, low season = quieter.

2. **Roadmap Package Generator** — `generateRoadmapPackage()` that produces all 5 deliverables. Button on Guardian view: "Generate Roadmap Package" for any journey.

3. **Mission Tools Panel** — Click a protocol card → slide-over panel with tools: send notification, advance stage, whisper, send message, view collected data.

4. **Certification Tracker** — Show completion rate per roadmap. How many employees have been certified.

5. **Playwright Integration** — Run E2E test from Guardian view, see results inline.

6. **Event Timeline** — Expand a protocol card to see its event stream (step_started, step_completed, whisper_sent, etc.)

7. **Output Type Migration** — Evolve `JourneyOutputType` to `RoadmapOutputType` in the database and generators.

---

## Season as System Heartbeat

The season doesn't just affect budget. It drives:

| System                 | High Season (factor > 1.5)      | Low Season (factor < 0.8) |
| ---------------------- | ------------------------------- | ------------------------- |
| Guardian whispers      | More frequent, shorter patience | Relaxed timing            |
| Notification intensity | Push + SMS + in-app             | In-app only               |
| Training roadmaps      | Accelerated timelines           | Extended windows          |
| Protocol monitoring    | 15s eval loop                   | 60s eval loop             |
| Onboarding missions    | Intensive, fast-track mode      | Standard pace             |

This is the multiplier system. The `season_price_factor × day_factor` product is the **intensity dial**. It flows through the Guardian into every subsystem.

---

## Verification

After all tasks complete:

1. Dashboard loads without errors
2. "Guardian" tab visible in admin view switcher
3. Clicking Guardian shows the three sections
4. Season Pulse shows current season (or "Ingen aktiv sesong")
5. Active Protocols shows any running engine sessions
6. Signal Feed shows guardian signals (or "alt ser bra ut")
7. Data refreshes automatically (signals: 30s, sessions: 15s, season: 60s)
8. `is_godmode` is set on the user's `user_identity` row
