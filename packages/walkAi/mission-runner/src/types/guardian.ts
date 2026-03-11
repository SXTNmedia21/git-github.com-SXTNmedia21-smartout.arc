/** Event broadcast from engine to dashboard */
export type GuardianEvent = {
  type: "event";
  session_id: string;
  workspace_id: string;
  event_type: string;
  actor: "system" | "agent" | "user" | "guardian" | "admin";
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
};

/** Active session summary sent on connect / periodically */
export type GuardianSessionList = {
  type: "sessions";
  sessions: Array<{
    session_id: string;
    mission_id: string | null;
    profile_name: string;
    channel: string;
    status: string;
    current_stage: string | null;
    started_at: string;
  }>;
};

/** Command from dashboard to engine */
export type GuardianCommand =
  | { type: "subscribe"; session_id: string }
  | { type: "unsubscribe"; session_id: string }
  | { type: "change_stage"; session_id: string; target_stage_id: string }
  | { type: "whisper"; session_id: string; message: string };

/** Messages sent from server to client */
export type GuardianServerMessage = GuardianEvent | GuardianSessionList;
