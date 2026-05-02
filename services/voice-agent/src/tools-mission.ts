// services/voice-agent/src/tools-mission.ts
//
// Thin BFF call wrappers that let the LiveKit voice agent ask Mr. Botsson
// mission-awareness questions via the stage-engine /agent/chat endpoint.
//
// These are NOT capability tools — they are helper functions the voice
// agent can call when it needs mission-progress context during a live
// voice session. They map Norwegian natural-language questions onto
// well-formed stage-engine requests so the LLM controlling the voice
// session gets the same mission/roadmap context as the chat surface.
//
// ADR-0078: voice is never used to collect PII. These wrappers only
// query read-only mission state — safe for voice per allowedChannels.
// ADR-0132: mobile/voice routes through web BFF → stage-engine, not
// direct to capabilities. These wrappers follow that pattern.

const STAGE_ENGINE_URL = process.env.STAGE_ENGINE_URL ?? "http://localhost:5010";

type AskMissionParams = {
  profileId: string;
  workspaceId: string;
  sessionId: string;
};

type StageEngineResponse = {
  response?: string;
  error?: string;
};

/**
 * Asks Botsson for the current user's mission progress.
 *
 * Routes to stage-engine /agent/chat with a fixed Norwegian phrase that
 * reliably classifies as intent="mission" → getActiveMissions tool.
 * Returns the LLM's natural-language response — ready for voice TTS.
 */
export async function getMissionProgress(params: AskMissionParams): Promise<string> {
  const { profileId, workspaceId, sessionId } = params;

  try {
    const res = await fetch(`${STAGE_ENGINE_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hva er min nåværende fremgang i pågående misjoner?",
        session_id: sessionId,
        profile_id: profileId,
        workspace_id: workspaceId,
        channel: "voice",
      }),
    });

    if (!res.ok) {
      return "Beklager, jeg kunne ikke hente misjonstatus akkurat nå.";
    }

    const data = (await res.json()) as StageEngineResponse;
    return data.response ?? "Ingen aktive misjoner funnet.";
  } catch {
    return "Beklager, jeg kunne ikke nå tjenesten. Prøv via chat.";
  }
}

/**
 * Asks Botsson what the user should do next across their active missions.
 *
 * Routes to stage-engine /agent/chat with a fixed Norwegian phrase that
 * classifies as intent="mission" → getActiveMissions + getWorkspaceRoadmap.
 */
export async function getWhatsNext(params: AskMissionParams): Promise<string> {
  const { profileId, workspaceId, sessionId } = params;

  try {
    const res = await fetch(`${STAGE_ENGINE_URL}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hva er det neste jeg burde gjøre i mine pågående oppdrag?",
        session_id: sessionId,
        profile_id: profileId,
        workspace_id: workspaceId,
        channel: "voice",
      }),
    });

    if (!res.ok) {
      return "Beklager, jeg kunne ikke hente neste steg akkurat nå.";
    }

    const data = (await res.json()) as StageEngineResponse;
    return data.response ?? "Ingen pågående oppdrag funnet.";
  } catch {
    return "Beklager, jeg kunne ikke nå tjenesten. Prøv via chat.";
  }
}
