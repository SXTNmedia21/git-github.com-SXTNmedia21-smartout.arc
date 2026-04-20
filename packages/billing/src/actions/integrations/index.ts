// Fase 2 Spor B — Integration Server Action building blocks
// (mobile-parity layer).
//
// Every function here is a PURE ASYNC FUNCTION that takes a Supabase
// client. Web Server Actions wrap these in auth-gate + revalidatePath
// (+ Zod validation at the HTTP edge); React Native mobile callers
// invoke them directly. No Next.js-only dependencies in this module.
//
// Ref: Fase 2 spec §4 + §14, ADR-0126 (engine-orchestrated),
//      ADR-0129 (is_placeholder audit gate).

export {
  createIntegration,
  type CreateIntegrationInput,
  type CreateIntegrationResult,
} from "./createIntegration";
export {
  updateIntegration,
  type UpdateIntegrationPatch,
  type UpdateIntegrationResult,
} from "./updateIntegration";
export { deleteIntegration, type DeleteIntegrationResult } from "./deleteIntegration";
export { toggleIntegration, type ToggleIntegrationResult } from "./toggleIntegration";
export {
  testConnectionAction,
  type TestConnectionActionResult,
  type TestConnectionActionFailure,
} from "./testConnectionAction";
export {
  retriggerIntegrationSync,
  type RetriggerIntegrationSyncResult,
  type IntegrationSyncEntity,
  type IntegrationSyncOperation,
} from "./retriggerIntegrationSync";
