/**
 * packages/ai/src/capabilities/scheduler/tools-template.ts
 *
 * Timeline-template tools — list and apply past archived planning cycles
 * as schedule templates for a target week.
 *
 * Two tools:
 *   list_week_templates — READ-ONLY, chat+voice, no gate required.
 *   apply_week_template — WRITE, chat-only (ADR-0288), single mutateWithGate.
 *
 * ADR REFERENCES:
 *   ADR-0099  — one gate evaluation per atomic write unit
 *   ADR-0133  — mobile boundary (Compose web-only; list is read-only so voice OK)
 *   ADR-0134  — telemetry cardinality (one emit per logical event)
 *   ADR-0151  — workspace_id server-derived (ctx.workspaceId, never from body)
 *   ADR-0204  — mutateWithGate mandate for all AI-initiated writes
 *   ADR-0288  — chat-only for irreversible C4 acts (apply writes proposal)
 *   ADR-0309  — bundle proposal pattern (single row + atomic accept V1)
 *   ADR-0417  — change_proposal kind='template_apply' taxonomy + payload shape
 *   L-0177    — fail-fast on supabase error; never silent-fallback
 *   L-0247    — single mutateWithGate per tool (never in a loop)
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { mutateWithGate, MutateWithGateDenied } from "../_shared/mutate-with-gate.js";

// ─── Internal types ───────────────────────────────────────────────────────────

/** A planning cycle row as returned by the list query. */
interface TemplateCycleRow {
  planning_cycle_id: string;
  start_date: string; // DATE string "YYYY-MM-DD"
  end_date: string; // DATE string "YYYY-MM-DD"
  shift_count: number;
}

/**
 * ADR-0417 template_apply proposed_shifts[] element.
 * Mirrors REAL schedule_shift columns per Track A correction.
 * employee_id is intentionally absent — template shifts are unassigned (NULL).
 * position_id is nullable (optional in schedule_shift).
 */
interface ProposedTemplateShift {
  shift_date: string; // DATE "YYYY-MM-DD"
  role: string; // TEXT NOT NULL
  start_time: string; // TIME "HH:MM:SS"
  end_time: string; // TIME "HH:MM:SS"
  position_id: string | null; // UUID | null
  department_id: string; // UUID
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * ISO weekday from DATE string.
 * Returns 0=Mon … 6=Sun (Norwegian convention matching day_factor weekday).
 * Uses UTC date math to avoid DST ambiguity.
 */
function isoWeekdayFromDateStr(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const jsDay = d.getUTCDay(); // 0=Sun … 6=Sat
  return (jsDay + 6) % 7; // 0=Mon … 6=Sun
}

/**
 * Add N days to a DATE string ("YYYY-MM-DD") and return the result.
 * Pure UTC arithmetic — no timezone conversion.
 */
function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the number of calendar days in the half-open interval [start, end].
 * Both dates are "YYYY-MM-DD" strings.
 */
function daySpan(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

// ─── Tool 1: list_week_templates ──────────────────────────────────────────────

/**
 * list_week_templates — list past archived planning cycles available as templates.
 *
 * READ-ONLY. No gate required. Chat + voice allowed (ADR-0078: no PII exposed).
 * For each archived cycle, counts schedule_shift rows (optionally filtered by
 * department_id) so the manager can pick a cycle with enough shifts.
 */
export const listWeekTemplates = defineTool({
  name: "list_week_templates",
  capability: "scheduler",
  description:
    "List past archived planning cycles that can be used as schedule templates. " +
    "Returns each cycle with its date range and shift count. Read-only, chat+voice.",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Filter shift counts by this department. If omitted, counts all shifts in the cycle window.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum number of archived cycles to return (newest first). Default 10."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const channel = ctx.channel ?? "chat";

    // ── Fetch archived planning cycles (workspace-scoped, Law 1) ─────────────
    const { data: cycles, error: cyclesErr } = await supabase
      .from("planning_cycle")
      .select("planning_cycle_id, start_date, end_date")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "archived")
      .order("end_date", { ascending: false })
      .limit(params.limit);

    if (cyclesErr) {
      // L-0177: fail-fast, never silent-fallback
      return `Feil ved henting av maler: ${cyclesErr.message}`;
    }

    if (!cycles || cycles.length === 0) {
      void emit({
        event: "scheduler.template.listed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          result_count: 0,
          department_id: params.department_id ?? null,
          channel: channel as "chat" | "voice",
        },
      });
      return "Ingen tidligere uker å bruke som mal — ingen arkiverte planleggingssykluser funnet.";
    }

    // ── For each cycle, count schedule_shift rows in the cycle window ─────────
    const templateRows: TemplateCycleRow[] = [];
    for (const cycle of cycles) {
      let shiftQuery = supabase
        .from("schedule_shift")
        .select("schedule_shift_id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspaceId)
        .gte("shift_date", cycle.start_date)
        .lte("shift_date", cycle.end_date);

      if (params.department_id) {
        shiftQuery = shiftQuery.eq("department_id", params.department_id);
      }

      const { count, error: countErr } = await shiftQuery;

      if (countErr) {
        // Soft error — skip this cycle rather than fail the entire listing.
        continue;
      }

      templateRows.push({
        planning_cycle_id: cycle.planning_cycle_id,
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        shift_count: count ?? 0,
      });
    }

    void emit({
      event: "scheduler.template.listed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        result_count: templateRows.length,
        department_id: params.department_id ?? null,
        channel: channel as "chat" | "voice",
      },
    });

    if (templateRows.length === 0) {
      return "Ingen tilgjengelige maler med vakter funnet for dette filteret.";
    }

    // ── Build Norwegian summary ───────────────────────────────────────────────
    const lines = templateRows.map((t) => {
      const weekNum = getISOWeek(t.start_date);
      return (
        `• Uke ${weekNum} (${t.shift_count} vakter, ${t.start_date}–${t.end_date})` +
        ` [id: ${t.planning_cycle_id}]`
      );
    });

    return `Tilgjengelige maler:\n${lines.join("\n")}`;
  },
});

/**
 * ISO week number from DATE string.
 * Minimal implementation — uses Thursday-of-the-week rule.
 */
function getISOWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  // ISO week: week containing the first Thursday of year.
  // Set to nearest Thursday: current date + 4 - current ISO weekday.
  const dayOfWeek = d.getUTCDay() || 7; // 1=Mon..7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ─── Tool 2: apply_week_template ──────────────────────────────────────────────

/**
 * apply_week_template — map shifts from a source archived cycle to a target cycle.
 *
 * Chat-only per ADR-0288 (irreversible C4 act — creates change_proposal).
 * Single mutateWithGate per ADR-0287 / L-0247.
 *
 * V1 design:
 *   - Source shifts are unassigned in the template (employee_id=NULL is legal
 *     per schedule_shift schema: "Null when shift is unassigned (status=created)").
 *   - Weekday alignment: source Mon maps to target Mon, etc.
 *   - Span must match: source and target must cover the same number of days.
 *   - Target must have no existing shifts for the department (error if non-empty).
 */
export const applyWeekTemplate = defineTool({
  name: "apply_week_template",
  capability: "scheduler",
  description:
    "Apply an archived planning cycle's shifts as a template to a target week. " +
    "Creates a change_proposal (kind='template_apply') for manager review. " +
    "Manager must accept the proposal to create the actual shifts. " +
    "Manager-only, chat-only (ADR-0288, irreversible C4).",
  schema: z.object({
    source_cycle_id: z
      .string()
      .uuid()
      .describe("The archived planning cycle to copy shifts from (the template source)."),
    target_cycle_id: z
      .string()
      .uuid()
      .describe(
        "The planning cycle to apply the template to (must be draft or active, no shifts).",
      ),
    department_id: z
      .string()
      .uuid()
      .describe("Department to filter source shifts and scope the target proposal."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ── ADR-0288: chat-only guard ─────────────────────────────────────────────
    if (ctx.channel !== "chat") {
      return "apply_week_template er bare tilgjengelig i chat — ikke via stemme (ADR-0288, irreversibel C4-handling).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const channel = ctx.channel;

    // ── Load source cycle (workspace-scoped, Law 1) ───────────────────────────
    const { data: sourceCycle, error: srcCycleErr } = await supabase
      .from("planning_cycle")
      .select("planning_cycle_id, start_date, end_date, status")
      .eq("planning_cycle_id", params.source_cycle_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (srcCycleErr || !sourceCycle) {
      // L-0177: explicit error, not silent fallback
      return `Kilde-syklus ikke funnet: ${params.source_cycle_id}`;
    }

    if (sourceCycle.status !== "archived") {
      return `Kilde-syklus er ikke arkivert (status='${sourceCycle.status}') — kan ikke brukes som mal.`;
    }

    // ── Load target cycle (workspace-scoped, Law 1) ───────────────────────────
    const { data: targetCycle, error: tgtCycleErr } = await supabase
      .from("planning_cycle")
      .select("planning_cycle_id, start_date, end_date, status")
      .eq("planning_cycle_id", params.target_cycle_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (tgtCycleErr || !targetCycle) {
      return `Mål-syklus ikke funnet: ${params.target_cycle_id}`;
    }

    // ── Span check: both cycles must cover same number of days ────────────────
    const sourceSpan = daySpan(sourceCycle.start_date, sourceCycle.end_date);
    const targetSpan = daySpan(targetCycle.start_date, targetCycle.end_date);
    if (sourceSpan !== targetSpan) {
      return (
        `Kilde-uke (${sourceSpan} dager) og mål-uke (${targetSpan} dager) har ulikt antall dager — kan ikke kopiere mal. ` +
        `Bruk to sykluser med samme lengde.`
      );
    }

    // ── Load source shifts for this department ────────────────────────────────
    const { data: sourceShifts, error: srcShiftsErr } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, shift_date, role, start_time, end_time, position_id, department_id",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .gte("shift_date", sourceCycle.start_date)
      .lte("shift_date", sourceCycle.end_date);

    if (srcShiftsErr) {
      return `Feil ved henting av kilde-vakter: ${srcShiftsErr.message}`;
    }

    if (!sourceShifts || sourceShifts.length === 0) {
      return `Kilde-syklus har ingen vakter for denne avdelingen — kan ikke kopiere tom mal.`;
    }

    // ── Target pre-condition: no existing shifts for department ───────────────
    const { count: existingCount, error: existingErr } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .gte("shift_date", targetCycle.start_date)
      .lte("shift_date", targetCycle.end_date);

    if (existingErr) {
      return `Feil ved sjekk av eksisterende vakter: ${existingErr.message}`;
    }

    if ((existingCount ?? 0) > 0) {
      return (
        `Mål-syklus har allerede ${existingCount} vakter for denne avdelingen. ` +
        `Slett eksisterende vakter først, eller bruk 'legg til mal' (V2).`
      );
    }

    // ── Build proposed_shifts via weekday alignment ───────────────────────────
    // For each source shift, compute its weekday offset from source start.
    // Apply the same offset from target start to get the target shift_date.
    const proposedShifts: ProposedTemplateShift[] = sourceShifts.map((shift) => {
      const srcWeekday = isoWeekdayFromDateStr(shift.shift_date); // 0=Mon..6=Sun
      const srcStartWeekday = isoWeekdayFromDateStr(sourceCycle.start_date);
      const weekdayOffset = (srcWeekday - srcStartWeekday + 7) % 7;

      const targetShiftDate = addDaysToDateStr(targetCycle.start_date, weekdayOffset);

      return {
        shift_date: targetShiftDate,
        role: shift.role,
        start_time: shift.start_time,
        end_time: shift.end_time,
        position_id: shift.position_id ?? null,
        department_id: shift.department_id,
      };
    });

    // ── Write ONE change_proposal (ADR-0309 + ADR-0417) ──────────────────────
    // SINGLE mutateWithGate. No loop. L-0247.
    const now = new Date().toISOString();

    try {
      const { result } = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: "scheduler",
        actionType: "apply_week_template",
        channel,
        exec: async (client) => {
          // ADR-0417 payload shape. Only real schedule_shift columns per Track A correction.
          // No shift_type_id. No slot_index. Those columns do not exist in schedule_shift.
          const changesJsonb = {
            kind: "template_apply",
            template_id: params.source_cycle_id,
            applied_date_range: {
              from: targetCycle.start_date,
              to: targetCycle.end_date,
            },
            department_id: params.department_id,
            proposed_shifts: proposedShifts,
            gap_count: 0, // V1: no gap analysis — all source shifts are proposed
            applied_template_provenance: {
              applied_at: now,
              applied_by: ctx.profileId,
            },
          };

          const { data, error } = await client
            .from("change_proposal")
            .insert({
              workspace_id: ctx.workspaceId,
              initiated_by: ctx.profileId,
              kind: "template_apply",
              trigger_type: "manual_override",
              trigger_entity_type: "schedule_shift",
              trigger_entity_id: params.target_cycle_id,
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

      // ── ONE emit per logical event (ADR-0134) ─────────────────────────────
      void emit({
        event: "scheduler.template.applied",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          source_cycle_id: params.source_cycle_id,
          target_cycle_id: params.target_cycle_id,
          department_id: params.department_id,
          proposed_count: proposedShifts.length,
          change_proposal_id: result,
          channel,
        },
      });

      return (
        `Mal-forslag opprettet (proposal_id=${result}, ${proposedShifts.length} vakter foreslått). ` +
        `Gå til /dashboard/schedule/proposed-plan for å godta eller avvise. ` +
        `NB: Foreslåtte vakter er ikke tildelt — legg til ansatte etter godkjenning.`
      );
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return `Ikke tillatt: ${err.message} (capability=scheduler, actionType=apply_week_template)`;
      }
      return `Feil ved oppretting av mal-forslag: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
