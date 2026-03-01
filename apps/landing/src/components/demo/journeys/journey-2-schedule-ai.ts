// ============================================
// journey-2-schedule-ai.ts
// Journey config: "Lag vaktlista med AI-assistent"
// Persona: Leder — manager uses AI to fill a schedule gap.
// 5-step scripted flow:
//   1. Welcome + show schedule overview
//   2. Highlight the Tuesday coverage gap
//   3. Lise suggests shifts to fill the gap
//   4. Manager approves → shifts turn green
//   5. Stats summary — 100% coverage achieved
// Connected to: journeys/index.ts (registry), features/FeatureSchedule.tsx
// ============================================

import type { JourneyConfig } from "./types";
import { FeatureSchedule } from "../features/FeatureSchedule";

export const journey2ScheduleAi: JourneyConfig = {
  id: "schedule-ai",
  persona: "leder",
  title: "Lag vaktlista med AI",
  subtitle: "La Lise fylle dekningshullet i vaktplanen automatisk.",
  duration: "2 min",
  icon: "CalendarDays",
  accentColor: "cyan",
  featureComponent: FeatureSchedule,
  steps: [
    {
      id: "welcome",
      assistantMessage:
        "Hei! Jeg er Lise, din AI-assistent for vaktplanlegging. Her ser du ukeplanen for Housekeeping. La oss ta en titt på dekningen.",
      typingDelayMs: 1000,
      quickReplies: [{ label: "Vis meg uken" }],
    },
    {
      id: "highlight-gap",
      assistantMessage:
        "Ser du tirsdagen? Den er helt tom — ingen er satt opp. Det betyr null dekning på Housekeeping den dagen. Skal jeg finne en løsning?",
      typingDelayMs: 800,
      uiState: { showGapHighlight: true },
      quickReplies: [{ label: "Ja, fiks det!" }, { label: "Hvem er tilgjengelig?" }],
    },
    {
      id: "ai-suggestion",
      assistantMessage:
        "Basert på tilgjengelighet og kompetanse foreslår jeg Jonas K. (07:00–15:00) og Sara L. (08:00–16:00) på tirsdag. Begge har godkjent kompetanse for Housekeeping. Godkjenn?",
      typingDelayMs: 1200,
      uiState: { showGapHighlight: false, showAiSuggestion: true },
      quickReplies: [{ label: "Godkjenn begge" }, { label: "Vis meg alternativ" }],
    },
    {
      id: "approved",
      assistantMessage:
        "Vaktene er godkjent! Jonas og Sara har fått varsel på telefonen. Tirsdagen er nå dekket.",
      typingDelayMs: 600,
      uiState: { showAiSuggestion: false, showApproved: true },
      autoAdvanceMs: 3000,
    },
    {
      id: "stats",
      assistantMessage:
        "Her er oppsummeringen: 100% dekningsgrad denne uken, ingen overtid, og 3 av 4 ansattønsker oppfylt. Slik ser det ut fra lederens side — full kontroll på sekunder.",
      typingDelayMs: 800,
      uiState: { showStats: true },
      quickReplies: [{ label: "Imponerende!" }],
    },
  ],
};
