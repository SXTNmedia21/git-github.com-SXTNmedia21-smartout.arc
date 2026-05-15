import { z } from "zod";

export const MissionIdSchema = z.enum([
  "onboarding-interview",
  "landing-demo",
  "lise-interview",
  "mr-botsson",
  "haccp-inspector",
  "shift-assistant",
  "botsson-session",
]);
export type MissionId = z.infer<typeof MissionIdSchema>;

/** Built-in voice ids (LiveKit voice agent — ADR-0282) or custom voice IDs.
 *  Renamed from UltravoxVoice as part of F-JR-02 / ADR-0304 cleanup (audit 2026-05-15). */
export type VoiceId = "terrence" | "mark" | "jessica" | "sarah" | "tina" | (string & {});

export type MissionStageOverride = {
  id: string;
  voice?: VoiceId;
  temperature?: number;
  posture_override?: Partial<{
    formality: number;
    assertiveness: number;
    warmth: number;
    humor: number;
    verbosity: number;
  }>;
};

export type AgentMission = {
  id: MissionId;
  name: string;
  description: string;
  systemPrompt: string;
  voice?: VoiceId;
  language: "no" | "en" | "sv";
  temperature?: number;
  maxDurationSeconds?: number;
  firstSpeaker?: "agent" | "user";
  initialOutputMedium?: "voice" | "text";
  templateContext?: Record<string, string>;
  agentDisplayName: string;
  greeting: string;
  uiDescription: string;
  stages?: MissionStageOverride[];
  /** Client-side tool definitions shipped with this mission (Ultravox format). */
  clientTools?: ReadonlyArray<{
    temporaryTool: {
      modelToolName: string;
      description: string;
      dynamicParameters: ReadonlyArray<{
        name: string;
        location: "PARAMETER_LOCATION_BODY";
        schema: Record<string, unknown>;
        required?: boolean;
      }>;
      client: Record<string, never>;
    };
  }>;
};

export type MissionManifestEntry = {
  id: MissionId;
  agentDisplayName: string;
  greeting: string;
  uiDescription: string;
  voice?: VoiceId;
  language: "no" | "en" | "sv";
};
