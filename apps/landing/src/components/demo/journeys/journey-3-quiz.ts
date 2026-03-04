// ============================================
// journey-3-quiz.ts
// Journey config: "Utfør en kunskapsquiz"
// Persona: Ansatt — employee takes a knowledge quiz.
// 7-step scripted flow:
//   1. Intro — quiz description
//   2. Question 1 — food safety temp
//   3. Feedback for Q1
//   4. Question 2 — room temp limit
//   5. Feedback for Q2
//   6. Question 3 — allergic reaction
//   7. Result screen with score
// Connected to: journeys/index.ts (registry), features/FeatureQuiz.tsx
// ============================================

import type { JourneyConfig } from "./types";
import { FeatureQuiz } from "../features/FeatureQuiz";

export const journey3Quiz: JourneyConfig = {
  id: "quiz",
  persona: "ansatt",
  title: "Utfør en kunnskapsquiz",
  subtitle: "Test kunnskapen din med spørsmål fra opplæringen.",
  duration: "2 min",
  icon: "GraduationCap",
  accentColor: "purple",
  featureComponent: FeatureQuiz,
  steps: [
    {
      id: "intro",
      assistantMessage:
        "Hei! Klar for en liten quiz? Vi skal teste det du har lært om mattrygghet og HMS. 3 spørsmål — dette klarer du!",
      typingDelayMs: 1000,
      uiState: { phase: "intro" },
      quickReplies: [{ label: "Start quiz!" }],
    },
    {
      id: "q1",
      assistantMessage:
        "Spørsmål 1: Hva er maks tillatt temperatur i kjøleskapet? Velg svaret i panelet til venstre.",
      typingDelayMs: 800,
      uiState: { phase: "quiz", currentQuestion: 0, answers: [], showFeedback: false },
      quickReplies: [{ label: "4°C" }, { label: "8°C" }],
    },
    {
      id: "q1-feedback",
      assistantMessage:
        "Helt riktig — 4°C! Over det begynner bakteriene å trives. Bra jobba! Neste spørsmål.",
      typingDelayMs: 600,
      uiState: { answers: [1], showFeedback: true },
      autoAdvanceMs: 2500,
    },
    {
      id: "q2",
      assistantMessage: "Spørsmål 2: Hvor lenge kan fersk mat stå i romtemperatur? Velg svaret.",
      typingDelayMs: 800,
      uiState: { currentQuestion: 1, answers: [1], showFeedback: false },
      quickReplies: [{ label: "2 timer" }, { label: "4 timer" }],
    },
    {
      id: "q2-feedback",
      assistantMessage:
        "Riktig igjen! Etter 2 timer må maten kastes eller kjøles ned. Du kan dette!",
      typingDelayMs: 600,
      uiState: { answers: [1, 2], showFeedback: true },
      autoAdvanceMs: 2500,
    },
    {
      id: "q3",
      assistantMessage: "Siste spørsmål: Hva gjør du først ved en allergisk reaksjon hos en gjest?",
      typingDelayMs: 800,
      uiState: { currentQuestion: 2, answers: [1, 2], showFeedback: false },
      quickReplies: [{ label: "Ring 113" }, { label: "Kontakt leder" }],
    },
    {
      id: "result",
      assistantMessage:
        "3 av 3 — full pott! Du er godt forberedt. Resultatet er registrert i profilen din, og leder kan se at du har bestått.",
      typingDelayMs: 800,
      uiState: { phase: "result", answers: [1, 2, 0], showFeedback: true },
      quickReplies: [{ label: "Supert!" }],
    },
  ],
};
