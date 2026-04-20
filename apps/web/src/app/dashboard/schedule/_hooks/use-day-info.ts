// ============================================
// use-day-info.ts
// TanStack Query hook for schedule_day_info table.
// Fetches day-level notes, events, alerts for a date range.
// Connected to: daily-grid.tsx (displays events/notes in headers)
// Connected to: day-info-dialog.tsx (creates new entries)
// ============================================
"use client";

import { useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { createClient } from "@smartout/supabase/client";

// ── Types ─────────────────────────────────────────────────────

export type DayInfoScopeType = "workspace" | "department" | "team";
export type DayInfoCategory = "note" | "event" | "alert" | "budget_note";

export type DayInfo = {
  id: string;
  date: string;
  title: string;
  content: string | null;
  scopeType: DayInfoScopeType;
  scopeId: string | null;
  category: DayInfoCategory;
  createdBy: string | null;
  createdAt: string;
};

// Row and Insert types come from Supabase-generated database.types.ts
// via the typed createClient() — no manual definitions needed

// ── Query key ────────────────────────────────────────────────

function dayInfoKey(workspaceId: string, weekStart: string) {
  return ["schedule", "day-info", workspaceId, weekStart] as const;
}

// ── Mapper ───────────────────────────────────────────────────

function fromDbDayInfo(row: {
  id: string;
  date: string;
  title: string;
  content: string | null;
  scope_type: string;
  scope_id: string | null;
  category: string;
  created_by: string | null;
  created_at: string;
}): DayInfo {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    content: row.content,
    scopeType: row.scope_type as DayInfoScopeType,
    scopeId: row.scope_id,
    category: row.category as DayInfoCategory,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ── Query hook ───────────────────────────────────────────────

export function useDayInfo(weekStart: string, weekEnd: string, options?: { enabled?: boolean }) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  const query = useQuery({
    queryKey: dayInfoKey(workspaceId, weekStart),
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_day_info")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []).map(fromDbDayInfo);
    },
    enabled: !!workspaceId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile daily info
  });

  // Group by date for efficient lookup
  const dayInfoByDate = useMemo(() => {
    const map = new Map<string, DayInfo[]>();
    for (const info of query.data ?? []) {
      const existing = map.get(info.date) ?? [];
      existing.push(info);
      map.set(info.date, existing);
    }
    return map;
  }, [query.data]);

  return { dayInfoByDate, isLoading: query.isLoading, data: query.data ?? [] };
}

// ── Mutation: Create day info ────────────────────────────────

export function useCreateDayInfo(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const workspaceId = workspace.workspace_id;
  const queryKey = dayInfoKey(workspaceId, weekStart);

  return useMutation({
    mutationFn: async (info: Omit<DayInfo, "id" | "createdAt">) => {
      const supabase = createClient();

      const { error } = await supabase.from("schedule_day_info").insert({
        workspace_id: workspaceId,
        date: info.date,
        title: info.title,
        content: info.content,
        scope_type: info.scopeType,
        scope_id: info.scopeId,
        category: info.category,
        created_by: info.createdBy,
      });

      if (error) throw new Error(error.message);
    },

    onSuccess: (_data, input) => {
      void emit({
        event: "day_info created",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          data: { date: input.date, category: input.category },
        },
      });
      queryClient.invalidateQueries({ queryKey });
      toast.success("Daginfo opprettet");
    },

    onError: () => {
      toast.error("Kunne ikke opprette daginfo");
    },
  });
}
