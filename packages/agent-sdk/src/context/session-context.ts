import type { AgentChannel } from "../types";

/**
 * Session identity — who the user is and what channel they're on.
 * Passed to the session creation API.
 */
export type SessionIdentity = {
  userId?: string;
  profileId?: string;
  workspaceId?: string;
  channel: AgentChannel;
};

/**
 * Builds the API request body for starting a voice session.
 */
export function buildSessionRequest(params: {
  missionId: string;
  tools?: { definitions: unknown[] };
  identity?: SessionIdentity;
  extraParams?: Record<string, unknown>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    mission_id: params.missionId,
    ...(params.extraParams ?? {}),
  };

  if (params.tools?.definitions && params.tools.definitions.length > 0) {
    body.selected_tools = params.tools.definitions;
  }

  if (params.identity) {
    if (params.identity.userId) body.user_id = params.identity.userId;
    if (params.identity.profileId) body.profile_id = params.identity.profileId;
    if (params.identity.workspaceId) body.workspace_id = params.identity.workspaceId;
    body.channel = params.identity.channel;
  }

  return body;
}
