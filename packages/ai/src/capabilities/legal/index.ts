// packages/ai/src/capabilities/legal/index.ts
//
// `legal` capability — Norsk arbeidsrett (Lovsen-branding).
// Third capability sibling to `contract` + `payroll` per ADR-0242 / ADR-0234.
// Persona is OUTPUT BRANDING ONLY — Botsson invokes these tools and responds
// in Lovsen-voice. Per ADR-0220 Botsson remains the sole conversational front
// door. Per ADR-0249 this is the fifth registered capability.
//
// Tool split:
//   readOnlyTools : validate_aml_14_6 (chat), cite_law (chat + voice)
//   suggestTools  : (none at Phase 0c)
//   tools         : classify_amendment (server-only channel, ADR-0078)
//
// Channel contract (ADR-0078 + ADR-0163 §rule 4):
//   validate_aml_14_6 : chat only       (oppsigelse/sykefravær — High-sensitivity)
//   cite_law           : chat only      (paragraph references; ADR-0163 §14-6/AML scope = chat-only)
//   classify_amendment : system only    (drives mutation downstream, ADR-0099 enforce)
//
// Capability-level allowedChannels (Layer 2) MUST exclude voice — any capability
// handling §14-6 / AML content is chat-only per ADR-0163 §rule 4. Layer 3 tool
// bodies block voice as defence-in-depth; Layer 2 narrowing tightens the surface
// to match. Audit 2026-05-13 F-CL-11 (CRITICAL).
//
// Authority (ADR-0192 seed in same migration):
//   defaultAuthority: "read_only"
//   validate_aml_14_6: min_role manager, gate_action check
//   cite_law:          min_role employee, gate_action check
//   classify_amendment: min_role admin, gate_action enforce, default_allow false
//
// emitPrefix: "legal" — ADR-0194 collision check enforced by getAllCapabilities().

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { validateAml146, citeLaw, classifyAmendment, validateAml1415 } from "./tools.js";

// Re-export pure-function classifier for capability consumers (e.g. payroll
// change_workspace_tariff). Lovsen-owned rule matrix per Aml. §14-6 + §15-7
// + Riksavtalen §4 carve-out. Single source of truth for amendment
// classification — no parallel heuristics in other capability tools.
export {
  classifyAmendment as classifyAmendmentLogic,
  type AmendmentClassification,
  type AmendmentClassifier,
  type AmendmentPrevState,
  type AmendmentNextState,
  type AmendmentWorkspaceCtx,
} from "./amendment-classifier.js";

// validate_aml_14_6 and cite_law are advisory reads — no mutation.
const readOnlyTools = [validateAml146, citeLaw] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

// classify_amendment is server-only and mutation-driving (gate_action: enforce).
// validate_aml_14_15 is system-only deduction consent validator (ADR-0311, SMA-328).
// Both go in systemTools — NOT readOnlyTools (chat sessions at read_only authority must not invoke).
const systemTools = [classifyAmendment, validateAml1415] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readOnlyTools, ...systemTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const legalCapability: CapabilityDefinition = {
  name: "legal",
  description:
    "Norsk arbeidsrett compliance — validate contracts against Aml. §14-6, cite law paragraphs, " +
    "and classify contract amendments. Lovsen-branding: saklig, presis, paragraf-spesifikk. " +
    "validate_aml_14_6: chat-only mandatory gate before contract dispatch. " +
    "cite_law: chat + voice reference tool. classify_amendment: server-only mutation driver.",
  tools: allTools,
  readOnlyTools,
  // No suggestTools at Phase 0c — no conversational mutations.
  // ADR-0163 §rule 4: legal handles §14-6 / AML content → chat-only at Layer 2.
  // Layer 3 tool-body guard remains as defence-in-depth.
  allowedChannels: ["chat", "system"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "legal",
  defaultAuthority: "read_only",
};
