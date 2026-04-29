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
import { payrollCapability } from "./payroll/index.js";
import { missionCapability } from "./mission/index.js";
import { personalCapability } from "./personal/index.js";

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
  // ADR-0242: Høy-PII payroll capability. chat-only. 6 skeleton tools
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
