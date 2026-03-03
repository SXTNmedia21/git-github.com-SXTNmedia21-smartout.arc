import { z } from "zod";

export const MissionIdSchema = z.enum([
  "onboarding-interview",
  "landing-demo",
  "mr-botsson",
  "haccp-inspector",
  "shift-assistant",
]);
export type MissionId = z.infer<typeof MissionIdSchema>;

/** Built-in Ultravox voices or custom voice IDs (UUIDs from cloned/custom voices) */
export type UltravoxVoice = "terrence" | "mark" | "jessica" | "sarah" | "tina" | (string & {});

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
};

export type MissionManifestEntry = {
  id: MissionId;
  agentDisplayName: string;
  greeting: string;
  uiDescription: string;
  voice?: UltravoxVoice;
  language: "no" | "en" | "sv";
};
