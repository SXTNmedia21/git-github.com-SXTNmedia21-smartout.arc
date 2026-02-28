import { MISSIONS } from "./registry";
import type { MissionId, MissionManifestEntry } from "./types";

/**
 * Client-safe mission metadata — no system prompts included.
 * Import this in "use client" components to display the right
 * agent name, greeting, and description without leaking prompts.
 */
export const MISSION_MANIFEST: Record<MissionId, MissionManifestEntry> = Object.fromEntries(
  Object.values(MISSIONS).map((m) => [
    m.id,
    {
      id: m.id,
      agentDisplayName: m.agentDisplayName,
      greeting: m.greeting,
      uiDescription: m.uiDescription,
      voice: m.voice,
      language: m.language,
    },
  ]),
) as Record<MissionId, MissionManifestEntry>;

export function getMissionManifest(id: string): MissionManifestEntry | undefined {
  return MISSION_MANIFEST[id as MissionId];
}
