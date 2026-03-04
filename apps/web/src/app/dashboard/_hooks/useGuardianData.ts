"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

// ── Types ────────────────────────────────────────────────

export type GuardianSignalSeverity = "info" | "warning" | "critical";
export type GuardianSignalStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export type GuardianSignal = {
  id: string;
  workspace_id: string;
  signal_type: string;
  domain: string;
  severity: GuardianSignalSeverity;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  title: string;
  description: string | null;
  status: GuardianSignalStatus;
  created_at: string;
};

export type ActiveEngineSession = {
  id: string;
  mission_id: string | null;
  mission_name: string | null;
  mission_mode: string | null;
  profile_id: string | null;
  profile_first_name: string | null;
  profile_last_name: string | null;
  journey_id: string | null;
  journey_title: string | null;
  channel: string;
  stage_index: number;
  total_stages: number;
  guardian_whisper_count: number;
  mode: string;
  created_at: string;
  updated_at: string;
};

export type SeasonPulse = {
  season_id: string;
  season_name: string;
  price_factor: number;
  day_factor: number;
  intensity: number;
  total_target_revenue: number;
};

export type GuardianCounts = {
  activeSignals: number;
  criticalSignals: number;
  activeMissions: number;
  activeJourneys: number;
};

export type GuardianData = {
  signals: GuardianSignal[];
  sessions: ActiveEngineSession[];
  seasonPulse: SeasonPulse | null;
  counts: GuardianCounts;
  isLoading: boolean;
  isError: boolean;
};

// ── Stable empty arrays ──────────────────────────────────

const EMPTY_SIGNALS: GuardianSignal[] = [];
const EMPTY_SESSIONS: ActiveEngineSession[] = [];

// ── Hook ─────────────────────────────────────────────────

/**
 * Fetches Guardian Protocol data: active signals, engine sessions, and season pulse.
 * Three independent queries with different refetch intervals.
 * Connected to: GuardianView component
 */
export function useGuardianData(): GuardianData {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  // ── 1. Guardian Signals ──────────────────────────────
  const signalsQuery = useQuery({
    queryKey: dashboardKeys.guardianSignals(workspaceId ?? "none"),
    enabled: !!workspaceId,
    refetchInterval: 30_000, // 30s — signals are time-sensitive
    staleTime: 15_000,
    queryFn: async (): Promise<GuardianSignal[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("guardian_signal")
        .select(
          "id, workspace_id, signal_type, domain, severity, entity_type, entity_id, entity_label, title, description, status, created_at",
        )
        .eq("workspace_id", workspaceId!)
        .in("status", ["active", "acknowledged"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data ?? []) as GuardianSignal[];
    },
  });

  // ── 2. Active Engine Sessions ────────────────────────
  const sessionsQuery = useQuery({
    queryKey: dashboardKeys.guardianSessions(workspaceId ?? "none"),
    enabled: !!workspaceId,
    refetchInterval: 15_000, // 15s — active sessions change rapidly
    staleTime: 10_000,
    queryFn: async (): Promise<ActiveEngineSession[]> => {
      const supabase = createClient();

      // Fetch active sessions with mission, profile, and journey joins
      const { data, error } = await supabase
        .from("engine_sessions")
        .select(
          `
          id,
          mission_id,
          profile_id,
          journey_id,
          channel,
          stage_index,
          guardian_whisper_count,
          mode,
          created_at,
          updated_at,
          engine_missions (
            name,
            mode
          ),
          profile (
            first_name,
            last_name
          ),
          journey (
            title
          )
        `,
        )
        .eq("workspace_id", workspaceId!)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const sessions = data ?? [];

      // For each session, count total stages from the mission
      // Batch-fetch unique mission_ids to avoid N+1
      const missionIds = [
        ...new Set(sessions.map((s) => s.mission_id).filter((id): id is string => id !== null)),
      ];

      const stageCounts = new Map<string, number>();

      if (missionIds.length > 0) {
        const { data: stageData, error: stageError } = await supabase
          .from("engine_stages")
          .select("mission_id")
          .in("mission_id", missionIds);

        if (!stageError && stageData) {
          for (const stage of stageData) {
            stageCounts.set(stage.mission_id, (stageCounts.get(stage.mission_id) ?? 0) + 1);
          }
        }
      }

      return sessions.map((s) => {
        const mission = s.engine_missions as unknown as {
          name: string;
          mode: string;
        } | null;
        const profile = s.profile as unknown as {
          first_name: string | null;
          last_name: string | null;
        } | null;
        const journey = s.journey as unknown as {
          title: string;
        } | null;

        return {
          id: s.id,
          mission_id: s.mission_id,
          mission_name: mission?.name ?? null,
          mission_mode: mission?.mode ?? null,
          profile_id: s.profile_id,
          profile_first_name: profile?.first_name ?? null,
          profile_last_name: profile?.last_name ?? null,
          journey_id: s.journey_id,
          journey_title: journey?.title ?? null,
          channel: s.channel,
          stage_index: s.stage_index,
          total_stages: s.mission_id ? (stageCounts.get(s.mission_id) ?? 0) : 0,
          guardian_whisper_count: s.guardian_whisper_count,
          mode: s.mode,
          created_at: s.created_at,
          updated_at: s.updated_at,
        };
      });
    },
  });

  // ── 3. Season Pulse ──────────────────────────────────
  const seasonPulseQuery = useQuery({
    queryKey: dashboardKeys.guardianSeasonPulse(workspaceId ?? "none"),
    enabled: !!workspaceId,
    refetchInterval: 60_000, // 60s — season data is relatively stable
    staleTime: 30_000,
    queryFn: async (): Promise<SeasonPulse | null> => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0]!;

      // Find active season that covers today
      const { data: seasonData, error: seasonError } = await supabase
        .from("season")
        .select("season_id, name")
        .eq("workspace_id", workspaceId!)
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today)
        .limit(1)
        .maybeSingle();

      if (seasonError) throw seasonError;
      if (!seasonData) return null;

      // Get the season budget
      const { data: budgetData, error: budgetError } = await supabase
        .from("season_budget")
        .select("season_budget_id, season_price_factor, total_target_revenue")
        .eq("season_id", seasonData.season_id)
        .eq("workspace_id", workspaceId!)
        .limit(1)
        .maybeSingle();

      if (budgetError) throw budgetError;
      if (!budgetData) return null;

      // Get today's day factor
      // day_factor uses ISO weekday: 0=Mon..6=Sun
      // JavaScript Date.getDay() returns 0=Sun..6=Sat
      const jsDay = new Date().getDay();
      const isoDay = jsDay === 0 ? 6 : jsDay - 1;

      const { data: dayFactorData, error: dayFactorError } = await supabase
        .from("day_factor")
        .select("factor")
        .eq("season_budget_id", budgetData.season_budget_id)
        .eq("weekday", isoDay)
        .limit(1)
        .maybeSingle();

      if (dayFactorError) throw dayFactorError;

      const priceFactor = Number(budgetData.season_price_factor) || 1.0;
      const dayFactor = dayFactorData ? Number(dayFactorData.factor) : 1.0;
      const intensity = priceFactor * dayFactor;

      return {
        season_id: seasonData.season_id,
        season_name: seasonData.name,
        price_factor: priceFactor,
        day_factor: dayFactor,
        intensity,
        total_target_revenue: Number(budgetData.total_target_revenue) || 0,
      };
    },
  });

  // ── Stable memoized arrays ───────────────────────────
  const signals = useMemo(() => signalsQuery.data ?? EMPTY_SIGNALS, [signalsQuery.data]);

  const sessions = useMemo(() => sessionsQuery.data ?? EMPTY_SESSIONS, [sessionsQuery.data]);

  // ── Computed counts ──────────────────────────────────
  const counts = useMemo((): GuardianCounts => {
    const activeSignals = signals.length;
    const criticalSignals = signals.filter((s) => s.severity === "critical").length;
    const activeMissions = sessions.filter((s) => s.mode === "mission").length;
    const activeJourneys = sessions.filter((s) => s.journey_id !== null).length;

    return { activeSignals, criticalSignals, activeMissions, activeJourneys };
  }, [signals, sessions]);

  return {
    signals,
    sessions,
    seasonPulse: seasonPulseQuery.data ?? null,
    counts,
    isLoading: signalsQuery.isLoading || sessionsQuery.isLoading || seasonPulseQuery.isLoading,
    isError: signalsQuery.isError || sessionsQuery.isError || seasonPulseQuery.isError,
  };
}
