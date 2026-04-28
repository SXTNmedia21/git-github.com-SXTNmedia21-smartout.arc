// packages/ai/src/capabilities/journey-authoring/tools.ts
//
// Journey Authoring capability — 3 tools (ADR-0226).
//
// Ported from packages/ai/src/tools/journey/ (save-draft.ts,
// check-duplicates.ts, lookup-journeys.ts). The standalone journey-agent
// + its custom JourneyToolContext are superseded by this capability;
// all tools now use AgentToolContext (canonical) and ctx.supabaseAdmin.
//
// AUTHORITY POSTURE:
//   - save_draft    — suggestTool (mutation, routes through gatedMutation)
//   - check_duplicates — readOnlyTool (no mutation, no gate)
//   - lookup_journeys  — readOnlyTool (no mutation, no gate)
//
// channel: chat-only (ADR-0078 — authoring is never a voice surface)
//
// ctx.sessionId == wizard_session_id (stage-engine sets sessionId per session)
//
// Binding ADRs:
//   - 0078  voice forbidden for spec-authoring mutations
//   - 0134  workspaceId + profileId must resolve non-empty before any gate
//   - 0204  all mutations flow through gatedMutation() — Pathway A + B
//   - 0226  journey-authoring migration: standalone agent → capability

import { z } from "zod";
import type { Json } from "@smartout/supabase";
import type { Database } from "@smartout/supabase";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { gatedMutation } from "../../gate/gatedMutation.js";

// ─────────────────────────────────────────────────────────────────────────
// save_draft
// ─────────────────────────────────────────────────────────────────────────

/**
 * save_draft — persists wizard_session draft state via gatedMutation()
 * (ADR-0204 / ADR-0226). Routes through Pathway A (gate_action) and
 * Pathway B (cascade_gate_write) so authority + data-rule policies run
 * correctly.
 *
 * ctx.sessionId is the wizard_session_id — stage-engine sets sessionId
 * per session context.
 *
 * ADR-0134 guard: profileId must be non-empty before gate evaluation.
 * The stage-engine BFF route resolves profileId upstream.
 */
export const saveDraftTool = defineTool({
  name: "save_draft",
  description:
    "Save the current draft journey state and optionally advance to the next phase. " +
    "Call this after collecting info in each phase to persist progress.",
  capability: "journey_authoring",
  schema: z.object({
    draft: z.record(z.unknown()).describe("Updated draft journey object"),
    next_phase: z
      .enum(["discovery", "classification", "steps", "testing", "documentation", "review"])
      .optional()
      .describe("Phase to advance to (omit to stay in current phase)"),
  }),

  async execute({ draft, next_phase }, ctx: AgentToolContext) {
    // ADR-0134 guard: profileId must resolve non-empty before gate_action.
    // The BFF route enforces this upstream; this is defense-in-depth.
    if (!ctx.profileId) {
      return "Error saving draft: missing actor profile id. Upstream caller must supply ctx.profileId before gate evaluation.";
    }

    if (!ctx.workspaceId) {
      return "Error saving draft: missing workspaceId. Upstream caller must supply ctx.workspaceId (ADR-0134).";
    }

    const updates: Record<string, unknown> = {
      draft_journey: draft,
    };

    if (next_phase) {
      updates.current_phase = next_phase;
    }

    const result = await gatedMutation(ctx.supabaseAdmin, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      capability: "journey_authoring",
      channel: ctx.channel ?? "chat",
      action_type: next_phase ? "advance_phase" : "save_draft",
      entity_id: ctx.sessionId,
      entity_type: "wizard_session",
      action: "update",
      proposed_data: updates as unknown as Json,
      current_data: null,
      execute: async (client) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
        const { error } = await client
          .from("wizard_session")
          .update(updates)
          .eq("wizard_session_id", ctx.sessionId);
        if (error) return { ok: false, reason: error.message };
        return { ok: true };
      },
    });

    if (!result.ok) {
      return `Error saving draft: ${result.reason}`;
    }

    if (result.proposal_id) {
      return `Draft change queued for approval (proposal ${result.proposal_id}).`;
    }

    const phaseMsg = next_phase ? ` Advanced to phase: ${next_phase}.` : "";
    return `Draft saved successfully.${phaseMsg}`;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// check_duplicates
// ─────────────────────────────────────────────────────────────────────────

/**
 * check_duplicates — read-only; no mutation, no gate.
 * Searches existing journeys for potential duplicates based on
 * title similarity and same module+actor combination.
 */
export const checkDuplicatesTool = defineTool({
  name: "check_duplicates",
  description:
    "Check if a proposed journey might duplicate an existing one. " +
    "Pass the draft title, module, and actor to find potential overlaps. " +
    "Always call this before saving a new journey.",
  capability: "journey_authoring",
  schema: z.object({
    title: z.string().describe("Proposed journey title"),
    module: z.string().describe("Proposed module"),
    actor: z.string().describe("Proposed actor"),
  }),

  async execute({ title, module, actor }, ctx: AgentToolContext) {
    const supabase = ctx.supabaseAdmin;

    // Check same module+actor journeys
    const { data: sameModuleActor } = await supabase
      .from("journey")
      .select("code, title, slug, status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("module", module as Database["public"]["Enums"]["journey_module"])
      .eq("actor", actor as Database["public"]["Enums"]["journey_actor"])
      .order("code", { ascending: true });

    // Check title similarity across all journeys
    const titleWords = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const { data: allJourneys } = await supabase
      .from("journey")
      .select("code, title, module, actor")
      .eq("workspace_id", ctx.workspaceId);

    const titleMatches = (allJourneys ?? []).filter((j) => {
      const jTitle = j.title.toLowerCase();
      return titleWords.some((word) => jTitle.includes(word));
    });

    const parts: string[] = [];

    if (sameModuleActor && sameModuleActor.length > 0) {
      parts.push(
        `Same module (${module}) + actor (${actor}) — ${sameModuleActor.length} existing:\n` +
          sameModuleActor.map((j) => `  ${j.code}: ${j.title} [${j.status}]`).join("\n"),
      );
    }

    if (titleMatches.length > 0) {
      parts.push(
        `Title keyword overlap — ${titleMatches.length} matches:\n` +
          titleMatches.map((j) => `  ${j.code}: ${j.title} (${j.module}/${j.actor})`).join("\n"),
      );
    }

    if (parts.length === 0) {
      return "No potential duplicates found. Safe to proceed.";
    }

    return `POTENTIAL DUPLICATES:\n\n${parts.join("\n\n")}\n\nReview carefully before proceeding. Ask the user to confirm this is a new journey.`;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// lookup_journeys
// ─────────────────────────────────────────────────────────────────────────

/**
 * lookup_journeys — read-only; no mutation, no gate.
 * Queries the journey table with optional filters and returns
 * a human-readable formatted list.
 */
export const lookupJourneysTool = defineTool({
  name: "lookup_journeys",
  description:
    "Search existing journeys by module, actor, keyword, or code. " +
    "Use this to find related journeys, check for gaps, and understand " +
    "what already exists before defining new ones.",
  capability: "journey_authoring",
  schema: z.object({
    module: z.string().optional().describe("Filter by module name"),
    actor: z.string().optional().describe("Filter by actor type"),
    keyword: z.string().optional().describe("Search title and trigger_description"),
    limit: z.number().int().min(1).max(20).default(10).describe("Max results"),
  }),

  async execute({ module, actor, keyword, limit }, ctx: AgentToolContext) {
    let query = ctx.supabaseAdmin
      .from("journey")
      .select("code, title, module, actor, status, priority, slug")
      .eq("workspace_id", ctx.workspaceId)
      .order("code", { ascending: true })
      .limit(limit);

    if (module) query = query.eq("module", module as Database["public"]["Enums"]["journey_module"]);
    if (actor) query = query.eq("actor", actor as Database["public"]["Enums"]["journey_actor"]);
    if (keyword)
      query = query.or(`title.ilike.%${keyword}%,trigger_description.ilike.%${keyword}%`);

    const { data, error } = await query;

    if (error) return `Error looking up journeys: ${error.message}`;
    if (!data || data.length === 0) return "No matching journeys found.";

    const rows = data.map(
      (j) => `${j.code} | ${j.title} | ${j.module} | ${j.actor} | ${j.status} | ${j.priority}`,
    );

    return `Found ${data.length} journeys:\nCode | Title | Module | Actor | Status | Priority\n${rows.join("\n")}`;
  },
});
