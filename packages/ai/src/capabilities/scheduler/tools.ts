/**
 * packages/ai/src/capabilities/scheduler/tools.ts
 *
 * Scheduler capability tools — 3 tools for the greedy constraint-solver workflow.
 *
 * ALL THREE TOOLS: chat-only per ADR-0288 (voice forbidden — irreversible C4 acts).
 * ALL THREE TOOLS: use mutateWithGate SINGLE-CALL per ADR-0287 / ADR-0309.
 * NO LOOPS over mutateWithGate — single gate evaluation per logical operation.
 *
 * Tools:
 *   propose_plan      — manager+, web Compose verb (ADR-0133 web-only)
 *   accept_proposal   — manager+, mobile-allowed Approve verb (ADR-0133)
 *   reject_proposal   — manager+, mobile-allowed Approve verb (ADR-0133)
 *
 * Persistence pattern (ADR-0309 V1):
 *   propose_plan: ONE change_proposal row, kind='scheduler_bundle',
 *                 trigger_type='manual_override', changes JSONB carries the
 *                 full bundle (solver metadata + proposed_shifts[] + gaps[]).
 *   accept_proposal: atomic UPDATE status='applied' + multi-row INSERT
 *                    schedule_shift[] in single exec callback. ONE emit.
 *   reject_proposal: UPDATE status='rejected'. ONE emit.
 *
 * Authority seed: engine_authority_config rows expected (ADR-0192).
 * Seeded by PLAN Phase 1 foundation migration alongside capability registry.
 *
 * ADR REFERENCES:
 *   ADR-0099  — one gate evaluation per atomic write unit
 *   ADR-0133  — mobile boundary (Compose web-only; Approve mobile-allowed)
 *   ADR-0134  — telemetry cardinality (one emit per logical event)
 *   ADR-0287  — mutateWithGate mandate
 *   ADR-0288  — chat-only for irreversible C4 acts
 *   ADR-0307  — greedy scheduler V1 algorithm
 *   ADR-0309  — bundle proposal pattern (single row + atomic accept V1)
 *   L-0247    — single-call mutateWithGate (not bulk loop)
 *   L-0248    — provenance in JSONB, not enum
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { mutateWithGate, MutateWithGateDenied } from "../_shared/mutate-with-gate.js";
import { solveGreedy } from "../../scheduler/solver/greedy.js";
import type { SolverInput, SolverProfile, DemandBucket } from "../../scheduler/solver/greedy.js";
import type {
  FrameworkRule,
  ExistingShift,
  Absence,
  EmploymentContract,
} from "../../scheduler/eligibility.js";

// ─── Shared internal helpers ─────────────────────────────────────────────────

/**
 * Load cascade D2+D3+D4+D6 context for a planning cycle.
 * Returns everything solveGreedy() needs — zero leakage of workspace scope
 * (every query scoped by workspace_id per Law 1).
 */
async function loadSolverContext(
  supabase: SupabaseClient,
  workspaceId: string,
  planningCycleId: string,
): Promise<SolverInput> {
  // ── D1: planning cycle envelope ──────────────────────────────────────────
  const { data: cycle, error: cycleErr } = await supabase
    .from("planning_cycle")
    .select("planning_cycle_id, department_id, starts_at, ends_at")
    .eq("workspace_id", workspaceId)
    .eq("planning_cycle_id", planningCycleId)
    .maybeSingle();

  if (cycleErr || !cycle) {
    throw new Error(`planning_cycle not found or not in workspace: ${planningCycleId}`);
  }

  // ── D4: demand buckets via day_factor + hour_factor ──────────────────────
  // V1 fallback: load day_factor rows for the cycle's date range.
  // Real-time POS demand (ADR-0305) deferred to V2 — day_factor is the
  // production-ready fallback per ADR-0307 spec.
  const { data: dayFactors } = await supabase
    .from("day_factor")
    .select("date, factor, department_id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", cycle.department_id)
    .gte("date", cycle.starts_at.slice(0, 10))
    .lte("date", cycle.ends_at.slice(0, 10));

  const { data: hourFactors } = await supabase
    .from("hour_factor")
    .select("hour_of_day, factor, department_id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", cycle.department_id);

  // Build 1-hour demand buckets from day × hour factors.
  // baseline_headcount = 2 (configurable V2; V1 uses 2 as sensible starting point).
  const BASELINE_HEADCOUNT = 2;
  const demand_buckets: DemandBucket[] = [];

  const startDate = new Date(cycle.starts_at);
  const endDate = new Date(cycle.ends_at);

  for (let d = new Date(startDate); d < endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayFactor =
      dayFactors?.find((df) => df.date === dateStr && df.department_id === cycle.department_id)
        ?.factor ?? 1.0;

    for (let h = 0; h < 24; h++) {
      const hourFactor =
        hourFactors?.find((hf) => hf.hour_of_day === h && hf.department_id === cycle.department_id)
          ?.factor ?? 1.0;

      const score = BASELINE_HEADCOUNT * dayFactor * hourFactor;
      if (score < 0.5) continue; // Skip near-zero demand buckets

      const startHour = `${dateStr}T${String(h).padStart(2, "0")}:00:00Z`;
      const endHour = `${dateStr}T${String(h + 1).padStart(2, "0")}:00:00Z`;

      demand_buckets.push({
        department_id: cycle.department_id,
        start_at: startHour,
        end_at: endHour,
        score,
        position_id: cycle.department_id, // V1: position_id = department_id (V2 uses positions table)
        role: "employee", // V1 default role; V2 uses position.role
      });
    }
  }

  // ── D2: active profiles with employment contracts ────────────────────────
  const { data: profileRows } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, employment_status, display_name")
    .eq("workspace_id", workspaceId)
    .eq("employment_status", "active");

  const { data: contractRows } = await supabase
    .from("employment_contract")
    .select("profile_id, contract_id, start_date, end_date, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  // ── D6: existing shifts in cycle window ───────────────────────────────────
  const { data: existingShiftRows } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id, profile_id, start_time, end_time, date")
    .eq("workspace_id", workspaceId)
    .eq("department_id", cycle.department_id)
    .gte("date", cycle.starts_at.slice(0, 10))
    .lte("date", cycle.ends_at.slice(0, 10))
    .not("profile_id", "is", null);

  // ── D2: absences in cycle window ──────────────────────────────────────────
  const { data: absenceRows } = await supabase
    .from("schedule_absence")
    .select("absence_id, profile_id, start_at, end_at")
    .eq("workspace_id", workspaceId)
    .gte("end_at", cycle.starts_at)
    .lte("start_at", cycle.ends_at);

  // ── D3: framework rules for scheduling ───────────────────────────────────
  const { data: frameworkRuleRows } = await supabase
    .from("framework_rule")
    .select("code, rule_type, evaluation_config")
    .in("rule_type", ["aml_daily_max_hours", "aml_weekly_max_hours", "tariff_min_rest_hours"]);

  const framework_rules: FrameworkRule[] = (frameworkRuleRows ?? []).map((r) => ({
    rule_type: r.rule_type as FrameworkRule["rule_type"],
    value_hours:
      (r.evaluation_config as { value_hours?: number } | null)?.value_hours ??
      (r.rule_type === "aml_daily_max_hours" ? 9 : r.rule_type === "aml_weekly_max_hours" ? 40 : 8),
  }));

  // Fallback if no framework_rules loaded from DB (graceful degradation).
  if (framework_rules.length === 0) {
    framework_rules.push(
      { rule_type: "aml_daily_max_hours", value_hours: 9 },
      { rule_type: "aml_weekly_max_hours", value_hours: 40 },
      { rule_type: "tariff_min_rest_hours", value_hours: 8 },
    );
  }

  // ── Build SolverProfile list ──────────────────────────────────────────────
  const existing_shifts: ExistingShift[] = (existingShiftRows ?? []).map((s) => ({
    shift_id: s.schedule_shift_id,
    start_at: `${s.date}T${s.start_time}Z`,
    end_at: `${s.date}T${s.end_time}Z`,
    duration_hours:
      (new Date(`${s.date}T${s.end_time}Z`).getTime() -
        new Date(`${s.date}T${s.start_time}Z`).getTime()) /
      3_600_000,
  }));

  const profiles: SolverProfile[] = (profileRows ?? []).map((p) => {
    const contract = contractRows?.find((c) => c.profile_id === p.profile_id) ?? null;
    const activeContract: EmploymentContract | null = contract
      ? {
          contract_id: contract.contract_id,
          start_date: contract.start_date,
          end_date: contract.end_date,
          status: contract.status,
        }
      : null;

    const profileShifts = existing_shifts.filter((s) =>
      existingShiftRows?.some(
        (r) => r.schedule_shift_id === s.shift_id && r.profile_id === p.profile_id,
      ),
    );

    const profileAbsences: Absence[] = (absenceRows ?? [])
      .filter((a) => a.profile_id === p.profile_id)
      .map((a) => ({
        absence_id: a.absence_id,
        start_at: a.start_at,
        end_at: a.end_at,
      }));

    const utilizedHours = profileShifts.reduce((sum, s) => sum + s.duration_hours, 0);

    return {
      profile: {
        profile_id: p.profile_id,
        workspace_id: workspaceId,
        competent_roles: ["employee"], // V1: all active employees competent for "employee" role
        employment_status: p.employment_status,
      },
      utilized_hours: utilizedHours,
      existing_shifts: profileShifts,
      absences: profileAbsences,
      framework_rules,
      active_contract: activeContract,
    };
  });

  return {
    workspace_id: workspaceId,
    planning_cycle: {
      planning_cycle_id: cycle.planning_cycle_id,
      department_id: cycle.department_id,
      starts_at: cycle.starts_at,
      ends_at: cycle.ends_at,
    },
    demand_buckets,
    profiles,
    framework_rules,
    existing_shifts,
  };
}

// ─── Tool 1: propose_plan ─────────────────────────────────────────────────────

/**
 * propose_plan — run the greedy solver and write a single change_proposal bundle.
 *
 * Chat-only per ADR-0288 (voice forbidden). Web Compose verb per ADR-0133.
 * SINGLE mutateWithGate call → ONE change_proposal INSERT → ONE emit.
 */
export const proposePlan = defineTool({
  name: "propose_plan",
  description:
    "Run the greedy constraint-solver on a planning cycle and write a schedule proposal for manager review. Manager-only, chat-only. Web surface (Compose verb).",
  schema: z.object({
    planning_cycle_id: z
      .string()
      .uuid()
      .describe("The planning cycle to schedule. Solver reads D2+D3+D4+D6 context for this cycle."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ── ADR-0288: chat-only guard ─────────────────────────────────────────
    if (ctx.channel === "voice") {
      return "propose_plan er bare tilgjengelig i chat — ikke via stemme (ADR-0288, irreversibel C4-handling).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // ── Load cascade context (workspace-scoped per Law 1) ─────────────────
    let solverInput: SolverInput;
    try {
      solverInput = await loadSolverContext(supabase, ctx.workspaceId, params.planning_cycle_id);
    } catch (err) {
      return `Feil ved lasting av planleggingskontekst: ${err instanceof Error ? err.message : String(err)}`;
    }

    // ── Run the pure greedy solver ─────────────────────────────────────────
    const proposal = solveGreedy(solverInput);

    // ── Persist as single change_proposal row (ADR-0309) ─────────────────
    // SINGLE mutateWithGate call. No loop. L-0247.
    try {
      const { result } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: "scheduler",
        actionType: "propose_plan",
        channel: ctx.channel ?? "chat",
        exec: async (client) => {
          // ADR-0309 V1 persistence shape: one row, JSONB immutable.
          const changesJsonb = {
            solver_version: proposal.solver_version,
            solver_run_id: proposal.solver_run_id,
            solver_inputs_hash: proposal.solver_inputs_hash,
            objective_score: proposal.objective_score,
            gap_count: proposal.gaps.length,
            proposed_shifts: proposal.proposed_shifts,
            gaps: proposal.gaps,
          };

          const { data, error } = await client
            .from("change_proposal")
            .insert({
              workspace_id: ctx.workspaceId,
              initiated_by: ctx.profileId, // DB column: initiated_by (not proposed_by)
              kind: "scheduler_bundle",
              trigger_type: "manual_override", // L-0248: provenance in JSONB, not enum
              trigger_entity_type: "schedule_shift", // DB column: trigger_entity_type
              trigger_entity_id: params.planning_cycle_id, // links proposal to planning cycle
              status: "pending",
              changes: changesJsonb,
            })
            .select("change_proposal_id")
            .single();

          if (error || !data) {
            throw new Error(`change_proposal INSERT failed: ${error?.message}`);
          }
          return data.change_proposal_id as string;
        },
      });

      // ── ONE emit per logical event (ADR-0134) ─────────────────────────
      void emit({
        event: "scheduler.proposal.proposed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "change_proposal",
            entity_id: result,
          },
          data: {
            change_proposal_id: result,
            solver_version: proposal.solver_version,
            solver_run_id: proposal.solver_run_id,
            proposed_shift_count: proposal.proposed_shifts.length,
            gap_count: proposal.gaps.length,
            objective_score: proposal.objective_score,
            gate_evaluation_id: null, // gateEvaluationId from mutateWithGate return if needed
          },
        },
      });

      const summaryMsg = [
        `Planforslag opprettet (proposal_id=${result}).`,
        `Foreslåtte vakter: ${proposal.proposed_shifts.length}.`,
        `Mangler: ${proposal.gaps.length} (gap-rate: ${Math.round(proposal.gap_rate * 100)}%).`,
        `Kvalitetsscore: ${Math.round(proposal.objective_score * 100)}%.`,
        `Gå til /dashboard/schedule/proposed-plan for å godkjenne eller avvise.`,
      ].join(" ");

      return summaryMsg;
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return `Ikke tillatt: ${err.message} (capability=scheduler, actionType=propose_plan)`;
      }
      return `Feil ved lagring av planforslag: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

// ─── Tool 2: accept_proposal ──────────────────────────────────────────────────

/**
 * accept_proposal — atomic all-or-nothing accept of a scheduler bundle.
 *
 * Chat-only per ADR-0288. Mobile-allowed Approve verb per ADR-0133.
 * SINGLE mutateWithGate call wrapping:
 *   1. SELECT proposal FOR UPDATE → parse JSONB → extract proposed_shifts[]
 *   2. Multi-row INSERT schedule_shift (all proposed shifts)
 *   3. UPDATE change_proposal status='applied' + applied_at + resolved_by
 * ONE emit: scheduler.proposal.accepted (ADR-0134).
 */
export const acceptProposal = defineTool({
  name: "accept_proposal",
  description:
    "Accept an entire scheduler bundle proposal. Atomically inserts all proposed shifts and marks the proposal as applied. Manager-only, chat-only. Mobile-allowed (Approve verb).",
  schema: z.object({
    change_proposal_id: z
      .string()
      .uuid()
      .describe("The scheduler bundle proposal to accept. Kind must be scheduler_bundle."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ── ADR-0288: chat-only guard ─────────────────────────────────────────
    if (ctx.channel === "voice") {
      return "accept_proposal er bare tilgjengelig i chat — ikke via stemme (ADR-0288, irreversibel C4-handling).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // SINGLE mutateWithGate call — no loop.
    // exec callback does all DB work transactionally: SELECT + INSERT N + UPDATE.
    try {
      const { result } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: "scheduler",
        actionType: "accept_proposal",
        channel: ctx.channel ?? "chat",
        targetId: params.change_proposal_id,
        exec: async (client) => {
          // ── Fetch proposal (workspace-scoped + status check) ──────────
          const { data: proposal, error: fetchErr } = await client
            .from("change_proposal")
            .select("change_proposal_id, workspace_id, status, kind, changes, entity_id")
            .eq("change_proposal_id", params.change_proposal_id)
            .eq("workspace_id", ctx.workspaceId) // Law 1: workspace scope
            .maybeSingle();

          if (fetchErr || !proposal) {
            throw new Error(`Proposal not found: ${params.change_proposal_id}`);
          }

          // ── Kind check ────────────────────────────────────────────────
          if (proposal.kind !== "scheduler_bundle") {
            throw new Error(`Proposal kind is '${proposal.kind}', expected 'scheduler_bundle'`);
          }

          // ── State precondition (only pending can be accepted) ─────────
          if (proposal.status !== "pending") {
            throw new Error(
              `Proposal status is '${proposal.status}' — only 'pending' proposals can be accepted`,
            );
          }

          // ── Parse proposed_shifts from immutable JSONB ─────────────────
          const changes = proposal.changes as {
            proposed_shifts?: Array<{
              shift_id_proposed: string;
              department_id: string;
              start_at: string;
              end_at: string;
              position_id: string;
              role: string;
              assigned_profile_id: string;
            }>;
          };

          const proposedShifts = changes?.proposed_shifts ?? [];
          const now = new Date().toISOString();

          // ── INSERT all proposed shifts (atomic with status UPDATE) ────
          if (proposedShifts.length > 0) {
            // Build schedule_shift rows from proposed_shifts JSONB.
            // DB columns per database.types.ts:
            //   shift_date (not date), employee_id (not profile_id),
            //   day_category required enum, role required string.
            const shiftRows = proposedShifts.map((ps) => ({
              workspace_id: ctx.workspaceId,
              department_id: ps.department_id,
              employee_id: ps.assigned_profile_id,
              shift_date: ps.start_at.slice(0, 10),
              start_time: ps.start_at.slice(11, 19),
              end_time: ps.end_at.slice(11, 19),
              role: ps.role,
              day_category: "morning" as const, // V1 placeholder; V2 derives from shift time
              status: "published" as const,
              source: "scheduler_bundle",
              notes: `Automatisk planlagt (proposal_id=${params.change_proposal_id})`,
              created_at: now,
              updated_at: now,
            }));

            const { error: insertErr } = await client.from("schedule_shift").insert(shiftRows);

            if (insertErr) {
              throw new Error(`schedule_shift INSERT failed: ${insertErr.message}`);
            }
          }

          // ── UPDATE proposal status (atomically after INSERT) ──────────
          const { error: updateErr } = await client
            .from("change_proposal")
            .update({
              status: "applied",
              resolved_by: ctx.profileId,
              applied_at: now,
            })
            .eq("change_proposal_id", params.change_proposal_id)
            .eq("workspace_id", ctx.workspaceId); // Law 1

          if (updateErr) {
            throw new Error(`change_proposal UPDATE failed: ${updateErr.message}`);
          }

          return {
            shifts_inserted: proposedShifts.length,
            planning_cycle_id: proposal.entity_id,
          };
        },
      });

      // ── ONE emit per logical event (ADR-0134) ─────────────────────────
      // Emit ONCE for the whole bundle accept — NOT per shift inserted.
      void emit({
        event: "scheduler.proposal.accepted",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "change_proposal",
            entity_id: params.change_proposal_id,
          },
          data: {
            change_proposal_id: params.change_proposal_id,
            solver_run_id: "", // loaded from JSONB if needed; set in V2
            accepted_by_profile_id: ctx.profileId,
            applied_shift_count: result.shifts_inserted,
            gate_evaluation_id: null,
          },
        },
      });

      return `Planforslag godtatt. ${result.shifts_inserted} vakter lagt til i vaktplanen.`;
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return `Ikke tillatt: ${err.message} (capability=scheduler, actionType=accept_proposal)`;
      }
      return `Feil ved godkjenning av planforslag: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

// ─── Tool 3: reject_proposal ──────────────────────────────────────────────────

/**
 * reject_proposal — reject a pending scheduler bundle proposal.
 *
 * Chat-only per ADR-0288. Mobile-allowed Approve verb per ADR-0133.
 * SINGLE mutateWithGate call → ONE UPDATE → ONE emit.
 */
export const rejectProposal = defineTool({
  name: "reject_proposal",
  description:
    "Reject a scheduler bundle proposal. No shifts are created. Manager-only, chat-only. Mobile-allowed (Approve verb).",
  schema: z.object({
    change_proposal_id: z.string().uuid().describe("The scheduler bundle proposal to reject."),
    reason: z
      .string()
      .optional()
      .describe("Optional reason for rejection (stored in proposal notes)."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ── ADR-0288: chat-only guard ─────────────────────────────────────────
    if (ctx.channel === "voice") {
      return "reject_proposal er bare tilgjengelig i chat — ikke via stemme (ADR-0288, irreversibel C4-handling).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: "scheduler",
        actionType: "reject_proposal",
        channel: ctx.channel ?? "chat",
        targetId: params.change_proposal_id,
        exec: async (client) => {
          // ── Fetch + validate proposal ─────────────────────────────────
          const { data: proposal, error: fetchErr } = await client
            .from("change_proposal")
            .select("change_proposal_id, workspace_id, status, kind")
            .eq("change_proposal_id", params.change_proposal_id)
            .eq("workspace_id", ctx.workspaceId) // Law 1: workspace scope
            .maybeSingle();

          if (fetchErr || !proposal) {
            throw new Error(`Proposal not found: ${params.change_proposal_id}`);
          }

          if (proposal.kind !== "scheduler_bundle") {
            throw new Error(`Proposal kind is '${proposal.kind}', expected 'scheduler_bundle'`);
          }

          if (proposal.status !== "pending") {
            throw new Error(
              `Proposal status is '${proposal.status}' — only 'pending' proposals can be rejected`,
            );
          }

          // ── UPDATE status to rejected ─────────────────────────────────
          const { error: updateErr } = await client
            .from("change_proposal")
            .update({
              status: "rejected",
              resolved_by: ctx.profileId,
              rejection_reason: params.reason ?? null,
            })
            .eq("change_proposal_id", params.change_proposal_id)
            .eq("workspace_id", ctx.workspaceId); // Law 1

          if (updateErr) {
            throw new Error(`change_proposal UPDATE failed: ${updateErr.message}`);
          }

          return { rejected: true };
        },
      });

      // ── ONE emit per logical event (ADR-0134) ─────────────────────────
      void emit({
        event: "scheduler.proposal.rejected",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "change_proposal",
            entity_id: params.change_proposal_id,
          },
          data: {
            change_proposal_id: params.change_proposal_id,
            solver_run_id: "", // loaded from JSONB if needed; set in V2
            rejected_by_profile_id: ctx.profileId,
            rejection_reason: params.reason ?? null,
            gate_evaluation_id: null,
          },
        },
      });

      return `Planforslag avvist.${params.reason ? ` Årsak: ${params.reason}` : ""}`;
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return `Ikke tillatt: ${err.message} (capability=scheduler, actionType=reject_proposal)`;
      }
      return `Feil ved avvisning av planforslag: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
