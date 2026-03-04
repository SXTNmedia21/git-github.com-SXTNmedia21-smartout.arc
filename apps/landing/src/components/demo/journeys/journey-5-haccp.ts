// ============================================
// journey-5-haccp.ts
// Journey config: "Utfør en HACCP-kontroll"
// Persona: Ansatt — employee does daily temperature checks.
// 6-step scripted flow:
//   1. Intro — explain HACCP check
//   2. Check unit 1 (OK at 3.2°C)
//   3. Check unit 2 (Avvik! +9.1°C)
//   4. Alert triggered — explain what happens
//   5. Check unit 3 (OK at -18.5°C)
//   6. Summary — 2 OK, 1 avvik resolved
// Connected to: journeys/index.ts (registry), features/FeatureHaccp.tsx
// ============================================

import type { JourneyConfig } from "./types";
import { FeatureHaccp } from "../features/FeatureHaccp";

export const journey5Haccp: JourneyConfig = {
  id: "haccp",
  persona: "ansatt",
  title: "Utfør en HACCP-kontroll",
  subtitle: "Sjekk temperaturer og registrer eventuelle avvik.",
  duration: "2 min",
  icon: "Thermometer",
  accentColor: "emerald",
  featureComponent: FeatureHaccp,
  steps: [
    {
      id: "intro",
      assistantMessage:
        "God morgen! Tid for daglig HACCP-kontroll. Vi skal sjekke temperaturen i 3 kjøleenheter. Trykk på den første for å starte.",
      typingDelayMs: 1000,
      uiState: { phase: "checklist", checkedUnits: 0, showAlert: false },
      quickReplies: [{ label: "Start kontroll" }],
    },
    {
      id: "check-1",
      assistantMessage:
        "Kjøleskap 1: +3.2°C — godt innenfor grensen på +4°C. Godkjent! Gå videre til neste enhet.",
      typingDelayMs: 800,
      uiState: { checkedUnits: 1 },
      quickReplies: [{ label: "Sjekk neste" }],
    },
    {
      id: "check-2-avvik",
      assistantMessage:
        "Kjølerom (Lager B): +9.1°C — det er 5.1°C over grensen! Dette er et temperaturavvik. Jeg varsler avdelingsleder automatisk.",
      typingDelayMs: 1000,
      uiState: { checkedUnits: 2, showAlert: true },
      quickReplies: [{ label: "Hva skjer nå?" }],
    },
    {
      id: "alert-explain",
      assistantMessage:
        "Avviket er registrert og sendt til Erik (leder). Han får pushvarsel nå. Matvarer i kjølerommet må vurderes. Fortsett med siste enhet.",
      typingDelayMs: 800,
      quickReplies: [{ label: "Sjekk siste enhet" }],
    },
    {
      id: "check-3",
      assistantMessage:
        "Fryser: −18.5°C — godt under grensen på −15°C. Godkjent! Alle enheter er kontrollert.",
      typingDelayMs: 800,
      uiState: { checkedUnits: 3 },
      autoAdvanceMs: 2500,
    },
    {
      id: "summary",
      assistantMessage:
        "HACCP-kontroll fullført: 2 godkjent, 1 avvik meldt og håndtert. Alt er logget automatisk for Mattilsynet. Slik sikrer Smartout food safety compliance — hver eneste dag.",
      typingDelayMs: 1000,
      uiState: { phase: "resolved" },
      quickReplies: [{ label: "Imponerende!" }],
    },
  ],
};
