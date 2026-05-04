"use client";

/**
 * TurnTimeline — session replay surface (ADR-0184).
 *
 * Fetches the full turn dump from /api/botsson/recorder/sessions/[id] and
 * renders a stack of TurnCards. Turns ship from the BFF already ordered by
 * turn_index ascending.
 *
 * Flag handler: prompts the operator for a reason, POSTs to
 * /api/botsson/recorder/flag (per-turn), then reloads the session. The
 * endpoint resolves the actor's profile_id server-side from auth.uid()
 * per ADR-0151 — we send only turn_id + reason.
 */

import { useCallback, useEffect, useState } from "react";
import { TurnCard } from "./TurnCard";
import type { Database } from "@smartout/supabase";

type Turn = Database["public"]["Tables"]["agent_session_recording"]["Row"];

type SessionDumpResponse = {
  session_id: string;
  workspace_id: string;
  turn_count: number;
  turns: Turn[];
};

type TurnTimelineProps = {
  sessionId: string;
};

export function TurnTimeline({ sessionId }: TurnTimelineProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/botsson/recorder/sessions/${sessionId}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Session not found" : `HTTP ${res.status}`);
        setTurns([]);
        return;
      }
      const data = (await res.json()) as SessionDumpResponse;
      setTurns(data.turns ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTurns([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const handleFlag = useCallback(
    async (turnId: string) => {
      const reason = window.prompt("Hvorfor flagger du denne?");
      if (!reason) return;
      const res = await fetch("/api/botsson/recorder/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turn_id: turnId, reason }),
      });
      if (!res.ok) {
        window.alert(`Flagging feilet: ${res.status}`);
        return;
      }
      await reload();
    },
    [reload],
  );

  if (loading) {
    return <p className="text-muted-foreground text-sm">Laster...</p>;
  }
  if (error) {
    return <p className="text-destructive text-sm">Feil: {error}</p>;
  }
  if (turns.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen turns.</p>;
  }

  return (
    <div className="max-h-[70vh] space-y-1 overflow-y-auto">
      {turns.map((t) => (
        <TurnCard key={t.id} turn={t} onFlag={handleFlag} />
      ))}
    </div>
  );
}
