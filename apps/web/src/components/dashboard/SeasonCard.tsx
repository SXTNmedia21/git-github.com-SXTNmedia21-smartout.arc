"use client";

import {
  Calendar,
  Sun,
  Snowflake,
  TreePine,
  Leaf,
  PartyPopper,
  CircleDashed,
} from "lucide-react";

const STAGES = [
  "seed",
  "revenue",
  "concept",
  "staffing",
  "prepare",
  "ready",
  "running",
  "reflect",
] as const;

type Stage = (typeof STAGES)[number];

const PHASE_MAP: Record<Stage, { label: string; color: string }> = {
  seed: { label: "OPPDAGELSE", color: "text-blue-400" },
  revenue: { label: "FORBEREDELSE", color: "text-amber-400" },
  concept: { label: "FORBEREDELSE", color: "text-amber-400" },
  staffing: { label: "FORBEREDELSE", color: "text-amber-400" },
  prepare: { label: "FORBEREDELSE", color: "text-amber-400" },
  ready: { label: "FORBEREDELSE", color: "text-amber-400" },
  running: { label: "DRIFT", color: "text-emerald-400" },
  reflect: { label: "REFLEKSJON", color: "text-purple-400" },
};

const STAGE_LABELS: Record<Stage, string> = {
  seed: "Definér sesong",
  revenue: "Sett inntektsmål",
  concept: "Beskriv konseptet",
  staffing: "Planlegg bemanning",
  prepare: "Klargjør drift",
  ready: "Klar for start",
  running: "Sesong pågår",
  reflect: "Evaluér og lær",
};

const PHASE_GLOW: Record<string, string> = {
  OPPDAGELSE: "bg-blue-500/10",
  FORBEREDELSE: "bg-amber-500/10",
  DRIFT: "bg-emerald-500/10",
  REFLEKSJON: "bg-purple-500/10",
};

const PHASE_DOT_FILL: Record<string, string> = {
  OPPDAGELSE: "bg-blue-400",
  FORBEREDELSE: "bg-amber-400",
  DRIFT: "bg-emerald-400",
  REFLEKSJON: "bg-purple-400",
};

const PHASE_RING: Record<string, string> = {
  OPPDAGELSE: "ring-blue-400/50",
  FORBEREDELSE: "ring-amber-400/50",
  DRIFT: "ring-emerald-400/50",
  REFLEKSJON: "ring-purple-400/50",
};

function getSeasonIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("jul") || normalized.includes("vinter") || normalized.includes("ski"))
    return <Snowflake className="h-4 w-4" />;
  if (normalized.includes("sommer") || normalized.includes("sol"))
    return <Sun className="h-4 w-4" />;
  if (normalized.includes("høst") || normalized.includes("host"))
    return <Leaf className="h-4 w-4" />;
  if (normalized.includes("vår") || normalized.includes("var") || normalized.includes("spring"))
    return <TreePine className="h-4 w-4" />;
  if (normalized.includes("fest") || normalized.includes("event"))
    return <PartyPopper className="h-4 w-4" />;
  return <Calendar className="h-4 w-4" />;
}

function getCountdown(startDate: string, endDate: string, currentStage: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (currentStage === "reflect") return "Avsluttet";
  if (now >= start && now <= end) return "Pågår nå";

  const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 0) return "Pågår nå";
  if (daysUntil === 1) return "Starter i morgen";
  if (daysUntil <= 7) return `${daysUntil} dager igjen`;
  const weeks = Math.ceil(daysUntil / 7);
  return `${weeks} uker igjen`;
}

function getNextAction(currentStage: string): string {
  if (!(currentStage in STAGE_LABELS)) return "";
  return STAGE_LABELS[currentStage as Stage];
}

interface SeasonCardProps {
  season: {
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    currentStage: string;
    stagesCompleted: string[];
  } | null;
}

export function SeasonCard({ season }: SeasonCardProps) {
  if (!season) {
    return (
      <div className="border-border bg-card relative overflow-hidden rounded-2xl border p-5">
        <div className="flex flex-col items-center justify-center gap-2 py-4">
          <CircleDashed className="text-muted-foreground/50 h-8 w-8" />
          <p className="text-muted-foreground text-sm font-medium">Ingen aktiv sesong</p>
        </div>
      </div>
    );
  }

  const currentStage = season.currentStage as Stage;
  const phase = PHASE_MAP[currentStage] ?? { label: "UKJENT", color: "text-muted-foreground" };
  const countdown = getCountdown(season.startDate, season.endDate, season.currentStage);
  const nextAction = getNextAction(season.currentStage);
  const glowClass = PHASE_GLOW[phase.label] ?? "bg-muted/10";

  return (
    <div className="group border-border bg-card relative overflow-hidden rounded-2xl border p-5">
      {/* Glow effect */}
      <div
        className={`absolute -top-4 -right-4 h-24 w-24 rounded-full ${glowClass} blur-2xl transition-opacity group-hover:opacity-80`}
      />

      {/* Header: name + type badge */}
      <div className="relative z-10 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="border-border bg-muted/50 rounded-lg border p-2">
            {getSeasonIcon(season.type)}
          </div>
          <div>
            <h3 className="text-foreground text-sm font-semibold leading-tight">{season.name}</h3>
            <span className="text-muted-foreground text-xs capitalize">{season.type}</span>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-widest ${phase.color}`}
        >
          {phase.label}
        </span>
      </div>

      {/* Stage progression dots */}
      <div className="relative z-10 mb-3 flex items-center gap-1.5">
        {STAGES.map((stage) => {
          const isCompleted = season.stagesCompleted.includes(stage);
          const isCurrent = stage === currentStage;
          const stagePhase = PHASE_MAP[stage];
          const dotFill = PHASE_DOT_FILL[stagePhase.label] ?? "bg-muted";
          const ringClass = PHASE_RING[stagePhase.label] ?? "ring-muted";

          return (
            <div key={stage} className="flex items-center justify-center" title={STAGE_LABELS[stage]}>
              {isCurrent ? (
                <div
                  className={`h-2.5 w-2.5 rounded-full ${dotFill} ring-2 ${ringClass} animate-pulse`}
                />
              ) : isCompleted ? (
                <div className={`h-2 w-2 rounded-full ${dotFill}`} />
              ) : (
                <div className="bg-muted h-2 w-2 rounded-full" />
              )}
            </div>
          );
        })}
      </div>

      {/* Countdown */}
      <div className="relative z-10 mb-2 flex items-center gap-2">
        <Calendar className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs font-medium">{countdown}</span>
      </div>

      {/* Next action */}
      {nextAction && (
        <p className="text-muted-foreground relative z-10 text-xs">
          <span className="font-semibold">Neste:</span> {nextAction}
        </p>
      )}
    </div>
  );
}
