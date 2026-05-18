import type { SmartoutEvent, EventMeta } from "../registry";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  category: string;
  actor_id: string | null;
  workspace_id: string | null;
  correlation_id?: string;
  properties: Record<string, unknown>;
  status: "ok" | "error";
  error?: string;
}

export function logToStdout(event: SmartoutEvent, meta: EventMeta): void {
  const entry: LogEntry = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    level: "info",
    action: event.event,
    category: meta.category,
    actor_id: event.actor_id,
    workspace_id: event.workspace_id,
    correlation_id: event.correlation_id,
    properties: event.properties as Record<string, unknown>,
    status: "ok",
  };

  // Output JSON cleanly without modifying native objects,
  // directly consumable by Datadog, Axiom, Supabase Logs, etc.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}
