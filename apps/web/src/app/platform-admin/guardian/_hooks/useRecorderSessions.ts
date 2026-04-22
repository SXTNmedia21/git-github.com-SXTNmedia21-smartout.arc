"use client";

/**
 * useRecorderSessions — Realtime aggregated session feed (ADR-0184 §6b).
 *
 * Subscribes to agent_session_recording INSERT events, re-groups per session,
 * and exposes a sorted list with turn_count / flagged_count / max_attention_score.
 *
 * Pass workspaceId to scope; omit for platform-admin godmode (RLS decides
 * whether godmode_read_asr lets the caller see rows outside their workspace).
 *
 * The hook performs a full re-aggregation on each INSERT rather than incremental
 * updates — simpler, correct, and bounded at 500 most-recent turns (the limit
 * we apply on the initial fetch). If row volume grows past that, move to an
 * aggregation view server-side.
 */

import { useEffect, useState } from "react";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";

type RecordingRow = Database["public"]["Tables"]["agent_session_recording"]["Row"];

export type RecorderSessionRow = {
  session_id: string;
  workspace_id: string;
  turn_count: number;
  last_turn_at: string;
  flagged_count: number;
  max_attention_score: number;
};

export type UseRecorderSessionsResult = {
  sessions: RecorderSessionRow[];
  loading: boolean;
};

export function useRecorderSessions(workspaceId?: string): UseRecorderSessionsResult {
  const [sessions, setSessions] = useState<RecorderSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;

    async function load() {
      let query = supabase
        .from("agent_session_recording")
        .select("session_id, workspace_id, is_flagged, attention_score, created_at");
      if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(500);

      if (disposed) return;
      if (error || !data) {
        setSessions([]);
        setLoading(false);
        return;
      }

      setSessions(aggregate(data));
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel("recorder-sessions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_session_recording",
          ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return { sessions, loading };
}

/**
 * Aggregate raw recording rows into per-session summaries.
 * Exported for unit tests — the transform is pure and worth locking down.
 */
export function aggregate(
  rows: ReadonlyArray<
    Pick<
      RecordingRow,
      "session_id" | "workspace_id" | "is_flagged" | "attention_score" | "created_at"
    >
  >,
): RecorderSessionRow[] {
  const grouped = new Map<string, RecorderSessionRow>();

  for (const row of rows) {
    const score = Number(row.attention_score ?? 0);
    const existing = grouped.get(row.session_id);

    if (existing) {
      existing.turn_count += 1;
      if (row.is_flagged) existing.flagged_count += 1;
      if (score > existing.max_attention_score) existing.max_attention_score = score;
      if (row.created_at > existing.last_turn_at) existing.last_turn_at = row.created_at;
    } else {
      grouped.set(row.session_id, {
        session_id: row.session_id,
        workspace_id: row.workspace_id,
        turn_count: 1,
        last_turn_at: row.created_at,
        flagged_count: row.is_flagged ? 1 : 0,
        max_attention_score: score,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => b.last_turn_at.localeCompare(a.last_turn_at));
}
