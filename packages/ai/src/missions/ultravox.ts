import { getMission } from "./registry";
import type { AgentMission } from "./types";

const ULTRAVOX_BASE = "https://api.ultravox.ai/api";

export type StartCallOptions = {
  missionId: string;
  apiKey: string;
  agentId?: string;
  metadata?: Record<string, string>;
  templateContext?: Record<string, string>;
  selectedTools?: Array<Record<string, unknown>>;
};

export type CallResult = {
  joinUrl: string;
  callId: string;
  mission: AgentMission;
  voiceFallbackUsed: boolean;
};

function toInitialOutputMediumEnum(
  medium: AgentMission["initialOutputMedium"] | undefined,
): "MESSAGE_MEDIUM_VOICE" | "MESSAGE_MEDIUM_TEXT" {
  return medium === "text" ? "MESSAGE_MEDIUM_TEXT" : "MESSAGE_MEDIUM_VOICE";
}

/**
 * Start an Ultravox call using a mission configuration.
 *
 * If an agentId is provided, the call is made against a pre-configured
 * Ultravox agent (created via their dashboard). The mission's systemPrompt
 * and voice settings are sent as overrides.
 *
 * If no agentId is provided, the call is made with an inline system prompt
 * via the /calls endpoint directly.
 */
export async function startMissionCall(options: StartCallOptions): Promise<CallResult> {
  const mission = getMission(options.missionId);
  if (!mission) {
    throw new Error(
      `Unknown mission "${options.missionId}". Available: ${Object.keys(getMission).length ? "check registry" : "none"}`,
    );
  }

  const isAgentCall = Boolean(options.agentId);
  const url = isAgentCall
    ? `${ULTRAVOX_BASE}/agents/${options.agentId}/calls`
    : `${ULTRAVOX_BASE}/calls`;

  // Agent calls (/agents/{id}/calls) get their systemPrompt from the agent
  // config and only accept templateContext for mustache substitution.
  // Direct calls (/calls) require an inline systemPrompt.
  const callBody: Record<string, unknown> = {
    medium: { webRtc: {} },
    initialOutputMedium: toInitialOutputMediumEnum(mission.initialOutputMedium),
    metadata: {
      mission_id: mission.id,
      ...options.metadata,
    },
  };

  if (mission.voice) {
    callBody.voice = mission.voice;
  }

  if (mission.maxDurationSeconds) {
    callBody.maxDuration = `${mission.maxDurationSeconds}s`;
  }

  const mergedContext = {
    ...mission.templateContext,
    ...options.templateContext,
  };

  if (isAgentCall) {
    // Agent endpoint only accepts: templateContext, initialMessages, metadata,
    // medium, joinTimeout, maxDuration, recordingEnabled, initialOutputMedium,
    // firstSpeakerSettings, dataConnection, experimentalSettings, callbacks,
    // voice, voiceOverrides. No systemPrompt, temperature, firstSpeaker, or
    // selectedTools.
    if (Object.keys(mergedContext).length > 0) {
      callBody.templateContext = mergedContext;
    }
    if (mission.firstSpeaker) {
      callBody.firstSpeakerSettings =
        mission.firstSpeaker === "agent" ? { agent: {} } : { user: {} };
    }
  } else {
    // Direct call: inline systemPrompt with placeholders resolved manually.
    callBody.systemPrompt = mission.systemPrompt;
    callBody.temperature = mission.temperature ?? 0.4;
    if (Object.keys(mergedContext).length > 0) {
      let prompt = callBody.systemPrompt as string;
      for (const [key, value] of Object.entries(mergedContext)) {
        prompt = prompt.replaceAll(`{{${key}}}`, value);
      }
      callBody.systemPrompt = prompt;
    }
    if (mission.firstSpeaker) {
      callBody.firstSpeaker =
        mission.firstSpeaker === "agent" ? "FIRST_SPEAKER_AGENT" : "FIRST_SPEAKER_USER";
    }
    if (options.selectedTools && options.selectedTools.length > 0) {
      callBody.selectedTools = options.selectedTools;
    }
  }

  const makeRequest = async (body: Record<string, unknown>) =>
    fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": options.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let response = await makeRequest(callBody);
  let errText = "";
  let voiceFallbackUsed = false;

  if (!response.ok) {
    errText = await response.text();
    // Some accounts do not have all named voices enabled; retry without voice.
    if (callBody.voice && /voice .* does not exist/i.test(errText)) {
      const retryBody = { ...callBody };
      delete retryBody.voice;
      voiceFallbackUsed = true;
      response = await makeRequest(retryBody);
      if (!response.ok) {
        errText = await response.text();
      }
    }
  }

  if (!response.ok) {
    if (!errText) {
      errText = await response.text();
    }
    throw new Error(`Ultravox API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { joinUrl: string; callId: string };

  return {
    joinUrl: data.joinUrl,
    callId: data.callId,
    mission,
    voiceFallbackUsed,
  };
}
