// packages/ai/src/capabilities/registry.ts
import type { CapabilityDefinition, CapabilityName } from "./types.js";
import { profileCapability } from "./profile/index.js";
import { uiCapability } from "./ui/index.js";
import { guardianCapability } from "./guardian/index.js";
import { scheduleCapability } from "./schedule/index.js";
import { operationsCapability } from "./operations/index.js";
import { communicationCapability } from "./communication/index.js";
import { contractCapability } from "./contract/index.js";
import { contractIntakeCapability } from "./contract-intake/index.js";
import { shiftSwapCapability } from "./shift-swap/index.js";
import { operationsIntelligenceCapability } from "./operations-intelligence/index.js";
import { trainingCapability } from "./training/index.js";
import { shiftLifecycleCapability } from "./shift-lifecycle/index.js";
import { governanceCapability } from "./governance/index.js";
import { billingQueryCapability } from "./billing-query/index.js";
import { memoryCapability } from "./memory/index.js";
import { helpdeskQueryCapability } from "./helpdesk_query/index.js";
import { kbQueryCapability } from "./kb_query/index.js";
import { journeyCapability } from "./journey/index.js";
import { journeyAuthoringCapability } from "./journey-authoring/index.js";
import { seasonCapability } from "./season/index.js";
import { availabilityCapability } from "./availability/index.js";
import { tipsCapability } from "./tips/index.js";
import { payrollCapability } from "./payroll/index.js";
import { missionCapability } from "./mission/index.js";
import { personalCapability } from "./personal/index.js";
import { legalCapability } from "./legal/index.js";
import { businessIntelligenceCapability } from "./business-intelligence/index.js";
import { engineWorldCapability } from "./engine-world/index.js";

const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  ui: uiCapability,
  guardian: guardianCapability,
  schedule: scheduleCapability,
  operations: operationsCapability,
  communication: communicationCapability,
  contract: contractCapability,
  contract_intake: contractIntakeCapability,
  shift_swap: shiftSwapCapability,
  operations_intelligence: operationsIntelligenceCapability,
  training: trainingCapability,
  shift_lifecycle: shiftLifecycleCapability,
  governance: governanceCapability,
  billing_query: billingQueryCapability,
  // Phase A3 — materialises the `memory` intent stub; write-only surface
  // for "remember this" requests. ADR-0078 (chat-only) + ADR-0099 (gated).
  memory: memoryCapability,
  helpdesk_query: helpdeskQueryCapability,
  kb_query: kbQueryCapability,
  journey: journeyCapability,
  journey_authoring: journeyAuthoringCapability,
  season: seasonCapability,
  // D2 source-data for employee availability. Three tools
  // (set_own + clear_own voice-OK; query_others chat-only). gate_action
  // mandatory on all three. Authority seeded in migration
  // 20260518200002_seed_availability_authority.sql.
  availability: availabilityCapability,
  // Tip pool recording, distribution calculation, adjustment + approval.
  // Chat-only (ADR-0078 — PII-adjacent payroll amounts). 4 tools.
  // Authority seeded in migration 20260428100007_tips_authority_seed.sql.
  // Sortie 1: all tools are skeletons (not_implemented). Bodies in Sortie 2+3.
  tips: tipsCapability,
  // ADR-0256: Høy-PII payroll capability. chat-only. 6 skeleton tools
  // (update_payroll_profile, query_tax_card, set_pension_scheme,
  // view_personal_number, view_bank_account, salary_query).
  // Authority seeded at confirm/admin/24h by
  // 20260519160000_payroll_capability_authority_seed.sql.
  payroll: payrollCapability,
  // Mission capability — read-only. Surfaces active engine_state missions
  // and workspace roadmap so Botsson can answer "what should I do next?".
  // Voice-safe: no PII, no mutations. Authority default: read_only.
  mission: missionCapability,
  // Personal capability — 5 everyday utility tools (note, task, reminder,
  // history, setting). chat+voice. Authority seeded at suggest by
  // 20260520100000_personal_task.sql.
  personal: personalCapability,
  // Legal capability — Norsk arbeidsrett compliance (Lovsen-branding).
  // ADR-0249: fifth registered capability sibling to contract + payroll.
  // Phase 0c scaffold: validate_aml_14_6 (stub, mandatory gate in /api/contracts/send),
  // cite_law (stub, chat+voice), classify_amendment (stub, server-only).
  // Lovdata MCP integration is Phase 0c+.
  // Authority seeded in migration: 20260430000001_legal_capability_authority_seed.sql (pending).
  legal: legalCapability,
  // Business Intelligence capability — ADR-0270. Godmode-only scrapling toolkit.
  // 6 tools: find_hospitality_businesses, enrich_company_intelligence, generate_company_copy,
  // search_brreg, lookup_brreg, scrape_website. chat-only, direct_admin.
  // Zero Smartout DB writes — all output is ephemeral. No migrations needed.
  // Authority: read_only default; suggest tier unlocks find_hospitality_businesses +
  // generate_company_copy. No explicit authority seed migration needed: godmode
  // gate is at BFF (toolAuthPattern="direct_admin"), not at engine_authority_config.
  business_intelligence: businessIntelligenceCapability,
  // engine_world (Phase 0): read-only world-model surface. Every agent reads
  // before acting. read_surface + read_surface_class. Both channels safe
  // (non-PII, non-mutating). Authority: read_only default. Phase 1 sortie
  // adds report_observation (gated mutation) + heartbeat-write.
  engine_world: engineWorldCapability,
};

export function getCapability(name: CapabilityName): CapabilityDefinition | undefined {
  return capabilities[name];
}

export function getAllCapabilities(): CapabilityDefinition[] {
  const all = Object.values(capabilities);
  // emitPrefix collision check — ADR-0194 + INVARIANTS.md I3.
  const prefixOwners = new Map<string, string>();
  for (const cap of all) {
    if (cap.emitPrefix === null) continue;
    const existing = prefixOwners.get(cap.emitPrefix);
    if (existing) {
      throw new Error(
        `capability emitPrefix collision: "${cap.emitPrefix}" claimed by both ${existing} and ${cap.name}`,
      );
    }
    prefixOwners.set(cap.emitPrefix, cap.name);
  }
  return all;
}

export function getRegisteredCapabilities(): CapabilityName[] {
  return Object.keys(capabilities) as CapabilityName[];
}
