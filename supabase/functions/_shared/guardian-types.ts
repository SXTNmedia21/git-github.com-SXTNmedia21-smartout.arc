/**
 * Shared types and Zod schemas for Guardian Edge Functions.
 */

// Using inline Zod import for Deno — Edge Functions use esm.sh
// Each function imports Zod independently; these are just TypeScript types + schema factories.

export type SignalSeverity = "info" | "warning" | "critical";
export type SignalStatus = "active" | "acknowledged" | "resolved" | "dismissed";
export type SignalDomain = "readiness" | "workspace_maturity" | "agent_behavior" | "onboarding";
export type GuardianActor = "system" | "agent" | "user" | "guardian" | "admin";

export type ActionType = "acknowledge" | "resolve" | "dismiss";

export interface SignalInsert {
  workspace_id: string;
  signal_type: string;
  domain: SignalDomain;
  severity: SignalSeverity;
  entity_type?: string;
  entity_id?: string;
  entity_label?: string;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  source_check_id: string;
  expires_at?: string;
}

export interface ActionRequest {
  action: ActionType;
  signalId: string;
  resolution?: string;
  reason?: string;
  note?: string;
}
