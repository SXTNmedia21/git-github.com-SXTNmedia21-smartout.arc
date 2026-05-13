/**
 * useReconWizard — M2 clockout-wizard mutation hook (mobile).
 *
 * Resolves `{ profileId, workspaceId }` via getProfileContext() BEFORE
 * any emit() so telemetry is always attributed (ADR-0134).
 *
 * Save strategy (online): writes directly to
 * daily_reconciliation.wizard_state via Supabase JWT (Phase B policy
 * `jwt_leader_write_daily_reconciliation` permits the duty leader to
 * update the row).
 *
 * Save strategy (offline — M2 polish #2 / ADR-0134 durability):
 *   - NetInfo reports offline → the step payload is validated via Zod
 *     and enqueued as a `save_wizard_step` WriteAction. On connectivity
 *     return the SyncWorker drains the queue; the action handler
 *     replays the load → merge → upsert server-side.
 *   - NetInfo reports online → direct JWT write (same as before).
 * Either path ends with a `reconciliation step_completed` emit.
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
import { enqueue } from "@/lib/sync/queue";

export type WizardStepId =
  | "00_stempletut"
  | "01_oversikt"
  | "02_omsetning"
  | "03_kontanttelling"
  | "04_avvik"
  | "05_segjennom"
  | "06_sendt";

export const STEP_ORDER: readonly WizardStepId[] = [
  "00_stempletut",
  "01_oversikt",
  "02_omsetning",
  "03_kontanttelling",
  "04_avvik",
  "05_segjennom",
  "06_sendt",
];

export type WizardStateShape = {
  last_completed_step: number;
  last_touched_at: string;
  step_data: Record<string, Record<string, unknown>>;
};

type ReconRow = {
  /**
   * Nullable while the row is queued offline and has not yet been written
   * to `daily_reconciliation`. Empty-string fallback would silently corrupt
   * any downstream `.eq("reconciliation_id", id)` filter (ADR-0134 / L-0083).
   */
  reconciliation_id: string | null;
  status: string;
  wizard_state: WizardStateShape | Record<string, never>;
};

/** Query: load reconciliation + wizard_state for a session. */
export function useReconWizardState(sessionId: string | null) {
  return useQuery({
    queryKey: ["recon-wizard", sessionId],
    enabled: !!sessionId,
    staleTime: 30_000,
    queryFn: async (): Promise<ReconRow | null> => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select("reconciliation_id, status, wizard_state")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        reconciliation_id: data.reconciliation_id,
        status: data.status,
        wizard_state:
          typeof data.wizard_state === "object" && data.wizard_state !== null
            ? (data.wizard_state as unknown as WizardStateShape)
            : ({} as Record<string, never>),
      };
    },
  });
}

/** Returns `staleMinutes` — minutes since last wizard_state touch, or null. */
export function wizardStaleMinutes(state: ReconRow | null | undefined): number | null {
  const wizardState = state?.wizard_state;
  if (!wizardState || typeof wizardState !== "object") return null;
  const lastTouched = (wizardState as WizardStateShape).last_touched_at;
  if (!lastTouched) return null;
  const diffMs = Date.now() - new Date(lastTouched).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return Math.floor(diffMs / 60_000);
}

/** Mutation hook — save/submit/override. */
export function useReconWizard(sessionId: string) {
  const queryClient = useQueryClient();

  const saveStep = useMutation({
    mutationFn: async (input: {
      stepId: WizardStepId;
      stepData: Record<string, unknown>;
    }): Promise<{ lastCompletedStep: number; lastTouchedAt: string; queued: boolean }> => {
      const { profileId, workspaceId } = await getProfileContext();
      const now = new Date().toISOString();
      const thisIdx = STEP_ORDER.indexOf(input.stepId);

      // Resolve department_id for the offline-queue payload + lazy-insert
      // path. One lightweight round-trip that the direct path also uses.
      const { data: session, error: sessionErr } = await supabase
        .from("department_session")
        .select("department_id, workspace_id, session_date")
        .eq("department_session_id", sessionId)
        .single();
      if (sessionErr) throw sessionErr;
      const reconciliationDate = session.session_date ?? new Date().toISOString().slice(0, 10);

      // Branch on current connectivity. NetInfo.fetch() resolves quickly;
      // we prefer a per-call probe over a captured state so the step
      // action reflects the state at the moment of save, not at hook
      // mount. Offline = enqueue; online = direct JWT write.
      const net = await NetInfo.fetch();
      const online = net.isInternetReachable !== false && net.isConnected !== false;

      if (!online) {
        // Offline path — enqueue for the SyncWorker. Payload is Zod-validated
        // at enqueue (ADR-0134 gate 2) so a malformed call fails fast here
        // rather than sitting in SQLite until sync time.
        await enqueue("save_wizard_step", {
          session_id: sessionId,
          workspace_id: session.workspace_id,
          department_id: session.department_id,
          step_id: input.stepId,
          step_data: input.stepData,
          reconciliation_date: reconciliationDate,
          client_touched_at: now,
        });

        void emit({
          event: "reconciliation step_completed",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            data: {
              session_id: sessionId,
              step: input.stepId,
            },
          },
        });

        // Optimistic wizard_state patch so UI advances immediately. The
        // recon-wizard query's cache is the source of truth for the step
        // index — patch it here using the same merge shape the handler
        // will replay online.
        const prev = queryClient.getQueryData<{
          // Mirrors ReconRow above — null until the row exists in DB.
          reconciliation_id: string | null;
          status: string;
          wizard_state: WizardStateShape | Record<string, never>;
        } | null>(["recon-wizard", sessionId]);

        const prevWizard: WizardStateShape =
          prev && prev.wizard_state && "last_touched_at" in prev.wizard_state
            ? (prev.wizard_state as WizardStateShape)
            : {
                last_completed_step: -1,
                last_touched_at: new Date(0).toISOString(),
                step_data: {},
              };
        const nextLastIdx =
          thisIdx > (prevWizard.last_completed_step ?? -1)
            ? thisIdx
            : (prevWizard.last_completed_step ?? -1);
        const nextWizard: WizardStateShape = {
          last_completed_step: nextLastIdx,
          last_touched_at: now,
          step_data: {
            ...(prevWizard.step_data ?? {}),
            [input.stepId]: input.stepData,
          },
        };
        queryClient.setQueryData(["recon-wizard", sessionId], {
          // Preserve null while the row is queued offline. ADR-0134 / L-0083.
          reconciliation_id: prev?.reconciliation_id ?? null,
          status: prev?.status ?? "open",
          wizard_state: nextWizard,
        });

        return { lastCompletedStep: nextLastIdx, lastTouchedAt: now, queued: true };
      }

      // Online path — direct JWT write. Load current wizard_state for
      // JSONB merge, then insert or update in one round-trip.
      const { data: existing, error: fetchErr } = await supabase
        .from("daily_reconciliation")
        .select("reconciliation_id, wizard_state, session_id")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const wizardState: WizardStateShape =
        existing && existing.wizard_state && typeof existing.wizard_state === "object"
          ? (existing.wizard_state as unknown as WizardStateShape)
          : { last_completed_step: -1, last_touched_at: new Date(0).toISOString(), step_data: {} };

      const nextLastIdx =
        thisIdx > (wizardState.last_completed_step ?? -1)
          ? thisIdx
          : (wizardState.last_completed_step ?? -1);

      const nextWizardState: WizardStateShape = {
        last_completed_step: nextLastIdx,
        last_touched_at: now,
        step_data: {
          ...(wizardState.step_data ?? {}),
          [input.stepId]: input.stepData,
        },
      };

      if (!existing) {
        const { error: insertErr } = await supabase.from("daily_reconciliation").insert({
          workspace_id: session.workspace_id,
          department_id: session.department_id,
          session_id: sessionId,
          reconciliation_date: reconciliationDate,
          status: "open",
          wizard_state: nextWizardState,
        } as never);
        if (insertErr) throw insertErr;
      } else {
        const { error: updateErr } = await supabase
          .from("daily_reconciliation")
          .update({
            wizard_state: nextWizardState as unknown as never,
            updated_at: now,
          })
          .eq("reconciliation_id", existing.reconciliation_id);
        if (updateErr) throw updateErr;
      }

      void emit({
        event: "reconciliation step_completed",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          data: {
            session_id: sessionId,
            step: input.stepId,
          },
        },
      });

      return { lastCompletedStep: nextLastIdx, lastTouchedAt: now, queued: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recon-wizard", sessionId] });
    },
  });

  const submitWizard = useMutation({
    mutationFn: async (): Promise<{ reconciliationId: string }> => {
      const { profileId, workspaceId } = await getProfileContext();
      const { data: existing, error: fetchErr } = await supabase
        .from("daily_reconciliation")
        .select("reconciliation_id, status, wizard_state")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) throw new Error("Ingen avstemming å sende inn.");
      if (existing.status !== "open") {
        throw new Error(`Avstemming er allerede i status '${existing.status}'.`);
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("daily_reconciliation")
        .update({
          status: "submitted",
          settled_by: profileId,
          settled_at: now,
          updated_at: now,
        } as never)
        .eq("reconciliation_id", existing.reconciliation_id);
      if (updateErr) throw updateErr;

      void emit({
        event: "reconciliation submitted",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          data: { reconciliation_id: existing.reconciliation_id },
        },
      });

      return { reconciliationId: existing.reconciliation_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recon-wizard", sessionId] });
    },
  });

  const mutation = useMemo(
    () => ({
      saveStep: saveStep.mutateAsync,
      saveStepState: {
        isPending: saveStep.isPending,
        isError: saveStep.isError,
        isSuccess: saveStep.isSuccess,
        // The last save was enqueued offline (M2 polish #2). Drives
        // StepSyncIndicator's "queued" readout post-success. Falsy
        // until a successful save returns.
        lastQueued: saveStep.data?.queued ?? false,
      },
      submitWizard: submitWizard.mutateAsync,
      submitState: {
        isPending: submitWizard.isPending,
        isError: submitWizard.isError,
      },
    }),
    [saveStep, submitWizard],
  );

  return mutation;
}

/** Pure helper — derive wizard sync state for StepSyncIndicator. */
export function deriveSyncState(
  mutationState: {
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
    lastQueued?: boolean;
  },
  online: boolean,
): "idle" | "saving" | "saved" | "queued" | "error" {
  if (mutationState.isPending) return online ? "saving" : "queued";
  if (mutationState.isError) return "error";
  // Post-success: if the step was enqueued offline, keep surfacing "queued"
  // so the indicator reflects that sync is still pending. Once online + the
  // SyncWorker drains, the next save (or cache invalidation) flips us back.
  if (mutationState.isSuccess) {
    return mutationState.lastQueued ? "queued" : "saved";
  }
  return "idle";
}

/**
 * Role-gated mount check — returns true if the profile is the duty leader.
 *
 * Also resolves two side-payloads the wizard consumes elsewhere so we
 * don't round-trip twice:
 *   - `departmentName` — shown in WizardHeader (M2 polish #6), via a
 *     JOIN on the session's department row.
 *   - `leaderPunchOutTime` — shown in Step00 (M2 polish #7), via a lookup
 *     of the effective leader's most recent completed
 *     `timesheet.time_entry.punch_out` for the session's date.
 *
 * Both null-safe: missing JOIN / missing time_entry leave the field at
 * `null` and the caller renders a fallback. The timesheet schema isn't
 * modelled by the generated types; we cast to `any` at the schema
 * bridge (same pattern as use-active-time-entry.ts).
 */
export function useIsDutyLeaderForSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["is-duty-leader", sessionId],
    enabled: !!sessionId,
    staleTime: 60_000,
    queryFn: async (): Promise<{
      isLeader: boolean;
      sessionOpen: boolean;
      departmentName: string | null;
      leaderPunchOutTime: string | null;
    } | null> => {
      if (!sessionId) return null;
      const { profileId } = await getProfileContext();
      const { data: session, error } = await supabase
        .from("department_session")
        .select("duty_leader_id, opened_by, status, session_date, department:department_id(name)")
        .eq("department_session_id", sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!session) {
        return {
          isLeader: false,
          sessionOpen: false,
          departmentName: null,
          leaderPunchOutTime: null,
        };
      }
      const effectiveLeader = session.duty_leader_id ?? session.opened_by;

      // PostgREST returns JOINed single-row relations as either an object
      // or array depending on FK cardinality inference. Narrow defensively.
      const sessionRel = session as unknown as {
        department?: { name: string } | { name: string }[] | null;
      };
      const deptRaw = sessionRel.department ?? null;
      const departmentName = Array.isArray(deptRaw)
        ? (deptRaw[0]?.name ?? null)
        : (deptRaw?.name ?? null);

      // Resolve the leader's most recent completed time_entry for this
      // session's date. Post-punch-out this is populated; pre-punch-out
      // it returns null — Step00 shows "—" in that case.
      let leaderPunchOutTime: string | null = null;
      if (effectiveLeader && session.session_date) {
        // session_date is YYYY-MM-DD — match any time_entry whose
        // punch_out falls on that local day. We use an inclusive range
        // bracket on the ISO boundary; timezone nuance is acceptable for
        // a confirm-step display.
        const dayStart = `${session.session_date}T00:00:00.000Z`;
        const dayEnd = `${session.session_date}T23:59:59.999Z`;
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const { data: entry, error: entryErr } = await (supabase as any)
          .schema("timesheet")
          .from("time_entry")
          .select("punch_out")
          .eq("profile_id", effectiveLeader)
          .not("punch_out", "is", null)
          .gte("punch_out", dayStart)
          .lte("punch_out", dayEnd)
          .order("punch_out", { ascending: false })
          .limit(1)
          .maybeSingle();
        /* eslint-enable @typescript-eslint/no-explicit-any */
        // Soft-fail: a missing time_entry row should not break the role
        // gate. We swallow the error and leave punchOutTime null.
        if (!entryErr && entry?.punch_out) {
          leaderPunchOutTime = entry.punch_out as string;
        }
      }

      return {
        isLeader: effectiveLeader === profileId,
        sessionOpen: session.status === "active",
        departmentName,
        leaderPunchOutTime,
      };
    },
  });
}
