// packages/ai/src/capabilities/memory/tools.ts
//
// Materialises the `memory` intent — previously a classifier stub with no
// registered capability (see tool-selector.ts line 41-55). Gives the agent a
// real surface for "remember this" requests.
//
// Phase A3 per docs/plans/PLAN-engine-memory-writer.md.

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { saveMemory } from "../../context/memory-writer.js";
import { recordTurn } from "../../lib/recording-hook.js";

/**
 * Agent-callable write tool. Guarded by:
 *   1. ADR-0078 channel rule — chat only; voice cannot persist memories.
 *   2. ADR-0099 gate_action — capability='memory', action_type='save'.
 *      Default authority is read_only; workspaces that want the agent to
 *      write memories autonomously must raise the level in
 *      engine_authority_config.
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

    // ADR-0099: gate_action BEFORE mutation. Default level is read_only per
    // the campaign map — workspaces must opt-in to memory writes via
    // engine_authority_config. We call the RPC directly here rather than via
    // the shift-lifecycle gate helper, which is typed for shift actions.
    const { data: gateRaw, error: gateError } = await ctx.supabaseAdmin.rpc("gate_action", {
      p_workspace_id: ctx.workspaceId,
      p_capability: "memory",
      p_channel: ctx.channel ?? "chat",
      p_actor_profile_id: ctx.profileId,
      p_action_type: "save",
      p_approvers_present: [ctx.profileId],
    });

    if (gateError) {
      // Fail closed on gate error — never write when we cannot evaluate.
      return `Kunne ikke evaluere tillatelse for minnelagring: ${gateError.message}`;
    }

    const gate = (gateRaw ?? {}) as Record<string, unknown>;
    if (gate.allow !== true) {
      const reason = (gate.reason as string) ?? "ikke tillatt";
      return `Minnelagring avslått: ${reason}.`;
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

    return JSON.stringify({
      success: true,
      memory_id: result.id,
      scope: params.scope,
      memory_type: params.memory_type,
    });
  },
});
