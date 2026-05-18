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
import { channelAdminCapability } from "./channel-admin/index.js";
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
import { taskCapability } from "./task/index.js";
import { legalCapability } from "./legal/index.js";
import { businessIntelligenceCapability } from "./business-intelligence/index.js";
import { engineWorldCapability } from "./engine-world/index.js";
import { onboardingCapability } from "./onboarding/index.js";
import { posAccountManagementCapability } from "./pos_account_management/index.js";
import { shiftMarketplaceCapability } from "./shift_marketplace/index.js";
import { schedulerCapability } from "./scheduler/index.js";
import { timelineTemplateCapability } from "./timeline-template/index.js";
import { cascadeCapability } from "./cascade/index.js";
import { dayLineCapability } from "./day-line/index.js";

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
  // Channel administrative tooling — ADR-0336. 6 tools: mute_channel + leave_channel
  // (autonomous/employee), invite_to_channel (confirm/manager), rename_channel +
  // archive_channel + change_member_role (confirm/admin). Chat-only (ADR-0078 PII ceiling).
  // Sortie 1: all tools are skeletons (not_implemented). Bodies in per-tool body sorties.
  channel_admin: channelAdminCapability,
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
  // Task capability — ADR-0298 Sortie 3. Unified task surface across five sources
  // (session_task, personal_task, schedule_day_task, emma_task). 6 tools:
  // list_mine (read, chat+voice), create_personal + create_session + create_day_ad_hoc
  // (chat-only V1, ADR-0298 R6), complete (chat+voice), cancel_personal (chat-only V1).
  // Authority seeded at suggest by 20260607100000_task_capability_authority_seed.sql.
  task: taskCapability,
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
  // Onboarding capability — ADR-0282 Phase E. Wizard workspace-setup surface.
  // 9 tools (skeleton T1.1-T1.5; bodies pending T1.6+): update_business, update_season,
  // add_departments, add_locations, add_zones (confirm), add_procedures (suggest),
  // scrape_website + search_company + identify_company (read_only bridges).
  // chat+voice+system. toolAuthPattern="bff". emitPrefix="onboarding".
  // Authority seeded in 20260524000001_onboarding_capability_authority_seed.sql.
  onboarding: onboardingCapability,
  // POS account management capability — ADR-0305. V1 Lightspeed K-Series.
  // Three tools: connect_lightspeed + disconnect (admin+, chat-only, mutateWithGate),
  // list_pos_accounts (admin+, both channels, read-only).
  // emitPrefix="pos". Authority seeded in 20260611120100_wfm_capability_authority_seed.sql.
  pos_account_management: posAccountManagementCapability,
  // Open-shift marketplace — ADR-0306. 5 tools: list_open_offers (read_only),
  // post_open (manager+, chat-only), claim (employee+, chat-only V1),
  // approve_claim (manager+, chat-only V1, transactional), cancel_offer (any, both channels).
  // Authority seeded in 20260611120100_wfm_capability_authority_seed.sql.
  shift_marketplace: shiftMarketplaceCapability,
  // Scheduler capability — ADR-0307 + ADR-0309. Greedy constraint-solver V1.
  // 3 tools: propose_plan (web Compose, manager+, chat-only), accept_proposal +
  // reject_proposal (mobile Approve, manager+, chat-only). Single-row bundle
  // pattern per ADR-0309. Authority seeded in PLAN Phase 1 foundation migration.
  // mutateWithGate per ADR-0287 (first capability to use the forward-looking wrapper).
  scheduler: schedulerCapability,
  // Timeline Template capability — ADR-0334. Dagslinjen template save+apply+archive.
  // 4 tools: save_template + apply_template + archive_template (confirm, manager+, chat-only),
  // list_templates (read_only, chat-only). mutateWithGate per ADR-0287.
  // emitPrefix='timeline_template'. 5 telemetry events (T2 sortie).
  // Authority seeded at confirm by 20260616110100_seed_timeline_template_authority.sql.
  timeline_template: timelineTemplateCapability,
  // Cascade-namespace delegation tools — ADR-0356 + ADR-0173 frozen-4. 2 tools:
  //   bind_workspace_union (→ workspace_union_binding, ADR-0355 lifecycle contract),
  //   add_supplement_rule (→ public.supplement_rule, workspace-scoped override).
  // Called by payroll Phase 7f tools (setup_workspace_tariff, change_workspace_tariff,
  // add_supplement_override); NEVER invoked directly by users. chat-only, direct_admin.
  // Both the caller gate AND the cascade gate fire independently per ADR-0356 §"Gate convention".
  // emitPrefix='cascade'. Authority seeded at autonomous by 20260618200000.
  cascade: cascadeCapability,
  // Day-line capability — ADR-0367. D6 Production dag-linje lifecycle.
  // 4 tools: create (manager+, chat-only), add_item (delegating: task+routine, manager+),
  // instantiate_template (routine alias, manager+), update_hours (manager+, chat-only).
  // Cross-namespace writes via ADR-0240 delegation to task.create_session +
  // timeline_template.apply_template. emitPrefix='day-line'.
  // Authority seeded by 20260620120800 + 20260620120900 migrations.
  "day-line": dayLineCapability,
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
