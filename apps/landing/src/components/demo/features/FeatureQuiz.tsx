// ============================================
// FeatureQuiz.tsx
// Demo feature component: 3-question knowledge quiz.
// Employee answers multiple-choice questions about
// hotel food safety. Shows correct/wrong feedback
// after each answer and a final score screen.
// Connected to: journeys/journey-3-quiz.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, CheckCircle2, XCircle, Trophy, Star } from "lucide-react";
import type { DemoFeatureProps } from "../journeys/types";

// ── Quiz data ──────────────────────────────────────────

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

const QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question: "Hva er maks tillatt temperatur i et kjøleskap for matvarer?",
    options: ["2°C", "4°C", "8°C", "10°C"],
    correctIndex: 1,
    explanation: "Riktig! 4°C er maks tillatt temperatur for å hindre bakterievekst i matvarer.",
  },
  {
    id: "q2",
    question: "Hvor lenge kan fersk mat stå i romtemperatur før den må kastes?",
    options: ["30 minutter", "1 time", "2 timer", "4 timer"],
    correctIndex: 2,
    explanation:
      "Riktig! Etter 2 timer i romtemperatur begynner bakteriene å vokse til farlige nivåer.",
  },
  {
    id: "q3",
    question: "Hva gjør du først ved et allergisk reaksjon hos en gjest?",
    options: ["Ring 113 umiddelbart", "Gi gjesten vann", "Fjern allergenet", "Kontakt leder"],
    correctIndex: 0,
    explanation:
      "Riktig! Ved alvorlig allergisk reaksjon er det viktigste å ringe nødnummeret umiddelbart.",
  },
];

// ── Component ───────────────────────────────────────────

/**
 * Renders a quiz UI that responds to demo step state.
 *
 * UI state keys used:
 * - phase: "intro" | "quiz" | "result"
 * - currentQuestion: index of active question (0–2)
 * - answers: array of selected answer indices
 * - showFeedback: whether to show correct/wrong after selection
 */
export function FeatureQuiz({
  currentStepId: _currentStepId,
  uiState,
  onInteraction,
}: DemoFeatureProps) {
  const phase = (uiState.phase as string) ?? "intro";
  const currentQuestion = (uiState.currentQuestion as number) ?? 0;
  const answers = (uiState.answers as number[]) ?? [];
  const showFeedback = uiState.showFeedback === true;

  const question = QUESTIONS[currentQuestion];
  const selectedAnswer = answers[currentQuestion];
  const isCorrect = selectedAnswer === question?.correctIndex;
  const score = answers.filter((a, i) => a === QUESTIONS[i]?.correctIndex).length;

  return (
    <div className="flex h-full flex-col gap-5">
      <AnimatePresence mode="wait">
        {/* Phase: Intro */}
        {phase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
              <GraduationCap className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Kunnskapsquiz</h2>
              <p className="mt-2 max-w-sm text-sm text-zinc-400">
                Test kunnskapen din om mattrygghet og HMS. 3 spørsmål, ca. 2 minutter.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" />3 spørsmål
              </span>
              <span className="h-4 w-px bg-zinc-700" />
              <span>Mattrygghet & HMS</span>
            </div>
          </motion.div>
        )}

        {/* Phase: Quiz questions */}
        {phase === "quiz" && question && (
          <motion.div
            key={`question-${currentQuestion}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-5"
          >
            {/* Question header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-400">
                Spørsmål {currentQuestion + 1} av {QUESTIONS.length}
              </span>
              <div className="flex gap-1">
                {QUESTIONS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full ${
                      i < currentQuestion
                        ? "bg-purple-500"
                        : i === currentQuestion
                          ? "bg-purple-400"
                          : "bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question text */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-6">
              <p className="text-lg font-semibold text-white">{question.question}</p>
            </div>

            {/* Answer options */}
            <div className="flex flex-col gap-2">
              {question.options.map((option, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrectOption = i === question.correctIndex;

                let optionStyle = "border-white/[0.06] bg-[#0a0a0c] hover:border-purple-500/30";
                if (showFeedback && isSelected && isCorrect) {
                  optionStyle = "border-emerald-500/30 bg-emerald-500/10";
                } else if (showFeedback && isSelected && !isCorrect) {
                  optionStyle = "border-red-500/30 bg-red-500/10";
                } else if (showFeedback && isCorrectOption) {
                  optionStyle = "border-emerald-500/20 bg-emerald-500/5";
                }

                return (
                  <motion.button
                    key={i}
                    onClick={() => {
                      if (!showFeedback) onInteraction(`answer-${i}`);
                    }}
                    disabled={showFeedback}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${optionStyle}`}
                    whileTap={!showFeedback ? { scale: 0.98 } : {}}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        showFeedback && isCorrectOption
                          ? "bg-emerald-500/20 text-emerald-300"
                          : showFeedback && isSelected
                            ? "bg-red-500/20 text-red-300"
                            : "bg-white/[0.06] text-zinc-400"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span
                      className={`flex-1 text-sm ${showFeedback && isCorrectOption ? "text-emerald-200" : "text-zinc-200"}`}
                    >
                      {option}
                    </span>
                    {showFeedback && isCorrectOption && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    {showFeedback && isSelected && !isCorrect && (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Feedback text */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 text-sm ${
                    isCorrect
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                      : "border-red-500/20 bg-red-500/5 text-red-300"
                  }`}
                >
                  {question.explanation}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Phase: Result screen */}
        {phase === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10"
            >
              <Trophy className="h-10 w-10 text-amber-400" />
            </motion.div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Quiz fullført!</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Du fikk {score} av {QUESTIONS.length} riktige
              </p>
            </div>

            {/* Star rating */}
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                >
                  <Star
                    className={`h-8 w-8 ${
                      i < score ? "fill-amber-400 text-amber-400" : "text-zinc-700"
                    }`}
                  />
                </motion.div>
              ))}
            </div>

            {/* Score bar */}
            <div className="w-full max-w-xs">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-amber-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${(score / QUESTIONS.length) * 100}%` }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-zinc-500">
                {Math.round((score / QUESTIONS.length) * 100)}% riktig
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
