// ══════════════════════════════════════════════════════════════════
// SMA-347 — notify_period_locked action handler
// ══════════════════════════════════════════════════════════════════
//
// Engine action type: `notify_period_locked`
//
// Called by executeStep() in index.ts when a payroll period transitions
// to 'locked' via an engine_process step of this type.
//
// Step action_payload shape:
//   period_id         string   (UUID of payroll.payroll_period)
//   period_label      string   (display label, e.g. "mai 2026")
//   profile_ids       string[] (UUIDs of profiles to notify)
//
// Outcome: INSERTs one notification_outbox row per profile_id.
// The process-notifications cron delivers via push (expo_push_token)
// or in_app fallback.
//
// Idempotency: stored in metadata.idempotency_key
//   = payroll.period_locked.<period_id>.<profile_id>
//
// Schema notes (notification_outbox):
//   - `recipient_id`   FK → profile.profile_id (NOT `profile_id`)
//   - `allowed_channels` array enum (NOT scalar `channel`)
//   - `action_url`     deep-link string (NOT `deep_link`)
//   - no `idempotency_key` column — advisory key stored in metadata
//
// Ref: SMA-347, docs/superpowers/plans/2026-05-10-payroll-mvp-blockers.md §Task 14
// ══════════════════════════════════════════════════════════════════

import type { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Shared engine shapes (mirror index.ts internals) ───────────

export interface PeriodLockedStep {
  step_order: number;
  action_type: string;
  action_payload: Record<string, unknown>;
  condition: unknown;
  assignee_rule: string | null;
}

export interface PeriodLockedState {
  id: string;
  workspace_id: string;
  process_id: string;
  current_step: number;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  context: Record<string, unknown>;
  steps_snapshot: PeriodLockedStep[] | null;
  result: Record<string, unknown> | null;
}

// ─── Idempotency key ─────────────────────────────────────────────

function makeIdempotencyKey(periodId: string, profileId: string): string {
  return `payroll.period_locked.${periodId}.${profileId}`;
}

// ─── Handler ─────────────────────────────────────────────────────

/**
 * handleNotifyPeriodLocked — main action handler for `notify_period_locked`.
 *
 * Reads `period_id`, `period_label`, and `profile_ids` from
 * `step.action_payload`, inserts notification_outbox rows, then
 * advances the engine state. On failure, marks the state as failed.
 */
export async function handleNotifyPeriodLocked(
  supabase: ReturnType<typeof createClient>,
  state: PeriodLockedState,
  step: PeriodLockedStep,
): Promise<void> {
  const payload = (step.action_payload ?? {}) as Record<string, unknown>;

  // Validate payload fields
  const periodId = payload.period_id;
  const periodLabel = payload.period_label;
  const profileIds = payload.profile_ids;

  if (
    typeof periodId !== "string" ||
    !periodId ||
    typeof periodLabel !== "string" ||
    !periodLabel ||
    !Array.isArray(profileIds) ||
    !profileIds.every((p) => typeof p === "string")
  ) {
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error:
          "notify_period_locked: action_payload must have period_id (string), period_label (string), profile_ids (string[])",
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  const typedProfileIds = profileIds as string[];
  const periodicPrefix = `payroll.period_locked.${periodId}.`;

  // Idempotency pre-check — find profiles already notified.
  let existingKeys: Set<string> = new Set();
  try {
    const { data: existing } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          filter: (
            col: string,
            op: string,
            val: string,
          ) => Promise<{ data: Array<{ metadata: Record<string, unknown> | null }> | null; error: unknown }>;
        };
      };
    })
      .from("notification_outbox")
      .select("metadata")
      .filter("metadata->>idempotency_key", "ilike", `${periodicPrefix}%`);

    const candidateKeys = new Set(
      typedProfileIds.map((pid) => makeIdempotencyKey(periodId, pid)),
    );

    if (existing) {
      for (const row of existing) {
        const key = row.metadata?.idempotency_key as string | undefined;
        if (key && candidateKeys.has(key)) {
          existingKeys.add(key);
        }
      }
    }
  } catch {
    // Non-fatal — proceed without dedup
    console.warn(
      "[notify_period_locked] idempotency pre-check failed — proceeding without dedup",
    );
    existingKeys = new Set();
  }

  const rows = typedProfileIds
    .filter((profileId) => !existingKeys.has(makeIdempotencyKey(periodId, profileId)))
    .map((profileId) => ({
      workspace_id: state.workspace_id,
      recipient_id: profileId,
      mode: "work" as const,
      priority: 1,
      title: `Lønnsgrunnlag for ${periodLabel} er klart`,
      body: "Sjekk din lønnsgrunnlag i Smartout-appen",
      action_url: `/dashboard/my-salary?period=${periodId}`,
      allowed_channels: ["push", "in_app"] as const,
      metadata: {
        event_key: "payroll.period_locked",
        icon_type: "payroll",
        period_id: periodId,
        idempotency_key: makeIdempotencyKey(periodId, profileId),
      },
    }));

  const skipped = typedProfileIds.length - rows.length;

  if (rows.length === 0) {
    // All already notified — advance to next step as success
    console.info(
      `[notify_period_locked] all ${skipped} profiles already notified for period ${periodId} — no-op`,
    );
    await advanceEngineState(supabase, state, {
      dispatched: 0,
      skipped,
    });
    return;
  }

  const { error } = await supabase.from("notification_outbox").insert(rows);

  if (error) {
    console.error("[notify_period_locked] insert failed:", error.message);
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error: `notify_period_locked: notification_outbox insert failed — ${error.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  console.info(
    `[notify_period_locked] dispatched ${rows.length}, skipped ${skipped} for period ${periodId}`,
  );

  await advanceEngineState(supabase, state, {
    dispatched: rows.length,
    skipped,
  });
}

// ─── Engine state advance ────────────────────────────────────────
// Mirrors the pattern from scan-overdue-invoices.ts: mark state complete
// with result summary. Caller's executeStep advances to next step via
// advanceToNextStep() immediately after returning from this function.

async function advanceEngineState(
  supabase: ReturnType<typeof createClient>,
  state: PeriodLockedState,
  result: { dispatched: number; skipped: number },
): Promise<void> {
  await supabase
    .from("engine_state")
    .update({
      result: {
        ...((state.result as Record<string, unknown>) ?? {}),
        notify_period_locked: result,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id);
}
