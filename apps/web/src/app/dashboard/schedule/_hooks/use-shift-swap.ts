"use client";

/**
 * Hooks for shift swap in the schedule view.
 *
 * ADR-0132 (Mobile AI Routing) / campaign/schedule-harness Sortie 1 Task C:
 * initiate / respond / cancel route through the /api/shift-swap/* BFF
 * endpoints — the BFF re-derives identity server-side (ADR-0176
 * Invariant 3) and runs the C4 authority gate (ADR-0201) before invoking
 * the SECURITY DEFINER RPC via a JWT-scoped client. Keeping web on the
 * same canonical path as mobile means one audit trail, one gate surface.
 *
 * `useApproveSwap` (admin-only) still calls the `approve_shift_swap` RPC
 * directly — out of scope for this sortie; tracked separately.
 *
 * Telemetry: emit() runs in `onSuccess` as before. Task D of this sortie
 * will rename registry events to dot-form and fold telemetry into the
 * BFF; this hook holds the existing emit() call sites in the interim
 * (no regression vs pre-refactor behaviour).
 *
 * ADR-0328: 409 PIPELINE_LOCK_HELD responses surface as a discriminated
 * sonner toast (5 s, dismiss button) so employees understand why the
 * action was blocked without seeing a raw error code.
 *
 * Connected to: engine_state (process_id = 'shift_swap')
 * Connected to: schedule_shift (read for eligibility, mutated by RPCs)
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { ShiftSwapContext } from "@smartout/utils";

// ── Pipeline lock error envelope (ADR-0328) ─────────────────────────────────
// Zod parse: fail silently (safeParse) so unknown shapes fall through to
// the generic error path without crashing.

const PipelineLockEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.literal("PIPELINE_LOCK_HELD"),
  locking_blueprint_id: z.string().optional(),
});

type PipelineLockEnvelope = z.infer<typeof PipelineLockEnvelopeSchema>;

/** Discriminated class so onError handlers can instanceof-check without
 *  coupling to error strings. */
export class PipelineLockError extends Error {
  public readonly lockingBlueprintId: string | undefined;
  constructor(envelope: PipelineLockEnvelope) {
    super("PIPELINE_LOCK_HELD");
    this.name = "PipelineLockError";
    this.lockingBlueprintId = envelope.locking_blueprint_id;
  }
}

/** Norwegian toast copy discriminated by locking blueprint (ADR-0328). */
function showPipelineLockToast(lockingBlueprintId: string | undefined): void {
  let message: string;

  if (lockingBlueprintId === "marketplace_lifecycle") {
    // swap-on-marketplace: employee tried to initiate a swap but the shift is
    // already in the marketplace pipeline
    message = "Vakten er låst av et åpent vakttilbud — venter på godkjenning";
  } else if (lockingBlueprintId === "shift_swap_lifecycle") {
    // same-capability-double: two swap initiations on the same shift
    message = "Det finnes allerede en åpen flyt på denne vakten";
  } else {
    message = "Vakten er allerede i en aktiv flyt";
  }

  toast.error(message, { duration: 5000, dismissible: true });
}

// ── BFF fetch helper ────────────────────────────────────────────────────────
// Same-origin fetch; Next.js middleware attaches the session cookie.
// Identity fields are NEVER in the body (ADR-0176 Invariant 3).
//
// On 409 PIPELINE_LOCK_HELD: throws PipelineLockError (not a generic Error)
// so mutation onError handlers can discriminate without inspecting strings.
async function bffPost<TBody extends Record<string, unknown>, TOk = unknown>(
  path: string,
  body: TBody,
): Promise<TOk> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    let envelope: unknown;
    try {
      envelope = await res.json();
    } catch {
      envelope = {};
    }
    const parsed = PipelineLockEnvelopeSchema.safeParse(envelope);
    if (parsed.success) {
      throw new PipelineLockError(parsed.data);
    }
    // Non-PIPELINE_LOCK_HELD 409 — fall through to generic error
    throw new Error(`BFF 409`);
  }

  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return (await res.json()) as TOk;
}

// ── Query Keys ──────────────────────────────────────────────────────────────

function swapKey(wsId: string) {
  return ["schedule", "swaps", wsId] as const;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type SwapRequest = {
  id: string;
  context: ShiftSwapContext;
  engineStatus: string;
  startedAt: string;
};

// ── Query: Pending Swap Requests ────────────────────────────────────────────

export function useSwapRequests() {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: swapKey(wsId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, context, status, started_at, updated_at")
        .eq("process_id", "shift_swap")
        .eq("workspace_id", wsId)
        .in("status", ["active", "waiting"])
        .order("started_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(
        (row): SwapRequest => ({
          id: row.id as string,
          context: row.context as ShiftSwapContext,
          engineStatus: row.status as string,
          startedAt: row.started_at as string,
        }),
      );
    },
  });
}

// ── Mutation: Initiate Swap ─────────────────────────────────────────────────

export function useInitiateSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requesterShiftId: string;
      targetProfileId: string;
      targetShiftId: string;
      reason?: string;
    }) => {
      const json = await bffPost<Record<string, unknown>, { ok: boolean; swap_id: string | null }>(
        "/api/shift-swap/initiate",
        {
          requester_shift_id: params.requesterShiftId,
          target_profile_id: params.targetProfileId,
          target_shift_id: params.targetShiftId,
          reason: params.reason ?? null,
        },
      );
      if (!json.ok || !json.swap_id) {
        throw new Error("BFF returnerte uventet svar.");
      }
      return json.swap_id;
    },
    onSuccess: (swapId, variables) => {
      void emit({
        event: "shift_swap.requested",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity_type: "shift",
          entity_id: swapId,
          data: {
            swap_id: swapId,
            requester_shift_id: variables.requesterShiftId,
            target_shift_id: variables.targetShiftId,
            target_profile_id: variables.targetProfileId,
          },
        },
      });
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      toast.success("Bytteforespørsel sendt");
    },
    onError: (err) => {
      if (err instanceof PipelineLockError) {
        showPipelineLockToast(err.lockingBlueprintId);
        return;
      }
      const message = err instanceof Error ? err.message : "Kunne ikke sende bytteforespørsel";
      toast.error(message);
    },
  });
}

// ── Mutation: Respond to Swap ───────────────────────────────────────────────

export function useRespondToSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { swapId: string; accepted: boolean; reason?: string }) => {
      await bffPost("/api/shift-swap/respond", {
        swap_id: params.swapId,
        accepted: params.accepted,
        reason: params.reason ?? null,
      });
    },
    onSuccess: (_, vars) => {
      if (vars.accepted) {
        void emit({
          event: "shift_swap.accepted",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId },
          },
        });
      } else {
        void emit({
          event: "shift_swap.rejected",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId, rejected_by: profileId ?? "" },
          },
        });
      }
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      toast.success(vars.accepted ? "Bytte akseptert" : "Bytte avvist");
    },
    onError: (err) => {
      if (err instanceof PipelineLockError) {
        showPipelineLockToast(err.lockingBlueprintId);
        return;
      }
      const message = err instanceof Error ? err.message : "Kunne ikke svare på bytteforespørsel";
      toast.error(message);
    },
  });
}

// ── Mutation: Approve/Reject Swap ───────────────────────────────────────────

export function useApproveSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { swapId: string; approved: boolean; reason?: string }) => {
      const supabase = createClient();
      // RPC not yet in generated types — cast fn name until next `supabase gen types`
      const { error } = await supabase.rpc(
        "approve_shift_swap" as never,
        {
          p_swap_id: params.swapId,
          p_approved: params.approved,
          p_reason: params.reason ?? null,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.approved) {
        // Emit both approval and execution — the RPC swaps employee_ids on approval
        void emit({
          event: "shift_swap.approved",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId },
          },
        });
        void emit({
          event: "shift_swap.executed",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId },
          },
        });
      } else {
        void emit({
          event: "shift_swap.rejected",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId, rejected_by: profileId ?? "" },
          },
        });
      }
      // Invalidate both swap queries and shift queries (shifts mutated on approval)
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      void qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success(vars.approved ? "Bytte godkjent" : "Bytte avvist");
    },
    onError: (err) => {
      if (err instanceof PipelineLockError) {
        showPipelineLockToast(err.lockingBlueprintId);
        return;
      }
      const message = err instanceof Error ? err.message : "Kunne ikke behandle bytteforespørsel";
      toast.error(message);
    },
  });
}

// ── Mutation: Cancel Swap ──────────────────────────────────────────────────

export function useCancelSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (swapId: string) => {
      await bffPost("/api/shift-swap/cancel", { swap_id: swapId });
      return swapId;
    },
    onSuccess: (_, swapId) => {
      void emit({
        event: "shift_swap.cancelled",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity_type: "shift",
          entity_id: swapId,
          data: { swap_id: swapId },
        },
      });
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      toast.success("Byttforespørsel kansellert");
    },
    onError: (err) => {
      if (err instanceof PipelineLockError) {
        showPipelineLockToast(err.lockingBlueprintId);
        return;
      }
      const message = err instanceof Error ? err.message : "Kunne ikke kansellere bytte";
      toast.error(message);
    },
  });
}
