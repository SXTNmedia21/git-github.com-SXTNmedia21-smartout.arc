/**
 * timeline_template capability definition — ADR-0335.
 *
 * Four tools covering the save → list → apply → archive lifecycle for
 * TimelineTab (Dagslinjen) templates.  All tools are CHAT-ONLY (ADR-0078):
 * template authoring involves free-text names, notes, and item payloads
 * that are PII-adjacent in the restaurant/hospitality context.
 *
 * Authority: defaultAuthority='confirm' (seeded by T1 migration
 *   20260616110100_seed_timeline_template_authority.sql for all workspaces).
 *   Manager/admin confirms before save+apply+archive; confirm level is
 *   appropriate because templates materialize multiple D6 rows on apply.
 *
 * Channels: allowedChannels=['chat'] at capability level.
 *   Per-tool voice-reject guards are also present in every tool body
 *   (defence-in-depth per ADR-0078 layer-1 + layer-3 pattern).
 *
 * emitPrefix: 'timeline_template' — all domain events under that namespace.
 *   5 events registered in packages/telemetry/src/registry.ts (T2 sortie):
 *   timeline_template.saved, .applied, .archived, .apply_failed, .listed.
 *
 * toolAuthPattern: 'direct_admin' — stage-engine writes via service_role
 *   (ctx.supabaseAdmin). RLS policies on timeline_template use the
 *   is_admin_in_workspace() helper for JWT-path; direct_admin bypasses
 *   RLS for the capability path (consistent with task, schedule, etc.).
 *
 * emitPrefix collision (ADR-0194 + INVARIANTS.md I3):
 *   'timeline_template' prefix is new — getAllCapabilities() assertion will
 *   catch any future collision at runtime.
 *
 * Tool compliance table (verified against tool bodies — L-0175 / L-0176):
 *   save_template    | mutateWithGate | emit timeline_template.saved    | chat-only | PASS
 *   list_templates   | direct SELECT  | emit timeline_template.listed   | chat-only | PASS
 *   apply_template   | mutateWithGate | emit timeline_template.applied  | chat-only | PASS
 *   archive_template | mutateWithGate | emit timeline_template.archived | chat-only | PASS
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { saveTemplate, listTemplates, applyTemplate, archiveTemplate } from "./tools.js";

const readOnlyTools = [listTemplates] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [saveTemplate, applyTemplate, archiveTemplate] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const timelineTemplateCapability: CapabilityDefinition = {
  name: "timeline_template",
  description:
    "Save and apply scope-filtered TimelineTab (Dagslinjen) templates. " +
    "save_template persists the current canvas as a named template. " +
    "list_templates returns templates for a given scope. " +
    "apply_template instantiates template items as real D6 rows (shifts, hooks, tasks, notes, deviations) " +
    "in a single transactional exec callback. " +
    "archive_template soft-deletes (is_archived=true). " +
    "All tools are chat-only (ADR-0078). Manager+ authority required for mutations.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  // ADR-0078: all timeline_template tools are chat-only. Free-text labels,
  // notes, and item payloads are PII-adjacent in hospitality context.
  // Per-tool voice-reject in each body provides defence-in-depth.
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "timeline_template",
  defaultAuthority: "confirm",
};
