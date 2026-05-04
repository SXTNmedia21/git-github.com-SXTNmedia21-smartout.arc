// ============================================
// use-day-info.ts
// TanStack Query hook for schedule_day_info table.
// Fetches day-level notes, events, alerts for a date range.
// Connected to: daily-grid.tsx (displays events/notes in headers)
// Connected to: day-info-dialog.tsx (creates new entries)
//
// ADR-0114 closure (2026-05-25): useCreateDayInfo is now a thin wrapper
// over createDayInfoAction (Server Action). The direct
// supabase.from("schedule_day_info").insert() + void emit() have been
// removed. gate_action + admin insert + awaited emit live in the action.
// ============================================
"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { createDayInfoAction } from "@/app/dashboard/_actions/create-day-info-action";

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
//
// Thin wrapper over createDayInfoAction (Server Action).
// workspace_id + createdBy are resolved server-side per ADR-0151.
// emit() is awaited server-side per ADR-0134 (no client-side emit here).

export function useCreateDayInfo(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const queryKey = dayInfoKey(workspaceId, weekStart);

  return useMutation({
    mutationFn: async (info: Omit<DayInfo, "id" | "createdAt">) => {
      // workspace_id + createdBy are derived server-side — not passed here.
      // channel defaults to "chat" (web surface).
      const result = await createDayInfoAction({
        date: info.date,
        title: info.title,
        content: info.content ?? null,
        scopeType: info.scopeType,
        scopeId: info.scopeId ?? null,
        category: info.category,
      });
      if (result.ok === false) throw new Error(result.error);
    },

    onSuccess: () => {
      // emit() is now server-side + awaited inside createDayInfoAction.
      // No client-side emit here (ADR-0114 closure).
      queryClient.invalidateQueries({ queryKey });
      toast.success("Daginfo opprettet");
    },

    onError: () => {
      toast.error("Kunne ikke opprette daginfo");
    },
  });
}
