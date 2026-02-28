"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Star,
  MessageSquare,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Search,
  BookOpen,
  Radio,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { WEB_APP_LINKS } from "../lib/web-app-url";

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = "input" | "analyzing" | "results";

type AnalysisStep = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
};

type ScoreCard = {
  label: string;
  value: number;
  max: number;
  suffix: string;
  insight: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const ANALYSIS_STEPS: AnalysisStep[] = [
  { label: "Scanner nettsiden...", icon: Search, duration: 1000 },
  { label: "Leser anmeldelser...", icon: BookOpen, duration: 1200 },
  { label: "Sjekker kommunikasjon...", icon: Radio, duration: 1000 },
  { label: "Beregner score...", icon: Calculator, duration: 800 },
];

const MOCK_SCORES: ScoreCard[] = [
  {
    label: "Workspace Score",
    value: 64,
    max: 100,
    suffix: "/100",
    insight: "God grunnstruktur, men mangler digitale rutiner",
    icon: TrendingUp,
    color: "text-orange-400",
  },
  {
    label: "Review Score",
    value: 3.8,
    max: 5,
    suffix: "/5",
    insight: "Gjestene nevner inkonsistent service",
    icon: Star,
    color: "text-yellow-400",
  },
  {
    label: "Kommunikasjon",
    value: 42,
    max: 100,
    suffix: "/100",
    insight: "Mangler digital meny og opplevelsesguide",
    icon: MessageSquare,
    color: "text-blue-400",
  },
];

// ─── AnimatedNumber ─────────────────────────────────────────────────────────

function AnimatedNumber({
  target,
  duration = 1500,
  decimals = 0,
}: {
  target: number;
  duration?: number;
  decimals?: number;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(eased * target);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <>{current.toFixed(decimals)}</>;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WorkspaceAnalyzer() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(-1);

  const runAnalysis = useCallback(() => {
    if (!url.trim()) return;

    setPhase("analyzing");
    setCompletedSteps([]);
    setActiveStep(0);

    let elapsed = 0;

    ANALYSIS_STEPS.forEach((step, i) => {
      // Start step
      setTimeout(() => {
        setActiveStep(i);
      }, elapsed);

      elapsed += step.duration;

      // Complete step
      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i]);
      }, elapsed);
    });

    // Show results after all steps
    setTimeout(() => {
      setPhase("results");
    }, elapsed + 400);
  }, [url]);

  const reset = useCallback(() => {
    setPhase("input");
    setUrl("");
    setCompletedSteps([]);
    setActiveStep(-1);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <AnimatePresence mode="wait">
        {/* ─── Input Phase ─────────────────────────────────────────── */}
        {phase === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0c]/80 p-1.5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                    placeholder="https://din-restaurant.no"
                    className="w-full rounded-xl bg-white/5 py-3.5 pr-4 pl-11 text-sm text-white placeholder:text-zinc-500 focus:ring-1 focus:ring-white/20 focus:outline-none"
                  />
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={!url.trim()}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white transition-all hover:from-blue-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Generer
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-zinc-500">
              Skriv inn nettadressen til arbeidsplassen din for en gratis analyse
            </p>
          </motion.div>
        )}

        {/* ─── Analyzing Phase ─────────────────────────────────────── */}
        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/10 bg-[#0a0a0c]/80 p-6 backdrop-blur-xl"
          >
            <p className="mb-1 text-sm font-semibold text-white">
              Analyserer <span className="text-orange-400">{url.replace(/^https?:\/\//, "")}</span>
            </p>
            <p className="mb-5 text-xs text-zinc-500">Dette tar bare noen sekunder...</p>

            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, i) => {
                const isActive = activeStep === i && !completedSteps.includes(i);
                const isCompleted = completedSteps.includes(i);
                const isWaiting = activeStep < i;
                const Icon = step.icon;

                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: isWaiting ? 0.3 : 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.25 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                        isCompleted
                          ? "bg-emerald-500/20"
                          : isActive
                            ? "bg-orange-500/20"
                            : "bg-white/5"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                      ) : (
                        <Icon className="h-4 w-4 text-zinc-600" />
                      )}
                    </div>
                    <span
                      className={`text-sm transition-colors duration-300 ${
                        isCompleted ? "text-emerald-400" : isActive ? "text-white" : "text-zinc-600"
                      }`}
                    >
                      {step.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─── Results Phase ───────────────────────────────────────── */}
        {phase === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Score cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {MOCK_SCORES.map((score, i) => {
                const Icon = score.icon;
                return (
                  <motion.div
                    key={score.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.12, duration: 0.35 }}
                    className="rounded-2xl border border-white/10 bg-[#0a0a0c]/80 p-5 backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${score.color}`} />
                      <span className="text-xs font-medium text-zinc-400">{score.label}</span>
                    </div>
                    <div className="mb-1 flex items-baseline gap-0.5">
                      <span className="text-3xl font-black text-white tabular-nums">
                        <AnimatedNumber target={score.value} decimals={score.max === 5 ? 1 : 0} />
                      </span>
                      <span className="text-sm text-zinc-500">{score.suffix}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(score.value / score.max) * 100}%`,
                        }}
                        transition={{ delay: i * 0.12 + 0.3, duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          score.value / score.max > 0.7
                            ? "bg-emerald-500"
                            : score.value / score.max > 0.5
                              ? "bg-orange-500"
                              : "bg-red-500"
                        }`}
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-500">{score.insight}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center"
            >
              <a
                href={WEB_APP_LINKS.onboarding}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 sm:w-auto"
              >
                Registrer deg <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={WEB_APP_LINKS.onboarding}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Optimaliser din arbeidsplass
              </a>
            </motion.div>

            {/* Reset link */}
            <div className="text-center">
              <button
                onClick={reset}
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Analyser en annen arbeidsplass
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
