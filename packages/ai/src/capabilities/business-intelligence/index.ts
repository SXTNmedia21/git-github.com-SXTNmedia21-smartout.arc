// packages/ai/src/capabilities/business-intelligence/index.ts
//
// Business Intelligence capability (ADR-0270).
//
// Godmode-only research toolkit for platform-admin surfaces:
// prospect-research, lead-gen, and onboarding-helper flows.
// All 6 tools proxy to scrapling (scrape.smartout.ai) — zero Smartout DB writes.
//
// Authority posture (ADR-0270 §authority):
//   - read_only  → enrich, search_brreg, lookup_brreg, scrape_website
//   - suggest    → read_only tools + find_hospitality_businesses + generate_company_copy
//   - confirm/autonomous → all tools (no additional surface today)
//
// chat-only surface (ADR-0078): all tools reject voice.
// toolAuthPattern: "direct_admin" — godmode gate at BFF.
//
// Binding ADRs: 0078 (chat-only), 0134 (actor_id non-null), 0173 (no Smartout DB
//               writes from tools), 0270 (godmode-only, cost-cap, GDPR aggregation).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  findHospitalityBusinessesTool,
  enrichCompanyIntelligenceTool,
  generateCompanyCopyTool,
  searchBrregTool,
  lookupBrregTool,
  scrapeWebsiteTool,
} from "./tools.js";

// SmartoutTool is invariant on TSchema — cast through unknown to erase the
// specific schema type for the registry (same pattern as journey-authoring/index.ts).
const readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  searchBrregTool,
  lookupBrregTool,
  scrapeWebsiteTool,
  enrichCompanyIntelligenceTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// suggestTools: tools that cost money (Google Places) or produce downstream
// wizard-state side-effects (generate_company_copy).
const suggestTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  findHospitalityBusinessesTool,
  generateCompanyCopyTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All 6 tools.
const tools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  findHospitalityBusinessesTool,
  enrichCompanyIntelligenceTool,
  generateCompanyCopyTool,
  searchBrregTool,
  lookupBrregTool,
  scrapeWebsiteTool,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const businessIntelligenceCapability: CapabilityDefinition = {
  name: "business_intelligence",
  description:
    "Godmode-only research toolkit for prospect-data, BRREG/Places lookup, " +
    "website-scrape, and copywriting. Used on /platform-admin/* surfaces. " +
    "All tools proxy to scrapling — no Smartout DB writes.",
  // ADR-0078 — all tools require chat. Lead-data aggregation is never a
  // voice surface (GDPR Art 6 aggregation + LLM-creative output ambiguity).
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "business_intelligence",
  defaultAuthority: "read_only",
  tools,
  readOnlyTools,
  suggestTools,
};

export {
  findHospitalityBusinessesTool,
  enrichCompanyIntelligenceTool,
  generateCompanyCopyTool,
  searchBrregTool,
  lookupBrregTool,
  scrapeWebsiteTool,
};
