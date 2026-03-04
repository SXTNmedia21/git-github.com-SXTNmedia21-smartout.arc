// ============================================
// journey-1-punch-in.ts
// Journey config: "Stämpla in på vakt og utfør oppgavene"
// Persona: Ansatt — employee punches in and completes tasks.
// 5-step scripted flow:
//   1. Welcome + show clock-in screen
//   2. Employee clocks in → confirmed
//   3. Task list appears → first task highlighted
//   4. Employee checks a task → encouragement
//   5. Manager stats view — real-time oversight
// Connected to: journeys/index.ts (registry), features/FeaturePunchIn.tsx
// ============================================

import type { JourneyConfig } from "./types";
import { FeaturePunchIn } from "../features/FeaturePunchIn";

export const journey1PunchIn: JourneyConfig = {
  id: "punch-in",
  persona: "ansatt",
  title: "Stämpla in og utfør oppgaver",
  subtitle: "Start vakten, stempel inn og huk av dagens oppgaver.",
  duration: "3 min",
  icon: "Clock",
  accentColor: "orange",
  featureComponent: FeaturePunchIn,
  steps: [
    {
      id: "welcome",
      assistantMessage:
        "Hei Maria! Du starter vakt om 2 minutter. Trykk på «Stempel inn»-knappen for å registrere fremmøte.",
      typingDelayMs: 1000,
      uiState: { phase: "clock-in", clockedIn: false },
      quickReplies: [{ label: "Stempel inn" }],
    },
    {
      id: "clock-in-prompt",
      assistantMessage:
        "Perfekt! Du er nå innstemplet — 2 minutter før vaktstart. Det gir plusspoeng i Smartout. Her er dagens oppgaver.",
      typingDelayMs: 800,
      uiState: { clockedIn: true },
      autoAdvanceMs: 2500,
    },
    {
      id: "tasks-intro",
      assistantMessage:
        "Du har 4 oppgaver i dag. Start med den øverste — «Sjekk kjøletemperatur». Trykk på oppgaven for å huke den av.",
      typingDelayMs: 800,
      uiState: { phase: "tasks", completedTasks: 0 },
      quickReplies: [{ label: "Huk av oppgave" }],
    },
    {
      id: "check-task",
      assistantMessage:
        "Bra jobba! Kjøletemperaturen er sjekket. Du er godt i gang. Slik fortsetter du til alle oppgavene er fullført.",
      typingDelayMs: 600,
      uiState: { completedTasks: 1 },
      autoAdvanceMs: 3000,
    },
    {
      id: "stats-view",
      assistantMessage:
        "Slik ser det ut fra lederens side — de ser innstemplinger og oppgaver i sanntid. Full oversikt, uten å forstyrre ansatte.",
      typingDelayMs: 800,
      uiState: { phase: "stats" },
      quickReplies: [{ label: "Imponerende!" }],
    },
  ],
};
