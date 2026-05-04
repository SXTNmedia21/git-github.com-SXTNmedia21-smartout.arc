// packages/ai/src/capabilities/memory/tools.ts
//
// Materialises the `memory` intent — previously a classifier stub with no
// registered capability (see tool-selector.ts line 41-55). Gives the agent a
// real surface for "remember this" requests.
//
// Phase A3 per docs/plans/PLAN-engine-memory-writer.md.
//
// SS-1 (Council 2026-04-23, ADR-0203 + ADR-0204): replaced the inline
// `supabase.rpc("gate_action", ...)` call with the shared `callGateAction`
// wrapper from `./gate.ts`. The inline variant silently dropped
// `four_eyes_required`, `approvers_needed`, `approvers_present`, and
// `gate_evaluation_id`, collapsing a legitimate four-eyes approval path into
// an opaque "Minnelagring avslått" prose deny. ADR-0196 Invariant 11
// (phantom-capability ban) + Invariant 13 (gate_action on every mutation)
// required the cutover. Four-eyes discrimination uses the dedicated
// `gate.requiresFourEyes` boolean, NOT reason-string matching (L-0133).

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { saveMemory } from "../../context/memory-writer.js";
import { recordTurn } from "../../lib/recording-hook.js";
import { callGateAction } from "./gate.js";

const CAPABILITY = "memory";

// Tool-level channel guard normaliser — see contract-intake/tools.ts for
// the same shape. gate_action independently enforces channel, so this is
// defence-in-depth against a context that somehow loses its channel tag.
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ── Result shapes ───────────────────────────────────────────────────────────
//
// Discriminated-union output aligned with contract-intake's ADR-0138-forward-
// compatible surface. The legacy `{ success, memory_id, scope, memory_type }`
// happy-path fields are preserved so existing prompt templates + tool-result
// consumers keep parsing what they already read; `outcome` + `user_message`
// are additive.

type BlockOutcome = {
  allowed: false;
  outcome: "blocked";
  reason: string;
  user_message: string;
  gate_evaluation_id: string | null;
};

type FourEyesPendingOutcome = {
  allowed: false;
  outcome: "four_eyes_pending";
  reason: "four_eyes_required";
  approvers_needed: number;
  approvers_present: string[];
  user_message: string;
  gate_evaluation_id: string | null;
};

type SuggestDowngradeOutcome = {
  allowed: false;
  outcome: "confirmation_required";
  reason: "downgraded_to_suggest";
  user_message: string;
  gate_evaluation_id: string | null;
};

type AppliedMemoryOutcome = {
  allowed: true;
  outcome: "applied";
  success: true;
  memory_id: string;
  scope: string;
  memory_type: string;
  user_message: string;
  gate_evaluation_id: string | null;
};

const toJson = (payload: unknown): string => JSON.stringify(payload);

// Fixed user-visible copy (ADR-0138 field `user_message`). Norwegian — the
// LLM may surface verbatim or as a seed.
//
// BLOCK_MESSAGE retains the legacy "Minnelagring avslått: <reason>" shape
// so existing regex-based tests (`/avslått|avslatt/i`) keep passing and
// prompt templates that key off this wording stay stable.
const BLOCK_MESSAGE = (reason: string): string => `Minnelagring avslått: ${reason}.`;

const FOUR_EYES_MESSAGE =
  "Lagring av dette minnet krever godkjenning fra en annen godkjenner før det kan fullføres.";

const DOWNGRADE_MESSAGE =
  "Jeg har lyst til å huske dette — bekreft med 'ja, lagre' så legger jeg det inn.";

// ── save_memory ─────────────────────────────────────────────────────────────

/**
 * Agent-callable write tool. Guarded by:
 *   1. ADR-0078 channel rule — chat only; voice cannot persist memories.
 *   2. ADR-0099 gate_action — capability='memory', action_type='save',
 *      via the shared `callGateAction` wrapper that propagates four-eyes
 *      and downgrade signals (SS-1).
 *   3. PII heuristics in memory-writer.ts — blocks personnummer, bank
 *      numbers, and other regex-matched sensitive content.
 *
 * Scope defaults to `personal` so memories stick to the caller only.
 * Allowing `team` / `workspace` scope is a deliberate choice the agent makes
 * when the user explicitly says so ("tell everyone that…").
 */
export const saveMemoryTool = defineTool({
  name: "save_memory",
  description:
    "Persist a durable memory about the current employee or workspace. Use this only when the user confirms the fact is worth remembering across sessions — preferences ('I prefer night shifts'), repeated facts ('my department is kitchen'), or concluded summaries. Chat-only. Never save personal identifiers (personnummer, bank numbers, addresses) — those belong in the employee record, not in memory.",
  capability: "memory",
  schema: z.object({
    content: z
      .string()
      .min(3)
      .max(1000)
      .describe("The memory content in natural language. Norwegian preferred."),
    memory_type: z
      .enum(["preference", "fact", "summary", "general", "constant"])
      .default("fact")
      .describe(
        "preference = user preference; fact = verified statement; summary = conversation summary; general = uncategorised; constant = time-invariant truth.",
      ),
    scope: z
      .enum(["personal", "team", "workspace", "conversation", "onboarding"])
      .default("personal")
      .describe(
        "personal = caller only (default); team / workspace = broader scope, use only when the user explicitly asks to share.",
      ),
    importance: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Retrieval priority 0..1. Start at 0.5 unless the user emphasises importance."),
    expires_at: z
      .string()
      .optional()
      .describe("Optional ISO-8601 timestamp after which the memory is purged."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 layer 3: defence-in-depth channel guard.
    if (ctx.channel && ctx.channel !== "chat") {
      return "Minner lagres kun via chat. Be meg om å notere det igjen når du er i chatmodus.";
    }

    // ADR-0099 / SS-1: call gate_action via the shared wrapper BEFORE any
    // mutation. Default authority is read_only per the campaign map —
    // workspaces must opt-in to memory writes via engine_authority_config.
    // The wrapper preserves four-eyes + downgrade + gate_evaluation_id
    // fields that the pre-SS-1 inline call silently dropped.
    //
    // entity_id = profileId because memories are scoped to the actor's
    // profile (ADR-0101 four-eyes scoping): one approval covers this
    // profile's writes, not the whole workspace.
    const channel = normaliseChannel(ctx.channel);
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "save",
      entityId: ctx.profileId,
    });

    // Four-eyes path (ADR-0101): surface approver-needed, do NOT mutate.
    // L-0133: discriminate on the dedicated `requiresFourEyes` boolean —
    // NOT on `reason === "four_eyes_required"` string-match. The RPC may
    // set the boolean true while `reason` carries a different machine code
    // (e.g. "approval_required"), in which case reason-string matching
    // would silently fall through to the "blocked" branch and the UI would
    // never surface the approver selector.
    if (!gate.allow && gate.requiresFourEyes === true) {
      const result: FourEyesPendingOutcome = {
        allowed: false,
        outcome: "four_eyes_pending",
        reason: "four_eyes_required",
        approvers_needed: gate.approversNeeded,
        approvers_present: gate.approversPresent,
        user_message: FOUR_EYES_MESSAGE,
        gate_evaluation_id: gate.gateEvaluationId,
      };
      return toJson(result);
    }

    // Downgrade path (level='suggest'): the user must confirm before the
    // memory actually lands. Return a confirmation-required result without
    // mutating. The LLM should ask for explicit confirmation and then
    // retry the tool when the user agrees (confirmation retry is handled
    // by the prompt template, not by the tool).
    if (gate.allow === false && gate.downgradeTo === "suggest") {
      const result: SuggestDowngradeOutcome = {
        allowed: false,
        outcome: "confirmation_required",
        reason: "downgraded_to_suggest",
        user_message: DOWNGRADE_MESSAGE,
        gate_evaluation_id: gate.gateEvaluationId,
      };
      return toJson(result);
    }

    // Any other deny — block without mutating. We preserve the legacy
    // "Minnelagring avslått: <reason>" wording so existing tests + prompt
    // templates that regex-match this string keep working. `gate_action
    // unavailable: <error>` from the fail-closed branch of callGateAction
    // flows through here verbatim as the reason.
    if (!gate.allow) {
      const blockReason = gate.reason ?? "ikke tillatt";
      const result: BlockOutcome = {
        allowed: false,
        outcome: "blocked",
        reason: blockReason,
        user_message: BLOCK_MESSAGE(blockReason),
        gate_evaluation_id: gate.gateEvaluationId,
      };
      return toJson(result);
    }

    const result = await saveMemory({
      supabaseAdmin: ctx.supabaseAdmin,
      workspaceId: ctx.workspaceId,
      profileId: ctx.profileId,
      content: params.content,
      memoryType: params.memory_type,
      scope: params.scope,
      importance: params.importance,
      expiresAt: params.expires_at ?? null,
      sourceSessionId: ctx.sessionId || null,
    });

    if (!result.ok) {
      switch (result.reason) {
        case "empty_content":
          return "Tomt innhold — ingenting å huske.";
        case "pii_blocked":
          return "Dette ser ut som personlig informasjon (personnummer, kontonummer e.l.) og lagres ikke i minne. Personopplysninger hører hjemme i ansattprofilen, ikke i Emmas minne.";
        case "invalid_ids":
          return "Mangler bruker- eller arbeidsromidentifikator — kan ikke lagre minne.";
        case "db_error":
          return `Kunne ikke lagre minne: ${result.detail ?? "ukjent DB-feil"}.`;
      }
    }

    // ADR-0184 — record the successful write. Hook is a no-op outside the
    // stage-engine process and swallows its own exceptions, so this call is
    // safe to invoke unconditionally.
    recordTurn({
      sessionId: ctx.sessionId,
      workspaceId: ctx.workspaceId,
      profileId: ctx.profileId,
      turnKind: "memory_write",
      phase: "post_turn",
      content: {
        memory_id: result.id,
        memory_type: params.memory_type,
        scope: params.scope,
      },
      meta: {
        importance: params.importance,
      },
    });

    const applied: AppliedMemoryOutcome = {
      allowed: true,
      outcome: "applied",
      success: true,
      memory_id: result.id,
      scope: params.scope,
      memory_type: params.memory_type,
      user_message: "Lagret.",
      gate_evaluation_id: gate.gateEvaluationId,
    };
    return toJson(applied);
  },
});
