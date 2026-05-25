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
  departmentId: string,
): Promise<SolverInput> {
  // ── D1: planning cycle envelope ──────────────────────────────────────────
  // L-0348 fix #5: planning_cycle schema reality —
  // - columns are start_date + end_date (DATE), NOT starts_at + ends_at (TIMESTAMPTZ)
  // - planning_cycle is workspace-scoped, NOT department-scoped (no department_id)
  // - departmentId is passed as separate param by caller (propose_plan schema)
  const { data: cycle, error: cycleErr } = await supabase
    .from("planning_cycle")
    .select("planning_cycle_id, start_date, end_date")
    .eq("workspace_id", workspaceId)
    .eq("planning_cycle_id", planningCycleId)
    .maybeSingle();

  if (cycleErr || !cycle) {
    throw new Error(`planning_cycle not found or not in workspace: ${planningCycleId}`);
  }

  // Convert DATE strings to ISO timestamps for SolverInput consumption.
  const cycleStartsAt = `${cycle.start_date}T00:00:00Z`;
  const cycleEndsAt = `${cycle.end_date}T23:59:59Z`;

  // ── D4: demand buckets via day_factor + hour_factor ──────────────────────
  // Schema reality (L-0348 fix): day_factor + hour_factor are keyed per
  // season_budget_id, NOT per (workspace, department, date). Resolve active
  // season_budget for the cycle window first; if absent, fall back to
  // factor=1.0 across all buckets (degraded but non-empty).
  //
  // Real-time POS demand (ADR-0305) deferred to V2 — day_factor is the
  // production-ready fallback per ADR-0307 spec.
  const cycleStartDate = cycle.start_date;
  const cycleEndDate = cycle.end_date;

  // Resolve active season overlapping the cycle window.
  // season has start_date + end_date (nullable for open-ended) + status enum.
  const { data: activeSeason } = await supabase
    .from("season")
    .select("season_id, start_date, end_date")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .lte("start_date", cycleEndDate)
    .or(`end_date.is.null,end_date.gte.${cycleStartDate}`)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let seasonBudgetId: string | null = null;
  if (activeSeason) {
    const { data: budget } = await supabase
      .from("season_budget")
      .select("season_budget_id")
      .eq("workspace_id", workspaceId)
      .eq("season_id", activeSeason.season_id)
      .maybeSingle();
    seasonBudgetId = budget?.season_budget_id ?? null;
  }

  // Real day_factor schema: (season_budget_id, weekday 0=Mon..6=Sun, factor).
  // Real hour_factor schema: (season_budget_id, hour 0-23, factor).
  let dayFactorRows: Array<{ weekday: number; factor: number }> = [];
  let hourFactorRows: Array<{ hour: number; factor: number }> = [];

  if (seasonBudgetId) {
    const { data: dfRows } = await supabase
      .from("day_factor")
      .select("weekday, factor")
      .eq("season_budget_id", seasonBudgetId);
    dayFactorRows = dfRows ?? [];

    const { data: hfRows } = await supabase
      .from("hour_factor")
      .select("hour, factor")
      .eq("season_budget_id", seasonBudgetId);
    hourFactorRows = hfRows ?? [];
  }

  // Build 1-hour demand buckets from day × hour factors.
  // baseline_headcount = 2 (configurable V2 per ADR-0418 D5 Concept derivation;
  // V1 uses 2 as sensible starting point).
  const BASELINE_HEADCOUNT = 2;
  const demand_buckets: DemandBucket[] = [];

  const startDate = new Date(cycleStartsAt);
  const endDate = new Date(cycleEndsAt);

  for (let d = new Date(startDate); d < endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    // Weekday convention: day_factor uses 0=Mon..6=Sun (Norwegian) per migration
    // 20260306100000_season_planning_tables.sql. JS getUTCDay() is 0=Sun..6=Sat.
    // Convert: (jsDay + 6) % 7.
    const jsDay = d.getUTCDay();
    const weekday = (jsDay + 6) % 7;

    const dayFactor = dayFactorRows.find((df) => df.weekday === weekday)?.factor ?? 1.0;

    for (let h = 0; h < 24; h++) {
      const hourFactor = hourFactorRows.find((hf) => hf.hour === h)?.factor ?? 1.0;

      const score = BASELINE_HEADCOUNT * dayFactor * hourFactor;
      if (score < 0.5) continue; // Skip near-zero demand buckets

      const startHour = `${dateStr}T${String(h).padStart(2, "0")}:00:00Z`;
      const endHour = `${dateStr}T${String(h + 1).padStart(2, "0")}:00:00Z`;

      demand_buckets.push({
        department_id: departmentId,
        start_at: startHour,
        end_at: endHour,
        score,
        position_id: departmentId, // V1: position_id = department_id (V2 uses positions table)
        role: "employee", // V1 default role; V2 uses position.role
      });
    }
  }

  // ── D2: active profiles with employment contracts ────────────────────────
  // L-0348 fix: profile column is `status` (profile_status enum), NOT
  // `employment_status`. Map to solver-interface field name below.
  // Trainee paired-only treatment deferred to ADR-0419 separate sortie —
  // for now, only status='active' qualifies (current behavior preserved).
  const { data: profileRows } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, status, display_name")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  const { data: contractRows } = await supabase
    .from("employment_contract")
    .select("profile_id, contract_id, start_date, end_date, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  // ── D6: existing shifts in cycle window ───────────────────────────────────
  // L-0348 fix: schedule_shift columns are `shift_date` + `employee_id`,
  // NOT `date` + `profile_id`. employee_id FKs to profile.profile_id.
  const { data: existingShiftRows } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id, employee_id, start_time, end_time, shift_date")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .gte("shift_date", cycleStartDate)
    .lte("shift_date", cycleEndDate)
    .not("employee_id", "is", null);

  // ── D2: absences in cycle window ──────────────────────────────────────────
  const { data: absenceRows } = await supabase
    .from("schedule_absence")
    .select("absence_id, profile_id, start_at, end_at")
    .eq("workspace_id", workspaceId)
    .gte("end_at", cycleStartsAt)
    .lte("start_at", cycleEndsAt);

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
  // L-0348 fix: column refs updated to shift_date + employee_id.
  const existing_shifts: ExistingShift[] = (existingShiftRows ?? []).map((s) => ({
    shift_id: s.schedule_shift_id,
    start_at: `${s.shift_date}T${s.start_time}Z`,
    end_at: `${s.shift_date}T${s.end_time}Z`,
    duration_hours:
      (new Date(`${s.shift_date}T${s.end_time}Z`).getTime() -
        new Date(`${s.shift_date}T${s.start_time}Z`).getTime()) /
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

    // Join via employee_id (DB column on schedule_shift) to p.profile_id.
    const profileShifts = existing_shifts.filter((s) =>
      existingShiftRows?.some(
        (r) => r.schedule_shift_id === s.shift_id && r.employee_id === p.profile_id,
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
        // Map DB profile.status (profile_status enum) → solver-interface
        // employment_status string. Both 'active' values align; trainee
        // profiles excluded by filter above per ADR-0419 deferred.
        employment_status: p.status,
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
      department_id: departmentId,
      starts_at: cycleStartsAt,
      ends_at: cycleEndsAt,
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
  capability: "scheduler",
  description:
    "Run the greedy constraint-solver on a planning cycle and write a schedule proposal for manager review. Manager-only, chat-only. Web surface (Compose verb).",
  schema: z.object({
    planning_cycle_id: z
      .string()
      .uuid()
      .describe("The planning cycle to schedule. Solver reads D2+D3+D4+D6 context for this cycle."),
    department_id: z
      .string()
      .uuid()
      .describe(
        "Department to schedule. planning_cycle is workspace-scoped; department is required to scope D2/D6 reads + bucket scoring.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ── ADR-0288: chat-only guard ─────────────────────────────────────────
    if (ctx.channel !== "chat") {
      return "propose_plan er bare tilgjengelig i chat — ikke via stemme (ADR-0288, irreversibel C4-handling).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // ── Load cascade context (workspace-scoped per Law 1) ─────────────────
    let solverInput: SolverInput;
    try {
      solverInput = await loadSolverContext(
        supabase,
        ctx.workspaceId,
        params.planning_cycle_id,
        params.department_id,
      );
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
  capability: "scheduler",
  description:
    "Accept a scheduler proposal (kind=scheduler_bundle or kind=template_apply). Atomically inserts all proposed shifts and marks the proposal as applied. Manager-only, chat-only. Mobile-allowed (Approve verb).",
  schema: z.object({
    change_proposal_id: z
      .string()
      .uuid()
      .describe(
        "The proposal to accept. Supports kind=scheduler_bundle (greedy solver) and kind=template_apply (week-template, ADR-0417).",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ── ADR-0288: chat-only guard ─────────────────────────────────────────
    if (ctx.channel !== "chat") {
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
            .select("change_proposal_id, workspace_id, status, kind, changes, trigger_entity_id")
            .eq("change_proposal_id", params.change_proposal_id)
            .eq("workspace_id", ctx.workspaceId) // Law 1: workspace scope
            .maybeSingle();

          if (fetchErr || !proposal) {
            throw new Error(`Proposal not found: ${params.change_proposal_id}`);
          }

          // ── Kind check — branch on supported kinds (ADR-0417) ────────
          // Supported: scheduler_bundle (ADR-0309) + template_apply (ADR-0417).
          // Any other kind is an explicit error (L-0177: fail-fast, no silent skip).
          if (proposal.kind !== "scheduler_bundle" && proposal.kind !== "template_apply") {
            throw new Error(
              `Proposal kind is '${proposal.kind}', expected 'scheduler_bundle' or 'template_apply'`,
            );
          }

          // ── State precondition (only pending can be accepted) ─────────
          if (proposal.status !== "pending") {
            throw new Error(
              `Proposal status is '${proposal.status}' — only 'pending' proposals can be accepted`,
            );
          }

          const now = new Date().toISOString();
          let shiftRows: Array<Record<string, unknown>> = [];
          let solverRunId = "";

          if (proposal.kind === "scheduler_bundle") {
            // ── scheduler_bundle path (ADR-0309) ──────────────────────
            // Parse proposed_shifts from JSONB — solver shape uses start_at/end_at ISO strings.
            const changes = proposal.changes as {
              solver_run_id?: string;
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
            solverRunId = changes.solver_run_id ?? "";

            // Build schedule_shift rows from proposed_shifts JSONB.
            // DB columns per database.types.ts:
            //   shift_date (DATE), employee_id (profile_id), day_category required enum.
            shiftRows = proposedShifts.map((ps) => ({
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
          } else {
            // ── template_apply path (ADR-0417) ────────────────────────
            // Payload shape: { kind, template_id, applied_date_range, department_id,
            //   proposed_shifts[]: [{ shift_date, role, start_time, end_time,
            //                         position_id?, department_id }],
            //   gap_count, applied_template_provenance }
            const changes = proposal.changes as {
              kind: "template_apply";
              template_id: string;
              applied_date_range: { from: string; to: string };
              department_id: string;
              proposed_shifts?: Array<{
                shift_date: string;
                role: string;
                start_time: string;
                end_time: string;
                position_id?: string | null;
                department_id: string;
              }>;
              gap_count: number;
              applied_template_provenance: {
                applied_at: string;
                applied_by: string;
              };
            };

            const proposedShifts = changes?.proposed_shifts ?? [];

            // Build schedule_shift rows from template_apply proposed_shifts.
            // employee_id=NULL: template shifts are unassigned — manager assigns post-accept.
            // (ADR-0417 Consequences: "employee_id=NULL (unassigned; manager assigns post-accept)")
            shiftRows = proposedShifts.map((ps) => ({
              workspace_id: ctx.workspaceId,
              department_id: ps.department_id,
              employee_id: null, // Unassigned — manager assigns per ADR-0417
              shift_date: ps.shift_date,
              start_time: ps.start_time,
              end_time: ps.end_time,
              role: ps.role,
              position_id: ps.position_id ?? null,
              day_category: "morning" as const, // V1 placeholder; V2 derives from shift time
              status: "published" as const,
              source: "template_apply",
              notes: `Fra mal (source=${changes.template_id}, proposal_id=${params.change_proposal_id})`,
              created_at: now,
              updated_at: now,
            }));
          }

          // ── INSERT all proposed shifts (atomic with status UPDATE) ────
          if (shiftRows.length > 0) {
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
            shifts_inserted: shiftRows.length,
            planning_cycle_id: proposal.trigger_entity_id,
            solver_run_id: solverRunId,
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
            solver_run_id: result.solver_run_id,
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
  capability: "scheduler",
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
    if (ctx.channel !== "chat") {
      return "reject_proposal er bare tilgjengelig i chat — ikke via stemme (ADR-0288, irreversibel C4-handling).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    try {
      const { result } = await mutateWithGate(supabase, {
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
            .select("change_proposal_id, workspace_id, status, kind, changes")
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

          const rejChanges = proposal.changes as { solver_run_id?: string } | null;
          return { rejected: true, solver_run_id: rejChanges?.solver_run_id ?? "" };
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
            solver_run_id: result.solver_run_id,
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
