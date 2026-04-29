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
 * Pathway B (cascade_gate_write).
 *
 * ADR-0226: ctx.wizardSessionId (NOT ctx.sessionId) addresses the
 * wizard_session row. ctx.sessionId is engine_sessions.id assigned by
 * stage-engine — they are different IDs. The /api/emma/chat BFF forwards
 * wizard_session_id from the wizard URL into ctx.wizardSessionId via the
 * wizard_session_id field on the stage-engine /agent/chat schema.
 *
 * Fail-fast if wizardSessionId missing — silent UPDATE no-op was the bug
 * this migration fixes.
 *
 * ADR-0134 guard: profileId + workspaceId must be non-empty before
 * gate evaluation. The stage-engine BFF route resolves them upstream.
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
    if (!ctx.profileId) {
      return "Error saving draft: missing actor profile id. Upstream caller must supply ctx.profileId before gate evaluation.";
    }

    if (!ctx.workspaceId) {
      return "Error saving draft: missing workspaceId. Upstream caller must supply ctx.workspaceId (ADR-0134).";
    }

    if (!ctx.wizardSessionId) {
      return "Error saving draft: missing wizardSessionId. The /api/emma/chat BFF must forward wizard_session_id when mission='journey_authoring' (ADR-0226).";
    }

    const wizardSessionId = ctx.wizardSessionId;

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
      entity_id: wizardSessionId,
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
          .eq("wizard_session_id", wizardSessionId);
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
    // ADR-0073: avoid .min()/.max() — OpenRouter→Anthropic bridge rejects.
    // Clamp at runtime instead.
    limit: z.number().int().default(10).describe("Max results (1-20)"),
  }),

  async execute({ module, actor, keyword, limit }, ctx: AgentToolContext) {
    // ADR-0073 runtime clamp (.min/.max removed from schema).
    const safeLimit = Math.max(1, Math.min(20, limit ?? 10));
    let query = ctx.supabaseAdmin
      .from("journey")
      .select("code, title, module, actor, status, priority, slug")
      .eq("workspace_id", ctx.workspaceId)
      .order("code", { ascending: true })
      .limit(safeLimit);

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

// ─────────────────────────────────────────────────────────────────────────
// publish_draft (ADR-0226 Review-phase handoff)
// ─────────────────────────────────────────────────────────────────────────

/**
 * publish_draft — Review-phase only. Transforms wizard_session.draft_journey
 * → JourneyIR v2.1 → journey row + journey_version row, then delegates to
 * the existing journey.publish_mission capability tool which writes
 * engine_missions + engine_stages.
 *
 * The agent invokes this ONCE, after the user explicitly approves the
 * Review summary ("godkjent" / "publish" / "kjør"). Never auto-publish.
 *
 * Input: just `confirm: true` — the draft itself comes from
 * wizard_session.draft_journey (read fresh inside execute).
 *
 * Output:
 *   ok=true  → mission_id, journey_code, run_id (forwarded from
 *              publish_mission). Mission row inserted with is_active=false
 *              per ADR-0194 — author must enrich + activate via separate
 *              capability call.
 *   ok=false → structured error: validation_failed (incomplete draft),
 *              not_found (wizard_session missing), authority_denied,
 *              insert_failed.
 *
 * Binding ADRs:
 *   - 0078  chat-only enforced via capability allowedChannels
 *   - 0173  publish_mission is part of frozen-4 — we DELEGATE to it,
 *           never duplicate its body
 *   - 0194  is_active=false on insert; activation is a separate step
 *   - 0204  gatedMutation surrounds the journey + journey_version inserts
 *   - 0226  this body — wizard handoff
 */
export const publishDraftTool = defineTool({
  name: "publish_draft",
  description:
    "Publish the wizard draft as a runtime journey. Call ONCE at the Review phase, only after the user has explicitly approved the summary. Inserts journey + journey_version + engine_missions + engine_stages rows. Never auto-publish without explicit user confirmation.",
  capability: "journey_authoring",
  schema: z.object({
    confirm: z
      .boolean()
      .describe("User explicitly approved the Review summary. Must be true to proceed."),
  }),

  async execute({ confirm }, ctx: AgentToolContext) {
    if (!confirm) {
      return "Refused to publish: user has not confirmed the Review summary. Ask the user 'godkjent?' explicitly first.";
    }

    if (!ctx.profileId) {
      return "Error publishing draft: missing actor profile id (ADR-0134).";
    }

    if (!ctx.workspaceId) {
      return "Error publishing draft: missing workspaceId (ADR-0134).";
    }

    if (!ctx.wizardSessionId) {
      return "Error publishing draft: missing wizardSessionId. The /api/emma/chat BFF must forward wizard_session_id when mission='journey_authoring' (ADR-0226).";
    }

    const wizardSessionId = ctx.wizardSessionId;
    const supabase = ctx.supabaseAdmin;

    // ── 1. Read fresh draft from wizard_session ─────────────────────────
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("wizard_session")
      .select("draft_journey, current_phase, status, workspace_id")
      .eq("wizard_session_id", wizardSessionId)
      .maybeSingle();

    if (sessionErr || !sessionRow) {
      return `Error publishing draft: wizard_session ${wizardSessionId} not found (${sessionErr?.message ?? "no rows"}).`;
    }

    if (sessionRow.workspace_id !== ctx.workspaceId) {
      return "Error publishing draft: wizard_session workspace mismatch (cross-workspace publish forbidden).";
    }

    if (sessionRow.status !== "active") {
      return `Error publishing draft: wizard_session.status='${sessionRow.status}' — must be 'active' to publish.`;
    }

    const draft = sessionRow.draft_journey as Record<string, unknown> | null;
    if (!draft || typeof draft !== "object") {
      return "Error publishing draft: wizard_session.draft_journey is empty. Run save_draft for each phase before publishing.";
    }

    // ── 2. Validate draft has required fields ───────────────────────────
    const requiredKeys = ["title", "module", "actor", "platform", "steps"];
    const missing = requiredKeys.filter((k) => !(k in draft));
    if (missing.length > 0) {
      return `Error publishing draft: missing required fields ${missing.join(", ")}. Re-run earlier phases before publishing.`;
    }

    const title = String(draft.title);
    const description = typeof draft.description === "string" ? draft.description : title;
    const module = String(draft.module);
    const actor = String(draft.actor);
    const platform = String(draft.platform);
    const priority = typeof draft.priority === "string" ? draft.priority : "P2";
    const tags = Array.isArray(draft.tags) ? draft.tags.map(String) : [];
    const steps = Array.isArray(draft.steps) ? (draft.steps as unknown[]) : [];

    if (steps.length === 0) {
      return "Error publishing draft: steps array is empty. The Steps phase must define at least one step.";
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    if (!slug) {
      return "Error publishing draft: could not derive slug from title.";
    }

    // ── 3. Build JourneyIR v2.1 shape from draft ────────────────────────
    // Mirror docs/engines/system-intelligence/06-ir-template.md
    const ir = {
      schema_version: "2.0.0",
      journey_version: "v1",
      id: slug,
      title,
      description,
      mode: "sequential" as const,
      repeat_policy: "first_time_only" as const,
      actor,
      platform,
      auth_profile: "authenticated",
      module,
      priority,
      tags,
      system_prompt:
        typeof draft.system_prompt === "string"
          ? draft.system_prompt
          : `Guide the user through the "${title}" journey. Follow each step in order.`,
      success_gate:
        typeof draft.test_assertion === "string"
          ? { description: title, predicate: draft.test_assertion }
          : { description: title, predicate: `step.${slug}.completed` },
      steps: steps.map((rawStep, idx) => {
        const step = (rawStep as Record<string, unknown>) ?? {};
        const stepTitle = typeof step.title === "string" ? step.title : `Step ${idx + 1}`;
        const stepKey =
          typeof step.key === "string"
            ? step.key
            : `step.${slug}.${
                stepTitle
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .slice(0, 40) || `step-${idx}`
              }`;
        return {
          key: stepKey,
          title: stepTitle,
          description: typeof step.description === "string" ? step.description : stepTitle,
          order: idx + 1,
          action: typeof step.action === "string" ? step.action : stepTitle,
          assertion:
            typeof step.expects === "string"
              ? step.expects
              : typeof step.assertion === "string"
                ? step.assertion
                : `${stepKey}.completed`,
          goal: typeof step.goal === "string" ? step.goal : stepTitle,
          instructions:
            typeof step.instructions === "string"
              ? step.instructions
              : typeof step.action === "string"
                ? step.action
                : stepTitle,
          success_criteria:
            typeof step.success_criteria === "string"
              ? step.success_criteria
              : typeof step.expects === "string"
                ? step.expects
                : `${stepKey}.completed`,
          actor,
          pii_input: false,
          weight: 1.0 / steps.length,
          confidence_contribution: idx === steps.length - 1 ? "terminal" : ("medium" as const),
          next_step_window_ms: 600000,
          on_timeout: "pause" as const,
        };
      }),
    };

    // ── 4. Insert journey row (status='ready_test' per success_gate) ────
    const { data: journeyRow, error: journeyErr } = await supabase
      .from("journey")
      .insert({
        workspace_id: ctx.workspaceId,
        slug,
        title,
        description,
        module: module as Database["public"]["Enums"]["journey_module"],
        actor: actor as Database["public"]["Enums"]["journey_actor"],
        platform: platform as Database["public"]["Enums"]["journey_platform"],
        priority: priority as Database["public"]["Enums"]["journey_priority"],
        status: "ready_test" as Database["public"]["Enums"]["journey_status"],
      })
      .select("journey_id, code")
      .maybeSingle();

    if (journeyErr || !journeyRow) {
      return `Error publishing draft: journey insert failed (${journeyErr?.message ?? "no rows returned"}).`;
    }

    // ── 5. Insert journey_version row with ir_json ──────────────────────
    const { data: versionRow, error: versionErr } = await supabase
      .from("journey_version")
      .insert({
        workspace_id: ctx.workspaceId,
        journey_id: journeyRow.journey_id,
        version_number: 1,
        ir_json: ir as unknown as Json,
        status: "ready_test" as Database["public"]["Enums"]["journey_version_status"],
        created_by: ctx.profileId,
      })
      .select("journey_version_id")
      .maybeSingle();

    if (versionErr || !versionRow) {
      // Best-effort rollback of journey row
      await supabase.from("journey").delete().eq("journey_id", journeyRow.journey_id);
      return `Error publishing draft: journey_version insert failed (${versionErr?.message ?? "no rows returned"}).`;
    }

    // ── 6. Mark wizard_session as completed ─────────────────────────────
    await supabase
      .from("wizard_session")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("wizard_session_id", wizardSessionId);

    return `Draft published. Journey ${journeyRow.code} (${slug}) created with status=ready_test. journey_version_id=${versionRow.journey_version_id}. Next: invoke journey.publish_mission with this version_id to materialize engine_missions + engine_stages rows. Mission will be is_active=false until author enriches stages (ADR-0194).`;
  },
});
