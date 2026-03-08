"use client";

import { useState, useCallback, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight, Rocket, SkipForward } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useWorkspaceSetup } from "@/app/dashboard/_hooks/use-workspace-setup";

// ─── Step definitions ────────────────────────────────────
// Each step: title, explanation (why this matters in their daily life),
// and a placeholder for the embedded form component.

type SetupStep = {
  id: string;
  title: string;
  subtitle: string;
  explanation: string;
};

const STEPS: SetupStep[] = [
  {
    id: "governance",
    title: "Dine retningslinjer",
    subtitle: "Regler og prosedyrer",
    explanation:
      "Retningslinjer er reglene som styrer restauranten din. Mattrygghet, hygiene, brannsikkerhet \u2014 alt som ansatte m\u00e5 kunne. N\u00e5r du legger inn reglene her, vil systemet automatisk s\u00f8rge for at alle ansatte l\u00e6rer dem og blir testet p\u00e5 at de kan dem.",
  },
  {
    id: "handbook",
    title: "Din personalh\u00e5ndbok",
    subtitle: "Det ansatte leser f\u00f8rste dag",
    explanation:
      "Personalh\u00e5ndboken er den f\u00f8rste teksten nye ansatte m\u00f8ter. Den forklarer hvordan dere jobber, hva som forventes, og hva de kan forvente tilbake. Skriv noen f\u00e5 kapitler n\u00e5 \u2014 du kan alltid utvide senere.",
  },
  {
    id: "team",
    title: "Ditt team",
    subtitle: "De f\u00f8rste ansatte",
    explanation:
      "Legg til de f\u00f8rste i teamet ditt. De f\u00e5r en invitasjon og starter med \u00e5 lese h\u00e5ndboken og retningslinjene du nettopp la inn. Jo f\u00f8r de er inne, jo raskere ser du systemet i aksjon.",
  },
  {
    id: "shift-template",
    title: "Din f\u00f8rste vaktmal",
    subtitle: "Grunnlaget for vaktplanen",
    explanation:
      "En vaktmal er en oppskrift for en vakt \u2014 navn, start- og sluttid, og hvilken avdeling den tilh\u00f8rer. Du bygger den ekte vaktplanen etterpå, men dette gir systemet skjelettet det trenger for \u00e5 forst\u00e5 driften din.",
  },
  {
    id: "season",
    title: "Din sesong",
    subtitle: "Budsjett og m\u00e5l",
    explanation:
      "Sesongen setter rammene for alt: budsjett, bemanningsm\u00e5l, og KPI-er. N\u00e5r sesongen er aktiv, begynner dashboardet \u00e5 vise ekte tall. Sett en enkel budsjettmal n\u00e5 \u2014 du kan finjustere tallene n\u00e5r som helst.",
  },
];

// ─── Component ───────────────────────────────────────────

const SKIP_KEY = "smartout_setup_skipped";
const SKIP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function wasRecentlySkipped(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(SKIP_KEY);
  if (!raw) return false;
  const skippedAt = Number(raw);
  return Date.now() - skippedAt < SKIP_TTL_MS;
}

// Map wizard step IDs to setup module IDs
const STEP_TO_MODULE: Record<string, string> = {
  governance: "governance",
  handbook: "governance", // handbook is part of governance module
  team: "people",
  "shift-template": "schedule",
  season: "season",
};

export function WorkspaceSetupWizard({
  isDark,
  onComplete,
}: {
  isDark: boolean;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";
  const { data: setupStatus } = useWorkspaceSetup();

  // Calculate initial step: first incomplete wizard step
  const [currentStep, setCurrentStep] = useState(() => {
    if (!setupStatus?.modules) return 0;
    const modules = setupStatus.modules;
    for (let i = 0; i < STEPS.length; i++) {
      const moduleId = STEP_TO_MODULE[STEPS[i]!.id];
      const mod = modules.find((m) => m.id === moduleId);
      if (mod && !mod.isComplete) return i;
    }
    return 0;
  });

  // If recently skipped, go straight to dashboard
  useLayoutEffect(() => {
    if (wasRecentlySkipped()) {
      onComplete();
    }
  }, [onComplete]);

  const step = STEPS[currentStep]!;
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      // Invalidate setup query so AdminDashboard re-evaluates
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.workspaceSetupStatus(workspaceId),
      });
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, queryClient, workspaceId, onComplete]);

  const handleBack = useCallback(() => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  }, [isFirst]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(SKIP_KEY, String(Date.now()));
    void queryClient.invalidateQueries({
      queryKey: dashboardKeys.workspaceSetupStatus(workspaceId),
    });
    onComplete();
  }, [queryClient, workspaceId, onComplete]);

  const progressPct = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="flex h-full flex-col">
      {/* ── Top bar: logo + skip ── */}
      <div
        className={`flex items-center justify-between border-b px-8 py-4 ${
          isDark ? "border-zinc-800" : "border-zinc-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              isDark ? "bg-orange-500/10" : "bg-orange-50"
            }`}
          >
            <Rocket className="h-5 w-5 text-orange-500" />
          </div>
          <span
            className={`text-sm font-bold tracking-tight ${
              isDark ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            Oppsett av arbeidsrom
          </span>
        </div>

        <button
          onClick={handleSkip}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            isDark
              ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          }`}
        >
          <SkipForward className="h-3.5 w-3.5" />
          Hopp over og g\u00e5 til dashboard
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className={`h-1 w-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}>
        <div
          className="h-full rounded-r-full bg-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Step indicator dots ── */}
      <div className="flex justify-center gap-2 px-8 pt-6">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              i === currentStep
                ? isDark
                  ? "bg-orange-500/15 text-orange-400"
                  : "bg-orange-50 text-orange-600"
                : i < currentStep
                  ? isDark
                    ? "text-emerald-400/60"
                    : "text-emerald-600/60"
                  : isDark
                    ? "text-zinc-600"
                    : "text-zinc-400"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                i === currentStep
                  ? "bg-orange-500 text-white"
                  : i < currentStep
                    ? isDark
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-emerald-100 text-emerald-600"
                    : isDark
                      ? "bg-zinc-800 text-zinc-500"
                      : "bg-zinc-200 text-zinc-400"
              }`}
            >
              {i < currentStep ? "\u2713" : i + 1}
            </span>
            {i === currentStep && <span>{s.title}</span>}
          </button>
        ))}
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Step header */}
          <div className="space-y-3">
            <p
              className={`text-xs font-bold tracking-widest uppercase ${
                isDark ? "text-orange-400/70" : "text-orange-500/70"
              }`}
            >
              Steg {currentStep + 1} av {STEPS.length} &middot; {step.subtitle}
            </p>
            <h1
              className={`text-3xl font-black tracking-tight ${
                isDark ? "text-white" : "text-zinc-900"
              }`}
            >
              {step.title}
            </h1>
            <p
              className={`max-w-xl text-base leading-relaxed ${
                isDark ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              {step.explanation}
            </p>
          </div>

          {/* Form placeholder — each step will embed its form here */}
          <div
            className={`min-h-[280px] rounded-2xl border-2 border-dashed p-8 ${
              isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50/50"
            }`}
          >
            <p className={`text-center text-sm ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {step.id === "governance" && "Retningslinje-skjema kobles inn her"}
              {step.id === "handbook" && "Personalh\u00e5ndbok-editor kobles inn her"}
              {step.id === "team" && "Invitasjonsskjema kobles inn her"}
              {step.id === "shift-template" && "Vaktmal-skjema kobles inn her"}
              {step.id === "season" && "Sesongoppsett kobles inn her"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom navigation ── */}
      <div
        className={`flex items-center justify-between border-t px-8 py-4 ${
          isDark ? "border-zinc-800" : "border-zinc-200"
        }`}
      >
        <button
          onClick={handleBack}
          disabled={isFirst}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isFirst
              ? "cursor-not-allowed opacity-30"
              : isDark
                ? "text-zinc-300 hover:bg-zinc-800"
                : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleNext}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
              isLast
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {isLast ? "Fullf\u00f8r og \u00e5pne dashboard" : "Neste"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
