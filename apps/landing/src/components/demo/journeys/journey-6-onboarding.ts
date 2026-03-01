// ============================================
// journey-6-onboarding.ts
// Journey config: "Onboarding — første dag som ny ansatt"
// Persona: Ny ansatt — new employee goes through day-one.
// 6-step scripted flow:
//   1. Welcome screen
//   2. Show arbeidsreglement
//   3. Accept terms → confirmed
//   4. First protocol item
//   5. Complete protocol
//   6. "Klar til vakt!" celebration
// Connected to: journeys/index.ts (registry), features/FeatureOnboarding.tsx
// ============================================

import type { JourneyConfig } from "./types";
import { FeatureOnboarding } from "../features/FeatureOnboarding";

export const journey6Onboarding: JourneyConfig = {
  id: "onboarding",
  persona: "ny-ansatt",
  title: "Onboarding — din første dag",
  subtitle: "Velkommen, godta reglement, fullfør opplæring — klar til vakt.",
  duration: "3 min",
  icon: "UserPlus",
  accentColor: "rose",
  featureComponent: FeatureOnboarding,
  steps: [
    {
      id: "welcome",
      assistantMessage:
        "Velkommen til Grand Hotel, Sara! Jeg er Lise, og jeg skal guide deg gjennom din første dag. Vi starter med arbeidsreglementet.",
      typingDelayMs: 1200,
      uiState: { phase: "welcome", termsAccepted: false, completedItems: 0 },
      quickReplies: [{ label: "La oss begynne!" }],
    },
    {
      id: "show-terms",
      assistantMessage:
        "Her er arbeidsreglementet. Les gjennom punktene, og trykk på «Godta»-knappen nederst når du er klar.",
      typingDelayMs: 800,
      uiState: { phase: "terms" },
      quickReplies: [{ label: "Jeg har lest det" }],
    },
    {
      id: "terms-accepted",
      assistantMessage:
        "Flott! Arbeidsreglementet er godtatt og registrert. Nå skal vi gjennom opplæringsprotokollen — 3 korte moduler.",
      typingDelayMs: 800,
      uiState: { termsAccepted: true },
      autoAdvanceMs: 2500,
    },
    {
      id: "protocol-start",
      assistantMessage:
        "Start med den første modulen: «Hygieneregler i kjøkkenet». Trykk på den for å lese og bekrefte.",
      typingDelayMs: 800,
      uiState: { phase: "protocol", completedItems: 0 },
      quickReplies: [{ label: "Les modul 1" }],
    },
    {
      id: "protocol-progress",
      assistantMessage:
        "Bra! Du har fullført hygienemodulen. De to neste handler om brannrutiner og allergener. La oss fullføre dem også.",
      typingDelayMs: 600,
      uiState: { completedItems: 1 },
      quickReplies: [{ label: "Fullfør resten" }],
    },
    {
      id: "complete",
      assistantMessage:
        "Fantastisk, Sara! Du har fullført alt — reglement godkjent, alle 3 opplæringsmoduler bestått. Du er nå «Klar til vakt». Leder kan se at du er 100% forberedt fra dag 1. Velkommen på laget!",
      typingDelayMs: 1200,
      uiState: { phase: "complete", completedItems: 3 },
      quickReplies: [{ label: "Takk, Lise!" }],
    },
  ],
};
