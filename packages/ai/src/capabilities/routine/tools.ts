/**
 * Routine capability tools — ADR-0367 BT2.
 *
 * One tool: attach_to_line — materialises a routine template into a day_line's task set.
 *
 * Delegation contract (ADR-0240):
 *   This tool MUST NOT write directly to session_task.
 *   All task creation is delegated to task.create_session.execute() — the owning
 *   capability for session_task writes. ADR-0173 frozen-4 namespace boundaries apply.
 *   The ADR-0240 test in __tests__/tools.test.ts enforces this at CI time.
 *
 * Authority: confirm, manager+, chat-only V1.
 *   Gate: routine.attach_to_line (single gate — this is not a cascade delegation tool;
 *   the downstream task gate fires independently inside task.create_session).
 *
 * Channel: chat-only. Voice rejected at tool body (ADR-0078, free-text title PII risk).
 *
 * Pattern B extension (ADR-0367):
 *   Passes day_line_id + actor_capability="task" + delegated_via="routine" into
 *   task.create_session for audit symmetry (ADR-0356 §"Audit trail symmetry").
 *
 * Emit: routine.attached (once per call, not per item — ADR-0134 cardinality rule).
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateRoutineAction } from "./gate.js";
import { createSession } from "../task/tools.js";

const CAPABILITY = "routine" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ─────────────────────────────────────────────────────────────────────────────
// Tool — routine.attach_to_line
// Channel: CHAT-ONLY (ADR-0078 — free-text item title PII risk)
// Gate: routine.attach_to_line, confirm, manager+
// Delegates: task.create_session.execute() per item (ADR-0240)
// ─────────────────────────────────────────────────────────────────────────────

export const attachToLine = defineTool({
  name: "attach_to_line",
  description:
    "Materialiserer en rutine-mal til et day_line's oppgavesett. " +
    "Bruk når en leder sier 'koble rutinen til dagslinjen', 'legg til åpningsrutinen', " +
    "'sett opp standardoppgaver for denne linjen'. " +
    "Krever manager+ rolle. Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy. " +
    "Oppretter session-oppgaver via task.create_session (ADR-0240 — ingen direkte DB-skriving). " +
    "Returnerer antall opprettede oppgaver og UUID-listen.",
  capability: CAPABILITY,
  schema: z
    .object({
      day_line_id: z.string().uuid().describe("UUID for day_line oppgavene festes til."),
      items: z
        .array(
          z.object({
            title: z.string().min(1).max(200).describe("Tittel på oppgaven (maks 200 tegn)."),
            description: z
              .string()
              .max(2000)
              .optional()
              .describe("Valgfri beskrivelse av oppgaven (maks 2000 tegn)."),
            scheduled_at: z
              .string()
              .datetime()
              .optional()
              .describe("Valgfri ISO-8601 tid for når oppgaven skal utføres."),
          }),
        )
        .min(1)
        .max(50)
        .describe("Liste over oppgaver som skal opprettes (1–50 elementer)."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan rutine-tilknytning bare utføres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1 — resolve day_line workspace + department_session.
    // Fail-fast per L-0177: no silent fallback to JWT-default workspace.
    const { data: line, error: lineError } = await supabase
      .from("day_line")
      .select("day_line_id, workspace_id, department_session_id")
      .eq("day_line_id", params.day_line_id)
      .maybeSingle();

    if (lineError) {
      return JSON.stringify({ ok: false, error: `day_line lookup failed: ${lineError.message}` });
    }
    if (!line) {
      return JSON.stringify({ ok: false, error: "day_line_not_found" });
    }
    if (line.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "day_line_wrong_workspace" });
    }

    // Step 2 — C4 authority gate (ADR-0099 / ADR-0287).
    const gate = await gateRoutineAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.attach_to_line`,
      channel,
      entityId: params.day_line_id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Step 3 — delegate each item to task.create_session (ADR-0240).
    // IMPORTANT: no direct session_task.insert allowed here — see ADR-0240 + __tests__/tools.test.ts.
    const sessionTaskIds: string[] = [];
    const errors: string[] = [];

    for (const item of params.items) {
      const result = await createSession.execute(
        {
          // session_id is required by task.create_session but is overridden via day_line_id.
          // Pass the resolved session id from the day_line row.
          session_id: line.department_session_id,
          day_line_id: params.day_line_id,
          title: item.title,
          ...(item.description ? { description: item.description } : {}),
          ...(item.scheduled_at
            ? { reason: `scheduled_at:${item.scheduled_at}` }
            : { reason: "routine.attach_to_line" }),
          // ADR-0356 Pattern B audit symmetry.
          actor_capability: "task",
          delegated_via: "routine",
        },
        ctx,
      );

      // task.create_session returns JSON: { id } on success | { ok: false, error } on fail.
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result) as Record<string, unknown>;
      } catch {
        errors.push(`item_parse_error: ${result}`);
        continue;
      }

      if (parsed.id) {
        sessionTaskIds.push(parsed.id as string);
      } else {
        errors.push((parsed.error as string) ?? "unknown_error");
      }
    }

    const itemsApplied = sessionTaskIds.length;

    // Step 4 — emit routine.attached once (ADR-0134 cardinality: one emit per logical event).
    if (itemsApplied > 0) {
      await emit({
        event: "routine.attached",
        workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
        actor_id: nonEmpty(ctx.profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "day_line",
            entity_id: params.day_line_id,
          },
          data: {
            day_line_id: params.day_line_id,
            items_applied: itemsApplied,
            actor_capability: "task",
            delegated_via: "routine",
          },
        },
      });
    }

    if (errors.length > 0) {
      return JSON.stringify({
        ok: itemsApplied > 0,
        items_applied: itemsApplied,
        session_task_ids: sessionTaskIds,
        errors,
      });
    }

    return JSON.stringify({
      ok: true,
      items_applied: itemsApplied,
      session_task_ids: sessionTaskIds,
    });
  },
});
