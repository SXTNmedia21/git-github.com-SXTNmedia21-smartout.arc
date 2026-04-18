// Fase 2 B3 — Dispatch rule CRUD (mobile-parity layer).
//
// Pure async functions that take a Supabase client. Web Server Actions
// wrap these in auth-gates + revalidatePath + Zod validation; React
// Native mobile callers invoke them directly. No Next.js dependencies.
//
// Platform-admin + workspace-admin share these primitives. The
// distinction lives in the auth layer above — platform-admin may
// create rules with workspace_id NULL, workspace-admin may only
// CRUD rules where workspace_id matches one of their admin workspaces.
//
// Ref: Fase 2 spec §3.6, ADR-0127 (2-level evaluation + suppress).

export {
  createDispatchRule,
  type CreateDispatchRuleInput,
  type CreateDispatchRuleResult,
} from "./createDispatchRule";
export {
  updateDispatchRule,
  type UpdateDispatchRulePatch,
  type UpdateDispatchRuleResult,
} from "./updateDispatchRule";
export { deleteDispatchRule, type DeleteDispatchRuleResult } from "./deleteDispatchRule";
export { toggleDispatchRule, type ToggleDispatchRuleResult } from "./toggleDispatchRule";
