"use client";

import { useState, useEffect, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";
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
    color: "text-brand-orange",
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
    color: "text-brand-purple",
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
          <m.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="border-border bg-background/80 rounded-2xl border p-1.5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="text-muted-foreground absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                    placeholder="https://din-restaurant.no"
                    className="bg-foreground/5 text-foreground placeholder:text-muted-foreground focus:ring-foreground/20 w-full rounded-xl py-3.5 pr-4 pl-11 text-sm focus:ring-1 focus:outline-none"
                  />
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={!url.trim()}
                  className="from-brand-purple to-brand-purple-light text-foreground hover:from-brand-purple-light hover:to-brand-purple shrink-0 rounded-xl bg-gradient-to-r px-6 py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Generer
                </button>
              </div>
            </div>

            <p className="text-muted-foreground mt-3 text-center text-xs">
              Skriv inn nettadressen til arbeidsplassen din for en gratis analyse
            </p>
          </m.div>
        )}

        {/* ─── Analyzing Phase ─────────────────────────────────────── */}
        {phase === "analyzing" && (
          <m.div
            key="analyzing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="border-border bg-background/80 rounded-2xl border p-6 backdrop-blur-xl"
          >
            <p className="text-foreground mb-1 text-sm font-semibold">
              Analyserer{" "}
              <span className="text-brand-orange">{url.replace(/^https?:\/\//, "")}</span>
            </p>
            <p className="text-muted-foreground mb-5 text-xs">Dette tar bare noen sekunder...</p>

            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, i) => {
                const isActive = activeStep === i && !completedSteps.includes(i);
                const isCompleted = completedSteps.includes(i);
                const isWaiting = activeStep < i;
                const Icon = step.icon;

                return (
                  <m.div
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
                            ? "bg-brand-orange/20"
                            : "bg-foreground/5"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isActive ? (
                        <Loader2 className="text-brand-orange h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="text-muted-foreground/70 h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`text-sm transition-colors duration-300 ${
                        isCompleted
                          ? "text-emerald-400"
                          : isActive
                            ? "text-foreground"
                            : "text-muted-foreground/70"
                      }`}
                    >
                      {step.label}
                    </span>
                  </m.div>
                );
              })}
            </div>
          </m.div>
        )}

        {/* ─── Results Phase ───────────────────────────────────────── */}
        {phase === "results" && (
          <m.div
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
                  <m.div
                    key={score.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.12, duration: 0.35 }}
                    className="border-border bg-background/80 rounded-2xl border p-5 backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${score.color}`} />
                      <span className="text-muted-foreground text-xs font-medium">
                        {score.label}
                      </span>
                    </div>
                    <div className="mb-1 flex items-baseline gap-0.5">
                      <span className="text-foreground text-3xl font-black tabular-nums">
                        <AnimatedNumber target={score.value} decimals={score.max === 5 ? 1 : 0} />
                      </span>
                      <span className="text-muted-foreground text-sm">{score.suffix}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="bg-foreground/5 mb-3 h-1 overflow-hidden rounded-full">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(score.value / score.max) * 100}%`,
                        }}
                        transition={{ delay: i * 0.12 + 0.3, duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          score.value / score.max > 0.7
                            ? "bg-emerald-500"
                            : score.value / score.max > 0.5
                              ? "bg-brand-orange"
                              : "bg-red-500"
                        }`}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{score.insight}</p>
                  </m.div>
                );
              })}
            </div>

            {/* CTAs */}
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center"
            >
              <a
                href={WEB_APP_LINKS.login}
                className="bg-foreground text-background hover:bg-foreground/90 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-colors sm:w-auto"
              >
                Registrer deg <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={WEB_APP_LINKS.login}
                className="border-border bg-foreground/5 text-foreground hover:bg-foreground/10 flex w-full items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-semibold transition-colors sm:w-auto"
              >
                Optimaliser din arbeidsplass
              </a>
            </m.div>

            {/* Reset link */}
            <div className="text-center">
              <button
                onClick={reset}
                className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                Analyser en annen arbeidsplass
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
