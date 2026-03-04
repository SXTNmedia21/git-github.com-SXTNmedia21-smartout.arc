// ============================================
// journey-4-deviation.ts
// Journey config: "Registrer en avviksmeldning"
// Persona: Ansatt — employee reports an incident via chat.
// 6-step scripted flow:
//   1. Intro — explain the process
//   2. Ask what happened → field appears
//   3. Ask when → field appears
//   4. Ask where → field appears
//   5. Confirm severity → field appears
//   6. Summary card — submitted
// Connected to: journeys/index.ts (registry), features/FeatureDeviation.tsx
// ============================================

import type { JourneyConfig } from "./types";
import { FeatureDeviation } from "../features/FeatureDeviation";

export const journey4Deviation: JourneyConfig = {
  id: "deviation",
  persona: "ansatt",
  title: "Registrer en avviksmeldning",
  subtitle: "Meld inn et avvik via chat — raskt og strukturert.",
  duration: "2 min",
  icon: "AlertTriangle",
  accentColor: "amber",
  featureComponent: FeatureDeviation,
  steps: [
    {
      id: "intro",
      assistantMessage:
        "Hei! Trenger du å melde inn et avvik? Jeg hjelper deg å fylle ut meldingen steg for steg. Hva har skjedd?",
      typingDelayMs: 1000,
      uiState: { phase: "empty", fields: {} },
      quickReplies: [{ label: "Vannlekkasje i kjøkkenet" }, { label: "Jeg vil forklare" }],
    },
    {
      id: "what",
      assistantMessage: "Vannlekkasje i kjøkkenet — notert. Når skjedde dette?",
      typingDelayMs: 800,
      uiState: {
        phase: "building",
        fields: { what: "Vannlekkasje oppdaget under oppvasken i kjøkkenet" },
      },
      quickReplies: [{ label: "For ca. 10 minutter siden" }, { label: "Akkurat nå" }],
    },
    {
      id: "when",
      assistantMessage: "OK, ca. kl. 14:20. Hvor i kjøkkenet skjedde det? Vær så presis du kan.",
      typingDelayMs: 800,
      uiState: {
        fields: {
          what: "Vannlekkasje oppdaget under oppvasken i kjøkkenet",
          when: "Ca. kl. 14:20 — for 10 minutter siden",
        },
      },
      quickReplies: [{ label: "Ved oppvaskmaskinen" }],
    },
    {
      id: "where",
      assistantMessage:
        "Ved oppvaskmaskinen — notert. Siste spørsmål: Hvor alvorlig vil du si dette er?",
      typingDelayMs: 800,
      uiState: {
        fields: {
          what: "Vannlekkasje oppdaget under oppvasken i kjøkkenet",
          when: "Ca. kl. 14:20 — for 10 minutter siden",
          where: "Kjøkken, ved oppvaskmaskinen (hovedkjøkken 2. etg)",
        },
      },
      quickReplies: [{ label: "Middels" }, { label: "Høy" }],
    },
    {
      id: "severity",
      assistantMessage:
        "Forstått — alvorlighetsgrad satt til Middels. Jeg sender meldingen til avdelingsleder Erik nå.",
      typingDelayMs: 600,
      uiState: {
        fields: {
          what: "Vannlekkasje oppdaget under oppvasken i kjøkkenet",
          when: "Ca. kl. 14:20 — for 10 minutter siden",
          where: "Kjøkken, ved oppvaskmaskinen (hovedkjøkken 2. etg)",
          severity: "Middels",
        },
      },
      autoAdvanceMs: 2000,
    },
    {
      id: "submitted",
      assistantMessage:
        "Ferdig! Avviksmeldingen er registrert som AV-2026-0047 og sendt til Erik Paulsen. Du får varsel når den er behandlet. Slik enkelt er det å melde avvik i Smartout.",
      typingDelayMs: 1000,
      uiState: {
        phase: "submitted",
        fields: {
          what: "Vannlekkasje oppdaget under oppvasken i kjøkkenet",
          when: "Ca. kl. 14:20 — for 10 minutter siden",
          where: "Kjøkken, ved oppvaskmaskinen (hovedkjøkken 2. etg)",
          severity: "Middels",
        },
      },
      quickReplies: [{ label: "Veldig enkelt!" }],
    },
  ],
};
