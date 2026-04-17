// Fase 2 Spor C — Workspace-admin mark-paid.
//
// Pure async function lives here so React Native can call the same
// data layer. Web wraps it in a Server Action with cookie-auth gate.

export {
  markInvoicePaidByWorkspaceAdmin,
  type MarkInvoicePaidByWorkspaceAdminArgs,
  type MarkInvoicePaidByWorkspaceAdminResult,
} from "./markInvoicePaidByWorkspaceAdmin";
