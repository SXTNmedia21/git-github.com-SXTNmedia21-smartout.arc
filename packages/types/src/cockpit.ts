// ============================================
// cockpit.ts
// Shared cockpit contract for operations V1.
// Keeps event, filter, and quick-action types
// aligned across web and mobile surfaces.
// ============================================

export type CockpitEventSource = "human" | "agent" | "system";

export type CockpitSessionMode = "mission" | "agent" | "none";

export type CockpitSeverity = "critical" | "warning" | "info";

export type CockpitEventEnvelope = {
  id: string;
  source: CockpitEventSource;
  sessionMode: CockpitSessionMode;
  severity: CockpitSeverity;
  eventType: string;
  summary: string;
  occurredAt: string;
  correlationId?: string | null;
  entityRef?: { type: string; id: string } | null;
  actorLabel?: string | null;
};

export type CockpitFilterState = {
  locationIds: string[];
  teamIds: string[];
  roles: string[];
  timeWindow: "now" | "today";
};

export type CockpitQuickAction =
  | { type: "broadcast"; workspaceId: string; message: string }
  | { type: "create_task"; workspaceId: string; dateId: string; label: string }
  | { type: "log_note"; workspaceId: string; dateId: string; message: string };
