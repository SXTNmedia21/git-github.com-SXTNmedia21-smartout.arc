// ============================================
// use-day-info.ts
// TanStack Query hook for schedule_day_info table.
// Fetches day-level notes, events, alerts for a date range.
// Connected to: daily-grid.tsx (displays events/notes in headers)
// Connected to: day-info-dialog.tsx (creates new entries)
// ============================================
"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace-context";
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

type DayInfoInsert = {
  workspace_id: string;
  date: string;
  title: string;
  content?: string | null;
  scope_type: DayInfoScopeType;
  scope_id?: string | null;
  category: DayInfoCategory;
  created_by?: string | null;
};

// DB row shape (snake_case from Supabase)
type DayInfoRow = {
  id: string;
  workspace_id: string;
  date: string;
  title: string;
  content: string | null;
  scope_type: string;
  scope_id: string | null;
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ── Untyped from() helper ────────────────────────────────────
// schedule_day_info is not yet in database.types.ts (migration exists,
// types not regenerated). Cast through Function to bypass type check.
// TODO: Remove cast after running `npx supabase gen types typescript`

type UntypedFrom = (table: string) => {
  select: (columns: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      gte: (
        col: string,
        val: string,
      ) => {
        lte: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts?: { ascending?: boolean },
          ) => Promise<{ data: DayInfoRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
  insert: (
    row: DayInfoInsert,
  ) => Promise<{ data: DayInfoRow | null; error: { message: string } | null }>;
};

// ── Query key ────────────────────────────────────────────────

function dayInfoKey(workspaceId: string, weekStart: string) {
  return ["schedule", "day-info", workspaceId, weekStart] as const;
}

// ── Mapper ───────────────────────────────────────────────────

function fromDbDayInfo(row: DayInfoRow): DayInfo {
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

export function useDayInfo(weekStart: string, weekEnd: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  const query = useQuery({
    queryKey: dayInfoKey(workspaceId, weekStart),
    queryFn: async () => {
      const supabase = createClient();
      const from = supabase.from.bind(supabase) as unknown as UntypedFrom;

      const { data, error } = await from("schedule_day_info")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []).map(fromDbDayInfo);
    },
    enabled: !!workspaceId,
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
  const workspaceId = workspace.workspace_id;
  const queryKey = dayInfoKey(workspaceId, weekStart);

  return useMutation({
    mutationFn: async (info: Omit<DayInfo, "id" | "createdAt">) => {
      const supabase = createClient();
      const from = supabase.from.bind(supabase) as unknown as UntypedFrom;

      const { error } = await from("schedule_day_info").insert({
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

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Daginfo opprettet");
    },

    onError: () => {
      toast.error("Kunne ikke opprette daginfo");
    },
  });
}
