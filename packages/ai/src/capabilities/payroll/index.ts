/**
 * Payroll capability definition (ADR-0234).
 *
 * Resurrects the dead `payroll` CapabilityName value that existed in the
 * intent classifier since initial agent design but had no implementation.
 *
 * Authority:
 *   - defaultAuthority: "read_only" (advisory; actual authority from engine_authority_config)
 *   - Seeded at "confirm" / "admin" by 20260519120000_payroll_capability_authority_seed.sql
 *   - toolAuthPattern: "direct_admin" (stage-engine has no session cookie, uses admin client)
 *
 * Channel restriction (ADR-0078 Høy-PII):
 *   - allowedChannels: ["chat"] — voice, SMS, email, autonomous, system all forbidden
 *   - Each tool enforces ctx.channel === "chat" at execute-time as defence-in-depth
 *
 * emitPrefix: "payroll" — all events registered in packages/telemetry/src/registry.ts
 *   under "payroll.*" namespace.
 *
 * Tool split:
 *   - readOnlyTools: query_tax_card, view_personal_number, view_bank_account, salary_query
 *   - suggestTools: update_payroll_profile, set_pension_scheme
 *     (mutations require confirmation via authority level "confirm")
 *
 * Phase 0c (NOT included here):
 *   - view_personal_number + view_bank_account full reveal (RevealableField wiring)
 *   - salary_query shift_pay_calculation integration
 *   - legal capability (validate_aml_14_6, cite_law, classify_amendment)
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import {
  updatePayrollProfile,
  queryTaxCard,
  setPensionScheme,
  viewPersonalNumber,
  viewBankAccount,
  salaryQuery,
} from "./tools.js";

const readOnlyTools = [
  queryTaxCard,
  viewPersonalNumber,
  viewBankAccount,
  salaryQuery,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [updatePayrollProfile, setPensionScheme] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

const allTools = [...readOnlyTools, ...suggestTools] as unknown as ReadonlyArray<
  SmartoutTool<AgentToolContext>
>;

export const payrollCapability: CapabilityDefinition = {
  name: "payroll",
  description:
    "Access and manage employee payroll data — salary, tax card, pension scheme, bank account. Høy-PII: chat channel only. Admin or self for reads; admin-only for writes.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"],
  toolAuthPattern: "direct_admin",
  emitPrefix: "payroll",
  defaultAuthority: "read_only",
};
