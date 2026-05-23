/**
 * useRoutineExtract — photo-to-routine extraction + commit transport
 *
 * WHY: Provides a typed hook for the two-step routine-from-photo flow:
 *   1. extract() — sends a storage_path to the BFF which runs vision extraction,
 *      returning a RoutineDraft with steps, trigger guess, and location hint.
 *   2. commit() — posts operator-reviewed CommitInput to persist the routine and
 *      returns the new routine_id.
 *
 * Telemetry: emits mobile.routine.photo_extracted after a successful extract
 * (best-effort; errors are silently swallowed so extract still returns the draft).
 */

import { useState, useCallback } from "react";
import { getWebApiUrl } from "@/lib/web-api";
import { supabase } from "@/lib/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoutineDraft = {
  routine_name: string;
  trigger_guess: {
    trigger_type: "scheduled" | "event";
    trigger_config: Record<string, unknown>;
  };
  location_hint: string | null;
  steps: {
    title: string;
    description: string;
    is_required: boolean;
    estimated_minutes: number | null;
  }[];
};

export type CommitInput = {
  routine_name: string;
  trigger_type: "scheduled" | "event";
  trigger_config: Record<string, unknown>;
  location_id: string | null;
  new_location: { name: string; address?: string; city?: string } | null;
  team_ids: string[];
  protocol_id: string | null;
  steps: RoutineDraft["steps"];
  /** storage_path of the source image used for extraction */
  source_reference: string;
};

// ─── Internals ───────────────────────────────────────────────────────────────

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRoutineExtract() {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Send a storage_path to the BFF vision extractor and return a RoutineDraft
   * on success, or null on failure (error is set on the hook state).
   */
  const extract = useCallback(async (storagePath: string): Promise<RoutineDraft | null> => {
    setIsWorking(true);
    setError(null);
    try {
      const res = await fetch(`${getWebApiUrl()}/api/mobile/routine/extract`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await bearer()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ storage_path: storagePath }),
      });

      const json = (await res.json()) as {
        ok: boolean;
        draft?: RoutineDraft;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.draft) {
        setError(json.error ?? "extract_failed");
        return null;
      }

      // Telemetry — best-effort; never block the return value
      try {
        const { workspaceId, profileId } = await getProfileContext();
        await emit({
          event: "mobile.routine.photo_extracted",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: { entity_type: "routine", entity_id: storagePath },
            data: { step_count: json.draft.steps.length },
          },
        });
      } catch {
        // telemetry is best-effort — do not surface to caller
      }

      return json.draft;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setIsWorking(false);
    }
  }, []);

  /**
   * Post an operator-reviewed CommitInput to the BFF and return the new
   * routine_id on success, or null on failure (error is set on the hook state).
   */
  const commit = useCallback(async (input: CommitInput): Promise<string | null> => {
    setIsWorking(true);
    setError(null);
    try {
      const res = await fetch(`${getWebApiUrl()}/api/mobile/routine/commit`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await bearer()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });

      const json = (await res.json()) as {
        ok: boolean;
        routine_id?: string;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.routine_id) {
        setError(json.error ?? "commit_failed");
        return null;
      }

      return json.routine_id;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setIsWorking(false);
    }
  }, []);

  return { extract, commit, isWorking, error };
}
