"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "@/app/dashboard/_actions/_shared";

/**
 * saveWizardStepAction — M2 clockout-wizard per-step draft save.
 *
 * Called as the user advances through the 6-step wizard (or via the
 * offline queue when reconnecting). Merges `step_data[stepId]` into the
 * reconciliation row's `wizard_state` jsonb, bumps `last_completed_step`
 * monotonically, and refreshes `last_touched_at`.
 *
 * Authority:
 *   - gate_action RPC with capability=`reconciliation.wizard_save`
 *     (seeded autonomous, employee floor — ADR-0189 seed).
 *   - Additionally enforces role: only the session duty_leader_id or
 *     opened_by (shift-leader convention) may save wizard steps.
 *     Admin-override for non-leader path is done via the separate
 *     `overrideWizardBlockerAction`, not here.
 *
 * Mutations:
 *   - daily_reconciliation.wizard_state (jsonb merge)
 *
 * Telemetry:
 *   - emit("reconciliation step_completed") — posthog + logger only
 *     (activity_trail would be too chatty per keystroke / per step).
 */
const InputSchema = z.object({
  sessionId: z.string().uuid(),
  stepId: z.string().min(1).max(64),
  stepData: z.record(z.string(), z.unknown()),
});

export type SaveWizardStepInput = z.infer<typeof InputSchema>;

export type SaveWizardStepResult =
  | { ok: true; lastCompletedStep: number; lastTouchedAt: string }
  | { ok: false; error: string };

/**
 * Ordered step-ids used for monotonic `last_completed_step` computation.
 * Must stay in lock-step with steps/Step{00..06}*.tsx in apps/mobile.
 */
const STEP_ORDER = [
  "00_stempletut",
  "01_oversikt",
  "02_omsetning",
  "03_kontanttelling",
  "04_avvik",
  "05_segjennom",
  "06_sendt",
] as const;

function stepIndex(stepId: string): number {
  const i = STEP_ORDER.indexOf(stepId as (typeof STEP_ORDER)[number]);
  return i < 0 ? -1 : i;
}

export async function saveWizardStepAction(
  input: SaveWizardStepInput,
): Promise<SaveWizardStepResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Ikke autentisert." };
  }

  const admin = createAdminClient();

  // Resolve the session to verify shift-leader role (duty_leader_id ?? opened_by).
  const { data: session, error: sessionError } = await admin
    .from("department_session")
    .select("department_session_id, workspace_id, duty_leader_id, opened_by")
    .eq("department_session_id", parsed.data.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "Fant ikke økt." };
  }
  if (session.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Økt tilhører annet workspace." };
  }

  const effectiveLeader = session.duty_leader_id ?? session.opened_by;
  if (effectiveLeader !== profile.profileId) {
    return { ok: false, error: "Bare vaktleder kan lagre avstemmingssteg." };
  }

  // Authority gate — capability seeded (autonomous, employee floor).
  const gate = await gateAction({
    workspaceId: session.workspace_id,
    capability: "reconciliation.wizard_save",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "created",
    entityId: parsed.data.sessionId,
  });

  if (!gate.allow) {
    return {
      ok: false,
      error: gate.reason ?? "Ikke autorisert for å lagre avstemmingssteg.",
    };
  }

  // Load (or lazily create) the reconciliation row for this session.
  const { data: reconExisting, error: reconFetchError } = await admin
    .from("daily_reconciliation")
    .select("reconciliation_id, wizard_state, status")
    .eq("session_id", parsed.data.sessionId)
    .maybeSingle();

  if (reconFetchError) {
    return { ok: false, error: "Kunne ikke lese avstemming." };
  }

  let reconId: string;
  let wizardState: Record<string, unknown> = {};
  if (!reconExisting) {
    // Lazy-insert. department_id is resolved from the session's department.
    const { data: session2, error: session2Err } = await admin
      .from("department_session")
      .select("department_id")
      .eq("department_session_id", parsed.data.sessionId)
      .single();
    if (session2Err || !session2) {
      return { ok: false, error: "Fant ikke avdeling for økt." };
    }
    const today = new Date().toISOString().slice(0, 10);
    const { data: reconNew, error: reconInsertError } = await admin
      .from("daily_reconciliation")
      .insert({
        workspace_id: session.workspace_id,
        department_id: session2.department_id,
        session_id: parsed.data.sessionId,
        reconciliation_date: today,
        status: "open",
        wizard_state: {},
      })
      .select("reconciliation_id, wizard_state")
      .single();
    if (reconInsertError || !reconNew) {
      return { ok: false, error: "Kunne ikke opprette avstemming." };
    }
    reconId = reconNew.reconciliation_id;
  } else {
    if (reconExisting.status === "approved" || reconExisting.status === "locked") {
      return { ok: false, error: "Avstemming er allerede godkjent — kan ikke endre." };
    }
    reconId = reconExisting.reconciliation_id;
    wizardState =
      typeof reconExisting.wizard_state === "object" && reconExisting.wizard_state !== null
        ? (reconExisting.wizard_state as Record<string, unknown>)
        : {};
  }

  // Merge step_data[stepId] + monotonic last_completed_step bump.
  const existingStepData = (wizardState.step_data as Record<string, unknown> | undefined) ?? {};
  const existingLastIdx = Number(wizardState.last_completed_step ?? -1);
  const thisIdx = stepIndex(parsed.data.stepId);
  const nextLastIdx = thisIdx > existingLastIdx ? thisIdx : existingLastIdx;
  const now = new Date().toISOString();

  const nextWizardState = {
    ...wizardState,
    last_completed_step: nextLastIdx,
    last_touched_at: now,
    step_data: {
      ...existingStepData,
      [parsed.data.stepId]: parsed.data.stepData,
    },
  };

  const { error: updateError } = await admin
    .from("daily_reconciliation")
    .update({
      // JSONB column; our shape nests arbitrary step_data which is wider
      // than the Supabase-generated Json index-signature. Cast to Json-
      // compatible via JSON round-trip shape.
      wizard_state: nextWizardState as unknown as Record<string, never>,
      updated_at: now,
    })
    .eq("reconciliation_id", reconId);

  if (updateError) {
    return { ok: false, error: "Kunne ikke lagre steg." };
  }

  // BUG-SIM-20 fix: When Step 03 (kontanttelling) completes, compare the
  // cash_count_variance against financial_close_config.cash_tolerance_value.
  // If |variance| exceeds the threshold, auto-create a 'material' deviation row
  // so the manager sign-off flow has something to review in Step 04.
  // This is a best-effort side-effect — deviation insert failure is logged but
  // does NOT fail the wizard step (soft: leader should not be blocked by a
  // missing config row).
  if (parsed.data.stepId === "03_kontanttelling") {
    const rawVariance = parsed.data.stepData["cash_count_variance"];
    const variance = typeof rawVariance === "number" ? rawVariance : null;
    if (variance !== null && variance !== 0) {
      // Fetch cash tolerance from financial_close_config (fallback to default 20 kr).
      const { data: fcc } = await admin
        .from("financial_close_config")
        .select("cash_tolerance_value")
        .eq("workspace_id", session.workspace_id)
        .maybeSingle();
      const toleranceValue: number =
        typeof fcc?.cash_tolerance_value === "number" ? fcc.cash_tolerance_value : 20;

      if (Math.abs(variance) > toleranceValue) {
        const absVariance = Math.abs(variance);
        const sign = variance > 0 ? "+" : "-";
        const severity = absVariance >= 500 ? "high" : absVariance >= 100 ? "medium" : "low";

        // Resolve department_id from session for proper deviation context.
        const { data: sessionDept } = await admin
          .from("department_session")
          .select("department_id")
          .eq("department_session_id", parsed.data.sessionId)
          .maybeSingle();

        const { data: insertedDev, error: devInsertErr } = await admin
          .from("deviation")
          .insert({
            workspace_id: session.workspace_id,
            department_id: sessionDept?.department_id ?? null,
            session_id: parsed.data.sessionId,
            reconciliation_id: reconId,
            domain: "material" as const,
            subcategory: "cash_variance",
            severity,
            title: `Kassaavvik ${sign}${absVariance.toLocaleString("nb-NO")} kr`,
            description:
              `Automatisk opprettet ved kontanttelling (steg 03). ` +
              `Avvik: ${sign}${absVariance.toLocaleString("nb-NO")} kr — ` +
              `grense: ${toleranceValue.toLocaleString("nb-NO")} kr. ` +
              `Krever lederbehandling.`,
            reported_by: null, // system-generated per schema comment
            status: "open" as const,
          })
          .select("deviation_id")
          .single();

        if (!devInsertErr && insertedDev) {
          await emit({
            event: "deviation reported",
            workspace_id: nonEmpty(session.workspace_id, "workspace_id"),
            actor_id: nonEmpty(profile.profileId, "actor_id"),
            properties: {
              entity: {
                entity_type: "deviation",
                entity_id: insertedDev.deviation_id,
              },
              data: {
                domain: "material",
                severity,
              },
            },
          });
        }
      }
    }
  }

  await emit({
    event: "reconciliation step_completed",
    workspace_id: nonEmpty(session.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      data: {
        reconciliation_id: reconId,
        session_id: parsed.data.sessionId,
        step: parsed.data.stepId,
      },
    },
  });

  return {
    ok: true,
    lastCompletedStep: nextLastIdx,
    lastTouchedAt: now,
  };
}
