// packages/ai/src/capabilities/journey/tools.ts
//
// Journey capability — 4 tool skeletons (ADR-0173).
//
// SCOPE (S1.4):
// Each `execute()` body is INTENTIONALLY a skeleton:
//   1. ADR-0134 guard: reject empty workspaceId / profileId before any emit.
//   2. Generate run_id, emit exactly one `journey run_started` event
//      (FLAT + nested-entity payload shape registered in S1.1).
//   3. Return a skeleton JSON string — full logic lands M3 (run_dev Playwright),
//      M4 (publish_mission + publish_guide admin UI), M5 (run_guided Fjernkontroll).
//
// DO NOT expand these bodies without updating the S1.4 brief and re-opening
// the sub-sortie. Additional journey events (step_reached/completed/stuck/
// run_failed) fire from the surfaces that actually produce them, NOT here.
//
// Binding ADRs:
//   - 0078  voice forbidden for PII/critical (capability is chat-only at index.ts)
//   - 0134  mobile telemetry contract — workspace_id + actor_id MUST resolve
//           non-null/non-empty BEFORE emit(). Empty-string fallback is banned.
//   - 0173  exactly 4 capabilities, names frozen
//   - 0175  journey event registry — "journey run_started" is space-named
//
// Binding learnings:
//   - L-0094  phantom emit contracts (4th occurrence). Every `emit()` here
//             MUST have a matching registry row in packages/telemetry/src/registry.ts
//             (verified: see `"journey run_started"` at registry.ts:4737+).

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { JourneyIRSchema, validateV21IrForMission, validateIRForGuide } from "@smartout/journey-ir";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";
import { generateGuideMdx } from "./guide-mdx.js";
import { resolveMissionForJourneyVersion } from "../../lib/mission-resolution.js";

// Normalise session channel — unset means we're on an internal/system
// path (cron, engine-dispatch, test harness). Mirrors shift-lifecycle
// so gate_action treats both identically.
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

// Shared Zod schema — all four tools take a journey_version_id for M1
// skeletons. M3/M4/M5 extend per-tool as the real flows land.
const journeyVersionParam = z.object({
  journey_version_id: z.string().uuid().describe("Target journey_version UUID to run or publish"),
});

// ADR-0134 guard: shared message for merge-gate grep clarity.
const MISSING_CONTEXT = {
  ok: false as const,
  error: "missing_context" as const,
};

/**
 * journey.run_dev — Post-M3.5 dev-surface body (N-C).
 *
 * QUEUED INVOCATION MODEL
 * -----------------------
 * The Playwright runner (`apps/e2e/runners/protocol-runner.ts::runProtocol`)
 * requires a live `Page` from `@playwright/test` — it can only execute inside
 * a browser-attached Node process (the e2e test harness). A capability tool
 * runs inside a Server Action / API route without a browser, so we CANNOT
 * invoke `runProtocol()` from here.
 *
 * Instead this body RECORDS THE RUN INTENT:
 *   1. ADR-0134 guard — workspace_id + profile_id resolved non-empty.
 *   2. `gate_action` RPC — ADR-0099 / ADR-0176. Fail CLOSED on RPC error.
 *   3. Load journey_version (any status — dev runs accept draft, ready_test,
 *      testing, published, archived; only `publish_*` capabilities care
 *      about status transitions).
 *   4. Load parent journey for `engine_process_id` (FK target for
 *      `engine_state.process_id`). If null → `journey_not_compiled`.
 *   5. Validate `ir_json` via `JourneyIRSchema`. Corrupt IR → `journey_ir_invalid`.
 *   6. Insert `engine_state` row (status='pending') + one `engine_state_step`
 *      per IR step (status='pending'). L-0023 — this is RUNTIME state for the
 *      dev-run lifecycle, distinct from `journey_event` dev-tracking rows.
 *   7. Emit `journey run_started` (surface='dev') and `journey step_reached`
 *      (step_index=0) to signal "intent pending, step 0 is current." Both are
 *      already registered in `packages/telemetry/src/registry.ts`.
 *
 * Return shape:
 *   Success: `{ok:true, run_id, note:"dev run queued — Playwright worker invoked out-of-band"}`
 *   Failure: `{ok:false, error:<code>, reason?:<msg>, run_id?, failed_step?}`
 *   NEVER throws — all errors surface via JSON string per the defineTool contract.
 *
 * OUT-OF-BAND WORKER (follow-up, NOT in N-C):
 *   A separate piece will poll `engine_state` rows with status='pending' +
 *   context.capability='journey.run_dev', launch Playwright, call
 *   `runProtocol(page, ir)`, then advance engine_state_step rows + emit
 *   step_reached / completed / run_failed. Tracked as follow-up.
 */
export const runDevTool = defineTool({
  name: "run_dev",
  description:
    "Queue a JourneyIR dev run against a dev build (Playwright worker out-of-band). Dev surface — emits journey run_started + step_reached.",
  capability: "journey.run_dev",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    // 1. ADR-0134 guard: workspace_id + actor_id must resolve
    // non-null/non-empty BEFORE emit or DB write (L-0066/L-0097).
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "run_dev requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // 2. ADR-0099 / ADR-0176: mandatory C4 gate. `suggest` default does not
    // mean skip-the-gate — the Wolf can flip the seed row and a bypassed
    // autonomous path is CVE-class. Fail CLOSED on RPC error.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "journey.run_dev",
      channel,
      actionType: "run_dev",
      entityId: journey_version_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        error: "capability_disabled" as const,
        reason: gate.reason ?? "denied",
      });
    }

    // 3. Load journey_version (any status accepted — dev runs do not gate
    // on journey_version_status; that's the publish_* capabilities' concern).
    const { data: versionRow, error: versionErr } = await supabase
      .from("journey_version")
      .select("journey_version_id, workspace_id, ir_json, journey_id, status")
      .eq("journey_version_id", journey_version_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (versionErr || !versionRow) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_version_not_found" as const,
        reason: versionErr?.message ?? "not_found",
      });
    }

    // 4. Load parent journey for engine_process_id (FK target for
    // engine_state.process_id). Same shape as run_guided.
    const { data: journeyRow, error: journeyErr } = await supabase
      .from("journey")
      .select("journey_id, engine_process_id")
      .eq("journey_id", versionRow.journey_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (journeyErr || !journeyRow) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_not_found" as const,
        reason: journeyErr?.message ?? "not_found",
      });
    }

    if (!journeyRow.engine_process_id) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_not_compiled" as const,
        reason:
          "journey.engine_process_id is null — compile the journey before running dev (same gate as run_guided)",
      });
    }

    // 5. Validate IR. A corrupt ir_json can't be queued deterministically.
    const parsed = JourneyIRSchema.safeParse(versionRow.ir_json);
    if (!parsed.success) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_ir_invalid" as const,
        reason: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }

    const ir = parsed.data;

    // 6. Insert engine_state — status='pending' (DB constraint vocabulary:
    // pending|active|waiting|complete|failed|escalated|blocked). 'pending'
    // distinguishes this from the `active` run_guided state machine. The
    // out-of-band Playwright worker flips status to 'active' when it picks
    // up the row, then 'complete' or 'failed' at terminal.
    const { data: stateRow, error: stateErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: journeyRow.engine_process_id,
        workspace_id: ctx.workspaceId,
        entity_type: "journey_run",
        entity_id: journey_version_id,
        assignee_id: ctx.profileId,
        status: "pending",
        current_step: 0,
        context: {
          journey_version_id,
          capability: "journey.run_dev",
          surface: "dev",
          ir_version: ir.version,
          queued_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (stateErr || !stateRow) {
      return JSON.stringify({
        ok: false as const,
        error: "engine_state_insert_failed" as const,
        reason: stateErr?.message ?? "insert_failed",
      });
    }

    const runId = stateRow.id;

    const stepRows = ir.steps.map((step, idx) => ({
      state_id: runId,
      step_order: idx,
      action_type: step.action,
      action_payload: {
        key: step.key,
        title: step.title,
        assertion: step.assertion,
        ...(step.timeoutMs ? { timeout_ms: step.timeoutMs } : {}),
      },
      status: "pending",
    }));

    if (stepRows.length > 0) {
      const { error: stepErr } = await supabase.from("engine_state_step").insert(stepRows);
      if (stepErr) {
        // Best-effort cleanup so we don't leak a half-initialised run.
        await supabase.from("engine_state").delete().eq("id", runId);
        return JSON.stringify({
          ok: false as const,
          error: "engine_state_step_insert_failed" as const,
          reason: stepErr.message,
        });
      }
    }

    // 7. Emit registered events. Two emits per gate 5:
    //   - run_started — surface='dev', links run_id to journey_version.
    //   - step_reached (index 0) — signals "queue accepted, step 0 is current."
    //     The out-of-band worker will re-emit step_reached as it advances and
    //     a terminal completed/run_failed at the end.
    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.run_dev",
        surface: "dev",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `run_dev/${journey_version_id}`,
        },
      },
    });

    const firstStepKey = ir.steps[0]?.key ?? "queued";
    await emit({
      event: "journey step_reached",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        run_id: runId,
        step_key: firstStepKey,
        step_index: 0,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `run_dev/${journey_version_id}`,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      run_id: runId,
      note: "dev run queued — Playwright worker invoked out-of-band",
    });
  },
});

/**
 * journey.publish_mission — Phase 2 body (ADR-0194 hybrid mapping).
 *
 * Contract (ADR-0194 §Rules):
 *   1. Load `journey_version` + parent `journey` within the caller's workspace.
 *      journey_version provides `ir_json` + `version_number`; journey provides
 *      the slug used to derive `engine_missions.id`.
 *   2. Validate the IR against the v2.1 publish surface via
 *      `validateV21IrForMission()`. The IR must carry a non-empty
 *      `system_prompt`, a `mode` in `{sequential,free,hybrid}`, and at least
 *      one step with `title|action|assertion`. Missing fields → structured
 *      `{ok:false, error:"validation_failed", missing_fields}` — NO emit,
 *      NO insert (ADR-0196 Invariant 11).
 *   3. Call `callGateAction()` BEFORE any mutation (ADR-0196 Invariant 13 /
 *      ADR-0099 / L-0097). `suggest` is the seeded default but the Wolf
 *      can flip it — always pass through the RPC. Deny → `capability_disabled`
 *      with no emit / no insert.
 *   4. Insert `engine_missions` row: `id := journey_<slug>_v<version_number>`,
 *      `system_prompt` + `mode` from IR, `name := ir.title`,
 *      `workspace_id := ctx.workspaceId`, `journey_id := parent journey id`,
 *      `is_active := false` (ADR-0194 Gate — author must enrich before
 *      activation).
 *   5. Insert `engine_stages` rows keyed by IR step index. Per ADR-0194 rule 2:
 *        goal := step.goal ?? step.title
 *        instructions := step.instructions ?? step.action
 *        success_criteria := step.success_criteria ?? step.assertion
 *        creative_freedom := step.creative_freedom ?? 0.2
 *        stage_order := idx
 *        stage_id := step.key (or "stage_<idx>" fallback)
 *   6. On `engine_stages` insert failure, delete the `engine_missions` row
 *      (best-effort manual rollback — Supabase PostgREST does not expose
 *      transactional inserts across tables from the client library).
 *      Return `{ok:false, error:"insert_failed", detail}` with NO emit.
 *   7. Emit `journey run_started` ONLY after both inserts commit — not
 *      before. Phantom-emit prevention (ADR-0196 Invariant 11 / L-0124 /
 *      L-0125).
 *   8. Return `{ok:true, mission_id, run_id}`.
 *
 * Binding ADRs:
 *   - 0099  callGateAction mandatory on every mutation
 *   - 0134  ADR-0134 guard — workspaceId + profileId non-empty before emit
 *   - 0173  capability name is journey.publish_mission (frozen)
 *   - 0175  "journey run_started" is the registered event key (space form)
 *   - 0176  engine_authority_config seeds gate_action with suggest default
 *   - 0194  JourneyIR v2.1 → engine_missions hybrid mapping (this body)
 *   - 0196  Invariant 11 (no phantom capabilities) + Invariant 13 (gate
 *           on every mutation regardless of authority default)
 *
 * Binding learnings:
 *   - L-0094  phantom emit contracts — this body satisfies the 5th-occurrence
 *             fix (emit is strictly after successful inserts)
 *   - L-0125  test spirit > letter — the Phase A E2E asserts the artefact
 *             (engine_missions + engine_stages rows), not just `ok:true`
 */
export const publishMissionTool = defineTool({
  name: "publish_mission",
  description:
    "Publish a JourneyIR as a runtime mission to engine_missions (is_active=false until author enrich — ADR-0194).",
  capability: "journey.publish_mission",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    // ── 1. ADR-0134 guard ────────────────────────────────────────────
    // workspaceId + profileId MUST resolve non-empty BEFORE any DB read
    // or emit. The Server Action already enforces this upstream; the
    // guard here is defense-in-depth for non-HTTP call sites (tests,
    // future cron invocations). L-0066 / L-0097.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "publish_mission requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // ── 2. Load journey_version + parent journey ─────────────────────
    // version_number feeds the engine_missions.id derivation per ADR-0194
    // rule 2; parent journey.slug is the human-readable anchor. Both reads
    // are workspace-scoped — cross-workspace publish would be refused here
    // even before the gate.
    const { data: versionRow, error: versionErr } = await supabase
      .from("journey_version")
      .select("journey_version_id, workspace_id, ir_json, journey_id, version_number")
      .eq("journey_version_id", journey_version_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (versionErr || !versionRow) {
      return JSON.stringify({
        ok: false as const,
        error: "not_found" as const,
        reason: versionErr?.message ?? "journey_version not found in workspace",
      });
    }

    const { data: journeyRow, error: journeyErr } = await supabase
      .from("journey")
      .select("journey_id, slug")
      .eq("journey_id", versionRow.journey_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (journeyErr || !journeyRow) {
      return JSON.stringify({
        ok: false as const,
        error: "not_found" as const,
        reason: journeyErr?.message ?? "parent journey not found in workspace",
      });
    }

    // ── 3. Validate IR at the publish boundary ───────────────────────
    // The v2.0.0 `JourneyIRSchema` is intentionally permissive — v2.1 publish
    // fields (`system_prompt`, `mode`) are optional at the type layer so
    // pre-v2.1 rows keep parsing. `validateV21IrForMission()` is the
    // strict-publish gate (ADR-0194). On failure: structured missing_fields
    // list, NO emit, NO insert (ADR-0196 Invariant 11 — rejection path must
    // not emit success-shaped telemetry).
    const validation = validateV21IrForMission(versionRow.ir_json);
    if (!validation.ok) {
      return JSON.stringify({
        ok: false as const,
        error: "validation_failed" as const,
        missing_fields: validation.missing_fields,
      });
    }
    const ir = validation.ir;

    // ── 4–6. Pathway A + Pathway B + domain write via mutateWithGate ──
    // ADR-0204 §3: capability authority (Pathway A) + cascade data-rule
    // (Pathway B) + domain write composed in one correlated audit chain.
    // ADR-0287 §"single mutateWithGate": both engine_missions + engine_stages
    // writes run inside the same exec callback so Pathway B's gate_evaluation
    // row correlates the entire publish operation.
    //
    // ADR-0194 rule 2: id = `journey_<slug>_v<version_number>`. slug from
    // parent journey; version_number is the DB-backed monotonic per-journey
    // sequence so re-publishes of different versions cannot collide on the
    // TEXT primary key.
    //
    // is_active=false is the ADR-0194 Gate — mission row exists (downstream
    // flows reference it) but isn't live. Author enrichment (M3) flips it.
    const missionId = `journey_${journeyRow.slug}_v${versionRow.version_number}`;

    const stageRows = ir.steps.map((step, idx) => ({
      mission_id: missionId,
      stage_id: step.key && step.key.length > 0 ? step.key : `stage_${idx}`,
      stage_order: idx,
      goal: step.goal ?? step.title,
      instructions: step.instructions ?? step.action,
      success_criteria: step.success_criteria ?? step.assertion,
      creative_freedom: step.creative_freedom ?? 0.2,
      is_required: true,
    }));

    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: "journey.publish_mission",
        actionType: "publish_mission",
        channel,
        targetId: journey_version_id,
        exec: async (db) => {
          const { error: missionInsertErr } = await db.from("engine_missions").insert({
            id: missionId,
            name: ir.title,
            description: `Published from journey_version ${journey_version_id}`,
            mode: ir.mode,
            system_prompt: ir.system_prompt,
            workspace_id: ctx.workspaceId,
            journey_id: journeyRow.journey_id,
            is_active: false,
          });
          if (missionInsertErr) {
            throw new Error(`engine_missions insert: ${missionInsertErr.message}`);
          }

          // ADR-0194 rule 2 derivation: per-stage coaching fields fall back
          // to Playwright-step summaries when author overrides are absent.
          // NOT NULL constraints on goal/instructions/success_criteria are
          // satisfied by validateV21IrForMission() confirming title + action
          // + assertion are non-empty per step.
          const { error: stagesInsertErr } = await db.from("engine_stages").insert(stageRows);
          if (stagesInsertErr) {
            // Manual rollback — PostgREST has no cross-table transaction.
            // Best-effort: delete the mission row we just inserted so a
            // retry can re-insert cleanly without colliding on the TEXT PK.
            await db.from("engine_missions").delete().eq("id", missionId);
            throw new Error(`engine_stages insert: ${stagesInsertErr.message}`);
          }

          return { missionId };
        },
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({
          ok: false as const,
          error: "authority_denied" as const,
          reason: err.message ?? "denied",
        });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({
          ok: false as const,
          error: "gate_unavailable" as const,
          detail: `${err.code}: ${err.message}`,
        });
      }
      const detail = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        ok: false as const,
        error: "insert_failed" as const,
        detail,
      });
    }

    // ── 7. Emit run_started — ONLY after successful commit ───────────
    // Phantom-emit prevention: the emit sits immediately after the last
    // successful insert. If the function returns with `ok:false` above,
    // no emit has fired. Journey Guardian greps for this ordering
    // (`.insert(...)` must precede `emit(...run_started)` by ≤ 40 lines).
    const runId = randomUUID();
    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.publish_mission",
        surface: "admin",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `publish_mission/${missionId}`,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      mission_id: missionId,
      run_id: runId,
      note: "mission published (is_active=false; author enrich before activation per ADR-0194)",
    });
  },
});

/**
 * journey.publish_guide — Phase B body (ADR-0217).
 *
 * Publishes a `JourneyIR` as a USER-GUIDE MDX document stored in the
 * `journey_guide` DB table (ADR-0217 storage decision).
 *
 * Contract (mirrors publish_mission pattern — ADR-0194 §Rules, ADR-0217):
 *   1. ADR-0134 guard: workspaceId + profileId non-empty BEFORE any DB read
 *      or emit. L-0066 / L-0097.
 *   2. Load `journey_version` (ir_json, journey_id, version_number) + parent
 *      `journey` (slug) — workspace-scoped. Cross-workspace forbidden.
 *   3. Validate IR via `validateIRForGuide()`. Requires a non-empty title +
 *      at least one step with a non-empty title. Failure → structured
 *      `{ok:false, error:"validation_failed", missing_fields}` — NO emit,
 *      NO insert (ADR-0196 Invariant 11).
 *   4. Generate MDX body via `generateGuideMdx()` — pure-function transform,
 *      no LLM call, no async (ADR-0217 §Write Path step 4).
 *   5. `callGateAction()` BEFORE the INSERT — ADR-0196 Invariant 13 /
 *      ADR-0099. `suggest` default is not a skip-the-gate license.
 *   6. Upsert into `journey_guide` on CONFLICT (journey_version_id) DO UPDATE —
 *      idempotent re-publish (ADR-0217 §Versioning).
 *   7. Emit `journey run_started` ONLY after successful upsert — ADR-0196
 *      Invariant 11. Reuses the registered event key; NO new events added
 *      (ADR-0175 / Invariant 9 Phase 2.5 grep gate).
 *   8. Return `{ok:true, guide_id, run_id, journey_version_id}`.
 *
 * Binding ADRs:
 *   - 0099  callGateAction mandatory on every mutation
 *   - 0134  workspaceId + profileId non-empty before emit
 *   - 0173  capability name journey.publish_guide (frozen)
 *   - 0175  "journey run_started" is the registered event (space-form)
 *   - 0196  Invariant 11 (no phantom capabilities) + Invariant 13 (gate first)
 *   - 0214  journey_guide table + MDX generator (normative source)
 *
 * Binding learnings:
 *   - L-0094  phantom emit contracts — emit strictly after upsert commit
 *   - L-0125  test spirit: E2E asserts journey_guide row, not just ok:true
 */
export const publishGuideTool = defineTool({
  name: "publish_guide",
  description:
    "Publish a JourneyIR as a USER-GUIDE MDX document stored in journey_guide (ADR-0217). Admin surface.",
  capability: "journey.publish_guide",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    // ── 1. ADR-0134 guard ────────────────────────────────────────────
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "publish_guide requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // ── 2. Load journey_version + parent journey ─────────────────────
    const { data: versionRow, error: versionErr } = await supabase
      .from("journey_version")
      .select("journey_version_id, workspace_id, ir_json, journey_id, version_number")
      .eq("journey_version_id", journey_version_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (versionErr || !versionRow) {
      return JSON.stringify({
        ok: false as const,
        error: "not_found" as const,
        reason: versionErr?.message ?? "journey_version not found in workspace",
      });
    }

    const { data: journeyRow, error: journeyErr } = await supabase
      .from("journey")
      .select("journey_id, slug")
      .eq("journey_id", versionRow.journey_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (journeyErr || !journeyRow) {
      return JSON.stringify({
        ok: false as const,
        error: "not_found" as const,
        reason: journeyErr?.message ?? "parent journey not found in workspace",
      });
    }

    // ── 3. Validate IR at the guide publish boundary ─────────────────
    // `validateIRForGuide()` is the strict-publish gate for guides.
    // Unlike the mission gate, guides do NOT require system_prompt/mode —
    // those are runtime-mission fields. The gate checks: non-empty title +
    // at least one step with a non-empty title. On failure: NO emit, NO
    // insert (ADR-0196 Invariant 11).
    const validation = validateIRForGuide(versionRow.ir_json);
    if (!validation.ok) {
      return JSON.stringify({
        ok: false as const,
        error: "validation_failed" as const,
        missing_fields: validation.missing_fields,
      });
    }
    const ir = validation.ir;

    // ── 4. Generate MDX body (pure-function, no LLM, no async) ───────
    // ADR-0217 §Write Path step 4: the MDX transform is deterministic.
    // `generateGuideMdx()` throws only if steps is empty — validateIRForGuide
    // guards that invariant. The try/catch here is defense-in-depth.
    let mdxContent: string;
    try {
      mdxContent = generateGuideMdx(ir);
    } catch (genErr) {
      return JSON.stringify({
        ok: false as const,
        error: "mdx_generation_failed" as const,
        reason: genErr instanceof Error ? genErr.message : "unknown",
      });
    }

    // ── 5. Authority gate — ADR-0196 Invariant 13 ────────────────────
    // MANDATORY call regardless of `suggest` default. The Wolf can flip
    // engine_authority_config; bypassing the RPC is CVE-class (L-0097).
    // Fail CLOSED on RPC error.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "journey.publish_guide",
      channel,
      actionType: "publish_guide",
      entityId: journey_version_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        error: "authority_denied" as const,
        reason: gate.reason ?? "denied",
      });
    }

    // ── 6. Upsert into journey_guide ──────────────────────────────────
    // ON CONFLICT (journey_version_id) DO UPDATE — idempotent re-publish
    // per ADR-0217 §Versioning. slug + version_number are denormalised for
    // URL routing support (/guides/<slug>/v<version_number>).
    const { data: guideRow, error: guideUpsertErr } = await supabase
      .from("journey_guide")
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          journey_version_id,
          journey_id: journeyRow.journey_id,
          slug: journeyRow.slug,
          version_number: versionRow.version_number,
          title: ir.title,
          mdx_content: mdxContent,
          is_public: false,
          created_by: ctx.profileId,
        },
        { onConflict: "journey_version_id" },
      )
      .select("id")
      .single();

    if (guideUpsertErr || !guideRow) {
      return JSON.stringify({
        ok: false as const,
        error: "insert_failed" as const,
        detail: `journey_guide upsert: ${guideUpsertErr?.message ?? "no row returned"}`,
      });
    }

    // ── 7. Emit run_started — ONLY after successful upsert ───────────
    // Phantom-emit prevention (ADR-0196 Invariant 11): the emit sits
    // immediately after the confirmed upsert. All earlier `return` paths
    // are ok:false and reach no emit call.
    // Reuses "journey run_started" — the only registered journey event
    // for this action (Invariant 9 / ADR-0175). No new event keys.
    const runId = randomUUID();
    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.publish_guide",
        surface: "admin",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `publish_guide/${journeyRow.slug}_v${versionRow.version_number}`,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      guide_id: guideRow.id,
      run_id: runId,
      journey_version_id,
    });
  },
});

/**
 * journey.run_guided — M5.1 web runtime
 *
 * Starts an agent-guided Fjernkontroll run on the web surface. Default
 * authority is `autonomous` (ADR-0173 / S1.3 seed), so this tool fires
 * direct via `tools` (not `suggestTools`) at `autonomous` level in
 * tool-selector.ts.
 *
 * Runtime contract (M5.1):
 *   1. MISSING_CONTEXT guard (ADR-0134) — workspace_id + actor_id non-empty
 *      BEFORE any emit or DB write. L-0066 / L-0097 / council R5.1-2.
 *   2. `gate_action` RPC (ADR-0099) — MANDATORY per council R5.1-3 even on
 *      an `autonomous` default, because the Wolf can flip the seed row and
 *      an unguarded autonomous tool is CVE-class. Deny → `capability_disabled`.
 *   3. Load journey_version + parent journey; validate ir_json via
 *      JourneyIRSchema (runtime can corrupt on legacy rows — fail cleanly).
 *   4. Insert engine_state row (process_id required) + one engine_state_step
 *      per IR step (status='pending'). L-0023 — this is RUNTIME state,
 *      separate from journey_event dev-tracking.
 *   5. Emit `journey run_started` (already in registry — ADR-0175).
 *
 * The Fjernkontroll UI (ADR-0177) subscribes to engine_event + engine_state
 * for live updates; `journey.stuck` is emitted by the Edge Function (M5.3),
 * NOT here.
 */
export const runGuidedTool = defineTool({
  name: "run_guided",
  description:
    "Agent-guided step-through for end users (Fjernkontroll). Runtime web surface — starts an engine_state run and emits journey run_started.",
  capability: "journey.run_guided",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    // 1. ADR-0134 guard: workspace_id + actor_id must resolve
    // non-null/non-empty BEFORE emit or DB write. Council R5.1-2.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "run_guided requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // 2. Council R5.1-3: gate_action is MANDATORY. `autonomous` default
    // is not a skip-the-gate license (L-0066/L-0097 — the Wolf can flip
    // the seed row). Fail CLOSED on any RPC error.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "journey.run_guided",
      channel,
      actionType: "run_guided",
      entityId: journey_version_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        error: "capability_disabled" as const,
        reason: gate.reason ?? "denied",
      });
    }

    // 3. Load journey_version and its parent journey. `engine_process_id`
    // on the parent journey (20260308194427_journey_engine_process_link)
    // is the FK for engine_state.process_id — required column.
    const { data: versionRow, error: versionErr } = await supabase
      .from("journey_version")
      .select("journey_version_id, workspace_id, ir_json, journey_id")
      .eq("journey_version_id", journey_version_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (versionErr || !versionRow) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_version_not_found" as const,
        reason: versionErr?.message ?? "not_found",
      });
    }

    const { data: journeyRow, error: journeyErr } = await supabase
      .from("journey")
      .select("journey_id, engine_process_id")
      .eq("journey_id", versionRow.journey_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (journeyErr || !journeyRow) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_not_found" as const,
        reason: journeyErr?.message ?? "not_found",
      });
    }

    if (!journeyRow.engine_process_id) {
      // Journey has not been compiled to an engine_process blueprint yet.
      // engine_state.process_id is NOT NULL — we cannot start a runtime
      // run without a process row. M5 scope: surface the gap, don't
      // synthesise a stub process (that would live in M4 publish_mission).
      return JSON.stringify({
        ok: false as const,
        error: "journey_not_compiled" as const,
        reason: "journey.engine_process_id is null — compile the journey before running guided",
      });
    }

    // Validate IR shape. A corrupt ir_json would crash the Fjernkontroll
    // when it hydrates steps — fail here with a clean error instead.
    const parsed = JourneyIRSchema.safeParse(versionRow.ir_json);
    if (!parsed.success) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_ir_invalid" as const,
        reason: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }

    const ir = parsed.data;

    // 3.5. Resolve active mission — Phase 3 #2 (REMEDIATION AMENDMENT).
    //
    // runGuidedTool.execute() must not insert engine_state (and must not emit
    // run_started) unless there is an active mission to back the run. This
    // closes the retraction: `is_active=true` rows from activateMissionAction
    // were previously orphaned — nothing read them during a guided run.
    //
    // Pre-resolution guard: return structured error WITHOUT emitting run_started
    // (Invariant 11 — no phantom capabilities). The BFF route also runs this
    // guard before invoking the capability (defense-in-depth per plan §callers).
    //
    // Authorization: read-only SELECT. No callGateAction (ADR-0099: mutations only).
    // workspaceId is already server-derived (ADR-0134, ADR-0176 Invariant 3).
    const missionResolution = await resolveMissionForJourneyVersion({
      journeyVersionId: journey_version_id,
      workspaceId: ctx.workspaceId,
      supabaseAdmin: supabase,
    });

    if (!missionResolution.ok) {
      switch (missionResolution.reason) {
        case "version_not_found":
          return JSON.stringify({
            ok: false as const,
            error: "version_not_found" as const,
            reason: missionResolution.detail ?? "journey_version not found in workspace",
          });
        case "not_found":
          // No active mission — the most common pre-condition failure.
          // Admin must publish_mission + enrich all stages + activateMissionAction.
          return JSON.stringify({
            ok: false as const,
            error: "no_active_mission" as const,
            message:
              "journey version has no active mission — admin must publish + activate first (ADR-0194 Gate)",
          });
        case "multiple_active":
          // Data integrity bug — two or more is_active=true rows for same journey_id.
          // Logged loudly by resolveMissionForJourneyVersion; surface as 500-class.
          console.error(
            "[runGuidedTool] Data integrity: multiple active missions. " +
              `Detail: ${missionResolution.detail ?? "see resolver log"}`,
          );
          return JSON.stringify({
            ok: false as const,
            error: "data_integrity_multiple_active_missions" as const,
            reason: missionResolution.detail,
          });
        case "stages_empty":
          return JSON.stringify({
            ok: false as const,
            error: "stages_empty" as const,
            reason: missionResolution.detail ?? "mission found but has no stages",
          });
      }
    }

    // Mission resolved — pack the 3 mission fields into engine_state.context
    // so the stage-engine's loadMission(context.mission_id) can pick up the
    // already-resolved id without a second resolution round-trip (plan §stage-engine).
    const resolvedMission = missionResolution.mission;

    // 4. Insert engine_state runtime row. L-0023: this is RUNTIME state;
    // journey_event (dev-tracking) is never touched from this path
    // (council R5.1-1). status='active' (DB constraint vocabulary:
    // pending|active|waiting|complete|failed|escalated|blocked). 'active'
    // distinguishes live guided execution from 'pending' run_dev queuing.
    const { data: stateRow, error: stateErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: journeyRow.engine_process_id,
        workspace_id: ctx.workspaceId,
        entity_type: "journey_run",
        entity_id: journey_version_id,
        assignee_id: ctx.profileId,
        status: "active",
        current_step: 0,
        context: {
          journey_version_id,
          capability: "journey.run_guided",
          surface: "runtime_web",
          ir_version: ir.version,
          // Mission resolution fields — required by stage-engine loadMission()
          // and Fjernkontroll runtime card (ADR-0177 state machine).
          mission_id: resolvedMission.id,
          mission_mode: resolvedMission.mode,
          mission_system_prompt: resolvedMission.system_prompt,
        },
      })
      .select("id")
      .single();

    if (stateErr || !stateRow) {
      return JSON.stringify({
        ok: false as const,
        error: "engine_state_insert_failed" as const,
        reason: stateErr?.message ?? "insert_failed",
      });
    }

    const runId = stateRow.id;

    // One engine_state_step per IR step, status='pending'. Step action_type
    // is whatever the IR declares — the Fjernkontroll renders per-step
    // rows keyed by step_order, and the runner (M5 follow-up) mutates
    // these on progression.
    const stepRows = ir.steps.map((step, idx) => ({
      state_id: runId,
      step_order: idx,
      action_type: step.action,
      action_payload: {
        key: step.key,
        title: step.title,
        assertion: step.assertion,
        ...(step.timeoutMs ? { timeout_ms: step.timeoutMs } : {}),
      },
      status: "pending",
    }));

    if (stepRows.length > 0) {
      const { error: stepErr } = await supabase.from("engine_state_step").insert(stepRows);
      if (stepErr) {
        // Best-effort cleanup so we don't leak a half-initialised run.
        await supabase.from("engine_state").delete().eq("id", runId);
        return JSON.stringify({
          ok: false as const,
          error: "engine_state_step_insert_failed" as const,
          reason: stepErr.message,
        });
      }
    }

    // 5. Emit registered event (council R5.1-5: no new event names).
    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.run_guided",
        surface: "runtime_web",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `run_guided/${journey_version_id}`,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      run_id: runId,
      note: "runtime started",
    });
  },
});

export const allTools = [runDevTool, publishMissionTool, publishGuideTool, runGuidedTool] as const;
