// packages/ai/src/capabilities/bulk_import/index.ts
/**
 * bulk_import capability — drag-drop Excel/CSV migration of shifts + tasks.
 *
 * Sortie A: parse_spreadsheet (read-only) — wired here.
 * Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md
 * Council: 2026-05-23 APPROVE WITH CHANGES
 *
 * Tools:
 *   Sortie A: parse_spreadsheet (read-only) ← current
 *   Sortie B: preview_batch, resolve_ambiguity
 *   Sortie C: commit_batch
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { parseSpreadsheetTool } from "./tools.js";

const readOnlyTools = [parseSpreadsheetTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;
// parse_spreadsheet is suggest-level per ADR-0401 (admin+ can trigger a parse)
const suggestTools = [parseSpreadsheetTool] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;
const allTools = [parseSpreadsheetTool] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const bulkImportCapability: CapabilityDefinition = {
  name: "bulk_import",
  description:
    "Bulk-import shifts (vaktliste) and daily-plan tasks (kjøreplan) from Excel/CSV files dragged into chat. Admin+ only; chat-only; web-only (Compose verb per ADR-0133). All tools wired in Sorties A/B/C — skeleton in Sortie 0.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"], // ADR-0078 voice forbidden (irreversible writes)
  toolAuthPattern: "direct_admin", // service_role (per DB-tracer: api_key INSERT policies missing on dept/location/profile)
  emitPrefix: "bulk_import", // ADR-0194
};
