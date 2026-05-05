// packages/ai/src/capabilities/onboarding/index.ts
//
// Onboarding capability — wizard workspace-setup surface (ADR-0275 Phase E).
//
// 9 tools (ADR-0275 R4 corrected table):
//   update_business     — confirm  — workspace metadata (name, domain, industry, concept)
//   update_season       — confirm  — season bootstrap (name, dates, revenue target)
//   add_departments     — confirm  — D1 department creation (high-impact cascade write)
//   add_locations       — confirm  — D1 location creation (high-impact cascade write)
//   add_zones           — confirm  — D1 zone creation (high-impact cascade write)
//   add_procedures      — suggest  — governance procedure creation (review-required)
//   scrape_website      — read_only — proxy to scrapling /extract (bridge to business_intelligence)
//   search_company      — read_only — BRIDGE to business_intelligence.search_brreg
//   identify_company    — read_only — BRIDGE to business_intelligence.lookup_brreg
//
// NOTE: add_key_fact is NOT a tool here — it is an alias resolved server-side
// to memory.save_memory. No separate tool registration needed (T1.8 dispatch).
//
// Phase status: T1.1-T1.5 skeleton. Bodies are TODO — land in T1.6 (new tools)
// + T1.7 (bridge tools) after cascade-developer I1 bootstrap pre-flight passes.
//
// Authority posture (per T1.5 seed migration):
//   read_only    → scrape_website, search_company, identify_company
//   suggest      → read_only + add_procedures
//   confirm/autonomous → all tools
//
// Channel posture (ADR-0078):
//   allowedChannels: chat + voice + system
//   - scrape_website / search_company / identify_company: voice-OK (no PII)
//   - update_business / update_season: voice-OK (workspace metadata, no PII)
//   - add_departments / add_locations / add_zones: voice-OK (structural D1 data, no PII)
//   - add_procedures: chat-only (governance content may embed sensitive text)
//   Per-tool voice guard enforced in T1.6 bodies for procedures (Layer 3 ADR-0078).
//
// toolAuthPattern: "bff" — resolved via standard session cookie → workspace derivation.
// emitPrefix: "onboarding" — owned by this capability (ADR-0194).
//
// Binding ADRs: 0078 (channel), 0099 (gate_action), 0134 (telemetry),
//               0173 (capability model), 0192 (authority seed), 0194 (emitPrefix),
//               0204 (gatedMutation), 0240 (cross-namespace write delegation),
//               0270 (business_intelligence bridge), 0275 (Phase E R4).

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  updateBusiness,
  updateSeason,
  addDepartments,
  addLocations,
  addZones,
  addProcedures,
  scrapeWebsite,
  searchCompany,
  identifyCompany,
} from "./tools.js";

// SmartoutTool is invariant on TSchema — cast through unknown to erase the
// specific schema type for the registry (same pattern as shift-lifecycle/index.ts).

const readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  scrapeWebsite,
  searchCompany,
  identifyCompany,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// suggestTools: available at suggest+ authority level. Adds the review-
// required procedure creation on top of read-only tools.
const suggestTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  addProcedures,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All tools: exposed at confirm+ and autonomous authority levels.
const tools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  updateBusiness,
  updateSeason,
  addDepartments,
  addLocations,
  addZones,
  addProcedures,
  scrapeWebsite,
  searchCompany,
  identifyCompany,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const onboardingCapability: CapabilityDefinition = {
  name: "onboarding",
  description:
    "Workspace setup during /onboarding-flow: collecting business info (name, domain, industry, " +
    "concept), bootstrapping seasons, creating departments/locations/zones (D1 cascade), " +
    "adding procedures (governance), and auto-filling from BRREG + website scrape. " +
    "Tools are confirm-gated for D1 mutations and suggest-gated for governance content. " +
    "Read-only tools (scrape, BRREG lookup) require no gate. " +
    "Phase E skeleton — bodies pending T1.6+.",
  tools,
  readOnlyTools,
  suggestTools,
  // ADR-0078: allowedChannels is the union across tools. Per-tool voice guards
  // in T1.6 bodies restrict add_procedures to chat-only at Layer 3.
  allowedChannels: ["chat", "voice", "system"],
  toolAuthPattern: "bff",
  // ADR-0194: "onboarding" namespace owned by this capability.
  emitPrefix: "onboarding",
  defaultAuthority: "read_only",
};

export {
  updateBusiness,
  updateSeason,
  addDepartments,
  addLocations,
  addZones,
  addProcedures,
  scrapeWebsite,
  searchCompany,
  identifyCompany,
};
