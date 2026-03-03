import { z } from "zod";

export const MissionIdSchema = z.enum([
  "onboarding-interview",
  "landing-demo",
  "mr-botsson",
  "haccp-inspector",
  "shift-assistant",
]);
export type MissionId = z.infer<typeof MissionIdSchema>;

export type UltravoxVoice = "terrence" | "mark" | "jessica" | "sarah" | "tina";

export type MissionStageOverride = {
  id: string;
  voice?: UltravoxVoice;
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
  voice?: UltravoxVoice;
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
};

export type MissionManifestEntry = {
  id: MissionId;
  agentDisplayName: string;
  greeting: string;
  uiDescription: string;
  voice?: UltravoxVoice;
  language: "no" | "en" | "sv";
};
