// packages/ai/src/capabilities/onboarding/index.ts
//
// Onboarding capability — wizard workspace-setup surface (ADR-0275 Phase E).
//
// 10 tools (ADR-0275 R4 + T1.8 alias):
//   update_business     — confirm  — workspace metadata (name, domain, industry, concept)
//   update_season       — confirm  — season bootstrap (name, dates, revenue target)
//   add_departments     — read_only — IN-MEMORY wizard state (Option A 2026-05-04)
//   add_locations       — read_only — IN-MEMORY wizard state (Option A 2026-05-04)
//   add_zones           — read_only — IN-MEMORY wizard state (Option A 2026-05-04)
//   add_procedures      — suggest  — governance procedure creation (review-required, chat-only)
//   scrape_website      — read_only — proxy to scrapling /extract
//   search_company      — read_only — scrapling /brreg-search bridge
//   identify_company    — read_only — scrapling /brreg-lookup bridge
//   add_key_fact        — suggest  — alias to memory.save_memory (T1.8), chat-only
//
// Option A decision (2026-05-04, cascade-developer FAIL):
//   add_departments / add_locations / add_zones are IN-MEMORY only.
//   Authority downgraded to read_only. No gate, no emit, no DB write.
//   Single cascade-write via finalize-workspace Edge Function.
//
// Authority posture (T1.6 bodies implemented):
//   read_only    → scrape_website, search_company, identify_company,
//                  add_departments, add_locations, add_zones (in-memory)
//   suggest      → read_only + add_procedures + add_key_fact
//   confirm/autonomous → all tools
//
// Channel posture (ADR-0078):
//   allowedChannels: chat + voice + system
//   Per-tool voice guards in bodies:
//   - add_procedures → body rejects voice (Layer 3)
//   - add_key_fact   → body rejects voice (Layer 3, ADR-0078 memory = chat-only)
//
// Binding ADRs: 0078 (channel), 0099 (gate_action), 0134 (telemetry),
//               0173 (capability model), 0192 (authority seed), 0194 (emitPrefix),
//               0204 (gatedMutation), 0240 (cross-namespace), 0270 (scrapling),
//               0275 (Phase E R4).

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
  addKeyFact,
} from "./tools.js";

// SmartoutTool is invariant on TSchema — cast through unknown to erase the
// specific schema type for the registry (same pattern as shift-lifecycle/index.ts).

// read_only tier: no gate needed — reads, external proxies, and in-memory D1 tools.
const readOnlyTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  scrapeWebsite,
  searchCompany,
  identifyCompany,
  addDepartments,
  addLocations,
  addZones,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// suggest tier: adds gated mutations (procedures + key-fact alias).
const suggestTools: ReadonlyArray<SmartoutTool<AgentToolContext>> = [
  addProcedures,
  addKeyFact,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All tools: confirm+ and autonomous authority levels.
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
  addKeyFact,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const onboardingCapability: CapabilityDefinition = {
  name: "onboarding",
  description:
    "Workspace setup during /onboarding-flow: collecting business info (name, domain, industry, " +
    "concept), bootstrapping seasons, recording departments/locations/zones (in-memory until finalize), " +
    "adding procedures (governance), and auto-filling from BRREG + website scrape. " +
    "Real DB writes: update_business (workspace), update_season (season+budget), add_procedures (protocol). " +
    "In-memory only: add_departments, add_locations, add_zones (persisted by finalize-workspace). " +
    "Read-only bridges: scrape_website, search_company, identify_company. " +
    "Alias: add_key_fact → memory.save_memory.",
  tools,
  readOnlyTools,
  suggestTools,
  // ADR-0078: capability-level channels = union. Per-tool Layer 3 guards
  // block add_procedures + add_key_fact on voice inside their execute() bodies.
  allowedChannels: ["chat", "voice", "system"],
  toolAuthPattern: "bff",
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
  addKeyFact,
};
