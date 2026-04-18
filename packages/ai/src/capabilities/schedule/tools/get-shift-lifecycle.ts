// packages/ai/src/capabilities/schedule/tools/get-shift-lifecycle.ts
//
// WS-A5: Read-only projection of a shift's phase across the ADR-0095
// five-layer lifecycle (Execution/Reality/Interpretation/Derivation/Decision).
//
// Queries public.v_shift_lifecycle (20260508100000). Employee-safe:
// gross_cost is OMITTED from the response — that field is admin-only and
// belongs to the C3 Commercial plane (ADR-0099 separation of concerns).
//
// allowedChannels: chat, voice, system. Read-only tools are voice-safe
// per ADR-0078 (no PII, no mutation, no regulated data exposure).

import { z } from "zod";
import { defineTool } from "../../../types.js";
import type { AgentToolContext } from "../../types.js";

type ShiftLifecycleRow = {
  shift_id: string;
  phase: "planlegges" | "pagar" | "oppgjor" | "avsluttet";
  scheduled_hours: number | null;
  interpreted_hours: number | null;
  approved_hours: number | null;
  last_punch_in: string | null;
  last_punch_out: string | null;
  has_deviation: boolean;
  has_blocking_deviation: boolean;
};

// Phenomenological phase labels (ADR-0095 R2). Not hardcoded into UI —
// kept here as i18n keys so consumers can localise. Norwegian defaults
// match the four-phase vocabulary used across the product.
const PHASE_LABELS: Record<ShiftLifecycleRow["phase"], string> = {
  planlegges: "Planlegges",
  pagar: "Pågår",
  oppgjor: "Oppgjør",
  avsluttet: "Avsluttet",
};

export const getShiftLifecycle = defineTool({
  name: "get_shift_lifecycle",
  description:
    "Read the phenomenological phase + hours + deviations for a shift (ADR-0095 five-layer view). Employee-safe: gross cost is excluded. Read-only.",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift to inspect (schedule_shift_id)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("v_shift_lifecycle")
      .select(
        "shift_id, phase, scheduled_hours, interpreted_hours, approved_hours, last_punch_in, last_punch_out, has_deviation, has_blocking_deviation",
      )
      .eq("shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (error) return `Error loading shift lifecycle: ${error.message}`;
    if (!data) return JSON.stringify({ found: false });

    const row = data as ShiftLifecycleRow;

    return JSON.stringify({
      found: true,
      shift_id: row.shift_id,
      phase: row.phase,
      phase_label: PHASE_LABELS[row.phase] ?? row.phase,
      scheduled_hours: row.scheduled_hours,
      interpreted_hours: row.interpreted_hours,
      approved_hours: row.approved_hours,
      last_punch_in: row.last_punch_in,
      last_punch_out: row.last_punch_out,
      has_deviation: row.has_deviation,
      has_blocking_deviation: row.has_blocking_deviation,
    });
  },
});
