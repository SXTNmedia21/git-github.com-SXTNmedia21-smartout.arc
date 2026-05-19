"use client";

/**
 * Quiz interface for knowledge tests.
 * Shows questions, collects answers, submits for scoring.
 * Connected to: use-step-completion.ts (useSubmitTest), ProtocolList
 *
 * UI Events:
 * - action: selectAnswer (selects option for a question)
 * - action: submitTest (submits test attempt)
 * - color-regime: emerald (passed), red (failed), orange (in-progress)
 */

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronRight, Loader2, Trophy, RotateCcw } from "lucide-react";
import type { AssignedKnowledgeTest } from "../_hooks/use-assigned-protocols";
import { useSubmitTest } from "../_hooks/use-step-completion";

type Question = {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
};

type KnowledgeTestViewProps = {
  tests: AssignedKnowledgeTest[];
  assignmentId: string;
  isDark: boolean;
};

export function KnowledgeTestView({ tests, assignmentId, isDark }: KnowledgeTestViewProps) {
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [lastScore, setLastScore] = useState<{ score: number; passed: boolean } | null>(null);

  const submitTest = useSubmitTest();

  if (tests.length === 0) {
    return (
      <p
        className={`py-4 text-center text-sm ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
      >
        Ingen kunnskapstester i denne protokollen.
      </p>
    );
  }

  const activeTest = tests.find((t) => t.testId === activeTestId);
  const questions = (activeTest?.questions as Question[] | undefined) ?? [];

  function handleSubmit() {
    if (!activeTest) return;

    // Calculate score
    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correctOptionId) correct++;
    }
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= activeTest.passThreshold;

    setLastScore({ score, passed });
    setShowResults(true);

    submitTest.mutate({
      knowledgeTestId: activeTest.testId,
      protocolAssignmentId: assignmentId,
      answers,
      score,
      passed,
    });
  }

  function resetQuiz() {
    setAnswers({});
    setShowResults(false);
    setLastScore(null);
  }

  // List view
  if (!activeTestId) {
    return (
      <div className="space-y-2">
        {tests.map((test) => (
          <button
            key={test.testId}
            onClick={() => {
              setActiveTestId(test.testId);
              setAnswers({});
              setShowResults(false);
              setLastScore(null);
            }}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
              isDark
                ? "border-border bg-muted hover:border-border"
                : "border-border bg-muted hover:border-border"
            }`}
          >
            <div
              className={`rounded-lg border p-2 ${
                test.passed
                  ? isDark
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-emerald-200 bg-emerald-50 text-emerald-600"
                  : isDark
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {test.passed ? <Trophy className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold ${isDark ? "text-foreground" : "text-foreground"}`}
              >
                {test.name}
              </p>
              {test.description && (
                <p
                  className={`mt-0.5 truncate text-xs ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
                >
                  {test.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                {test.passed && (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
                    Bestatt {test.bestScore}%
                  </span>
                )}
                {test.attemptCount > 0 && !test.passed && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isDark ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {test.attemptCount} forsok
                  </span>
                )}
                <span
                  className={`text-[10px] font-medium ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
                >
                  Krav: {test.passThreshold}%
                </span>
              </div>
            </div>

            <ChevronRight
              className={`h-4 w-4 ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
    );
  }

  // Quiz view
  return (
    <div>
      {/* Back button + test name */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => {
            setActiveTestId(null);
            resetQuiz();
          }}
          className={`rounded-lg px-2 py-1 text-xs font-bold transition-colors ${
            isDark
              ? "text-muted-foreground hover:text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Tilbake
        </button>
        <div className={`h-4 w-px ${isDark ? "bg-border" : "bg-border"}`} />
        <h4 className={`text-sm font-bold ${isDark ? "text-foreground" : "text-foreground"}`}>
          {activeTest?.name}
        </h4>
      </div>

      {/* Results banner */}
      {showResults && lastScore && (
        <div
          className={`mb-4 flex items-center justify-between rounded-lg border p-3 ${
            lastScore.passed
              ? isDark
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-emerald-200 bg-emerald-50"
              : isDark
                ? "border-red-500/20 bg-red-500/5"
                : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {lastScore.passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span
              className={`text-sm font-bold ${
                lastScore.passed ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {lastScore.passed ? "Bestatt!" : "Ikke bestatt"} — {lastScore.score}%
            </span>
          </div>
          {!lastScore.passed && (
            <button
              onClick={resetQuiz}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                isDark
                  ? "bg-muted text-foreground hover:bg-muted"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              Prov igjen
            </button>
          )}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          // DB returns questions as JSONB (typed `unknown`); legacy rows may
          // omit `id`. Derive stable React-key fallback. State-keys still use
          // raw q.id so submitTest payload matches DB question identifiers.
          const qKey = q.id ?? `q-${idx}`;
          const selectedAnswer = answers[q.id];
          const isCorrect = showResults && selectedAnswer === q.correctOptionId;
          const isWrong = showResults && selectedAnswer && selectedAnswer !== q.correctOptionId;

          return (
            <div
              key={qKey}
              className={`rounded-lg border p-3 ${
                isDark ? "border-border bg-muted" : "border-border bg-muted"
              }`}
            >
              <p
                className={`mb-2 text-sm font-semibold ${isDark ? "text-foreground" : "text-foreground"}`}
              >
                <span
                  className={`mr-2 text-xs font-bold ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
                >
                  {idx + 1}.
                </span>
                {q.text}
              </p>

              <div className="space-y-1.5">
                {q.options.map((opt, optIdx) => {
                  const optKey = opt.id ?? `${qKey}-opt-${optIdx}`;
                  const isSelected = selectedAnswer === opt.id;
                  const isThisCorrect = showResults && opt.id === q.correctOptionId;

                  return (
                    <button
                      key={optKey}
                      onClick={() => {
                        if (showResults) return;
                        setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                      }}
                      disabled={showResults}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        isThisCorrect
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : isSelected && isWrong
                            ? "border-red-500/30 bg-red-500/10 text-red-500"
                            : isSelected
                              ? isDark
                                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                                : "border-orange-200 bg-orange-50 text-orange-600"
                              : isDark
                                ? "border-border text-foreground hover:border-border"
                                : "border-border text-foreground hover:border-border"
                      } disabled:cursor-default`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? isThisCorrect
                              ? "border-emerald-500 bg-emerald-500"
                              : isWrong
                                ? "border-red-500 bg-red-500"
                                : "border-orange-500 bg-orange-500"
                            : isDark
                              ? "border-border"
                              : "border-border"
                        }`}
                      >
                        {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-medium">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {isCorrect && <p className="mt-1.5 text-xs font-medium text-emerald-500">Riktig!</p>}
              {isWrong && <p className="mt-1.5 text-xs font-medium text-red-500">Feil svar.</p>}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!showResults && questions.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length || submitTest.isPending}
            className={`rounded-xl px-6 py-2.5 text-sm font-bold shadow-md transition-all disabled:opacity-50 ${
              isDark
                ? "bg-gradient-to-r from-orange-600 to-rose-600 text-white hover:shadow-lg"
                : "bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:shadow-lg"
            }`}
          >
            {submitTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send inn"}
          </button>
        </div>
      )}
    </div>
  );
}
