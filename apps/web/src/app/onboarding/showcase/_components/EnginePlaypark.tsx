"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  ChevronRight,
  Cog,
  FlaskConical,
  Gauge,
  GraduationCap,
  Layers,
  MessageCircle,
  Play,
  Route,
  Shield,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───

type MissionTemplate = {
  id: string;
  name: string;
  description: string;
  mode: "sequential" | "free" | "hybrid";
  agent: string;
  personality: string;
  stageCount: number;
  stages: StageDefinition[];
  guardrails: string[];
  systemPrompt: string;
};

type StageDefinition = {
  id: string;
  order: number;
  goal: string;
  creativeFreedom: number;
  personalityOverride: string | null;
  nextStage: string | null;
  tools: string[];
  timingMin: number;
  timingMax: number;
};

type PersonalityPreset = {
  id: string;
  label: string;
  tone: string;
  creativeFreedom: number;
  description: string;
};

type RoleplayScenario = {
  id: string;
  title: string;
  description: string;
  role: "employee" | "manager" | "admin";
  missionId: string;
  context: string;
};

type PlayparkTab = "missions" | "personality" | "tools" | "guardian" | "roleplay";

// ─── Data ───

const PERSONALITY_PRESETS: PersonalityPreset[] = [
  {
    id: "warm-guide",
    label: "Varm guide",
    tone: "Vennlig, tålmodig, oppmuntrende",
    creativeFreedom: 0.7,
    description: "Perfekt for onboarding og opplæring. Bygger tillit gjennom varme.",
  },
  {
    id: "direct-expert",
    label: "Direkte ekspert",
    tone: "Konsis, faktabasert, effektiv",
    creativeFreedom: 0.4,
    description: "For erfarne brukere som vil ha raske svar uten omveier.",
  },
  {
    id: "playful-coach",
    label: "Leken coach",
    tone: "Energisk, motiverende, humoristisk",
    creativeFreedom: 0.85,
    description: "Engasjerende for unge ansatte og gamification-scenarioer.",
  },
  {
    id: "strict-compliance",
    label: "Streng compliance",
    tone: "Formell, nøyaktig, regelbevisst",
    creativeFreedom: 0.2,
    description: "HMS, HACCP og lovpålagte prosedyrer. Ingen improvisasjon.",
  },
];

const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: "onboarding-interview",
    name: "Onboarding-intervju",
    description: "Guidet bedriftsoppsett med AI-assistent. Samler info, foreslår struktur.",
    mode: "sequential",
    agent: "Mr. Botsson",
    personality: "Varm, nysgjerrig, hjelpsom",
    stageCount: 7,
    stages: [
      {
        id: "greeting",
        order: 1,
        goal: "Rapport + navn",
        creativeFreedom: 0.8,
        personalityOverride: "Varm og nysgjerrig",
        nextStage: "collect-business",
        tools: ["getOnboardingState"],
        timingMin: 15,
        timingMax: 45,
      },
      {
        id: "collect-business",
        order: 2,
        goal: "Bedriftsnavn + org.nr",
        creativeFreedom: 0.6,
        personalityOverride: null,
        nextStage: "scan-web",
        tools: ["searchCompany", "identifyCompany", "updateBusiness"],
        timingMin: 30,
        timingMax: 90,
      },
      {
        id: "scan-web",
        order: 3,
        goal: "Skann nettside",
        creativeFreedom: 0.5,
        personalityOverride: null,
        nextStage: "structure",
        tools: ["scrapeWebsite", "addKeyFact"],
        timingMin: 20,
        timingMax: 60,
      },
      {
        id: "structure",
        order: 4,
        goal: "Avdelinger + lokasjoner",
        creativeFreedom: 0.6,
        personalityOverride: null,
        nextStage: "procedures",
        tools: ["addDepartments", "addLocations", "addZones"],
        timingMin: 40,
        timingMax: 120,
      },
      {
        id: "procedures",
        order: 5,
        goal: "Prosedyrer + rutiner",
        creativeFreedom: 0.5,
        personalityOverride: null,
        nextStage: "season",
        tools: ["addProcedures", "advanceToNextSection"],
        timingMin: 30,
        timingMax: 90,
      },
      {
        id: "season",
        order: 6,
        goal: "Sesongoppsett",
        creativeFreedom: 0.6,
        personalityOverride: null,
        nextStage: "finalize",
        tools: ["updateSeason", "advanceToNextSection"],
        timingMin: 20,
        timingMax: 60,
      },
      {
        id: "finalize",
        order: 7,
        goal: "Oppsummering + aktivering",
        creativeFreedom: 0.7,
        personalityOverride: "Stolt og varm",
        nextStage: null,
        tools: ["finalizeOnboarding"],
        timingMin: 15,
        timingMax: 45,
      },
    ],
    guardrails: [
      "Aldri autoplay TTS — kun manuell trigger",
      "Aldri endre data uten brukerbekreftelse",
      "Norsk som standard — bytt kun hvis brukeren gjør det",
      "Maks 3 spørsmål per svar",
    ],
    systemPrompt:
      "Du er Mr. Botsson, Smartouts onboarding-guide.\nDu hjelper nye bedrifter med å sette opp arbeidsplassen sin.\nVær varm, nysgjerrig og hjelpsom.",
  },
  {
    id: "shift-assistant",
    name: "Vaktplanleggingsassistent",
    description: "Hjelper med vaktplanlegging, bytter og dekning. Direkte verktøytilgang.",
    mode: "free",
    agent: "Smartout Shift",
    personality: "Direkte, effektiv, løsningsorientert",
    stageCount: 1,
    stages: [
      {
        id: "assist",
        order: 1,
        goal: "Hjelp med vaktplan",
        creativeFreedom: 0.5,
        personalityOverride: null,
        nextStage: null,
        tools: ["getScheduleState", "createShift", "updateShift", "deleteShift"],
        timingMin: 30,
        timingMax: 600,
      },
    ],
    guardrails: [
      "Bekreft med leder FØR mutasjoner",
      "Vis alltid konsekvenser av endringer",
      "Aldri slett vakter uten eksplisitt godkjenning",
    ],
    systemPrompt:
      "Du er Smartouts vaktplanleggingsassistent.\nDu har DIREKTE TILGANG til vaktplanen.",
  },
];

const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    id: "new-employee-day1",
    title: "Ny ansatt — dag 1",
    description: "Du er en ny servitør på din første dag. Agenten guider deg gjennom opplæring.",
    role: "employee",
    missionId: "onboarding-interview",
    context: "Første arbeidsdag, nervøs men motivert. Kjenner ingen.",
  },
  {
    id: "manager-morning",
    title: "Leder — morgenrutine",
    description: "Du er skiftleder og trenger hjelp med dagens planlegging.",
    role: "manager",
    missionId: "shift-assistant",
    context: "Mandag morgen, 2 sykmeldinger, fullbooket kveld.",
  },
  {
    id: "admin-haccp",
    title: "Admin — HACCP-avvik",
    description: "Temperaturavvik oppdaget. Du må håndtere det korrekt.",
    role: "admin",
    missionId: "onboarding-interview",
    context: "Kjøleskap i sone KJ-02 viser 9°C. Grense er 4°C.",
  },
  {
    id: "training-quiz",
    title: "Ansatt — opplæringsquiz",
    description: "Test din kunnskap om allergihåndtering med AI-treneren.",
    role: "employee",
    missionId: "onboarding-interview",
    context: "Allergiprotokoll-quiz. Agent spør, du svarer, agent evaluerer.",
  },
];

const AVAILABLE_TOOLS = [
  {
    name: "getOnboardingState",
    type: "client" as const,
    description: "Les nåværende onboarding-tilstand",
  },
  { name: "updateBusiness", type: "client" as const, description: "Oppdater bedriftsinformasjon" },
  { name: "updateSeason", type: "client" as const, description: "Oppdater sesonginnstillinger" },
  { name: "addDepartments", type: "client" as const, description: "Legg til avdelinger" },
  { name: "addLocations", type: "client" as const, description: "Legg til lokasjoner" },
  { name: "addZones", type: "client" as const, description: "Legg til soner i lokasjon" },
  { name: "addProcedures", type: "client" as const, description: "Legg til prosedyrer" },
  { name: "searchCompany", type: "client" as const, description: "Søk i Brønnøysundregisteret" },
  {
    name: "identifyCompany",
    type: "client" as const,
    description: "Identifiser bedrift med org.nr",
  },
  { name: "scrapeWebsite", type: "client" as const, description: "Skann bedriftens nettside" },
  {
    name: "advanceToNextSection",
    type: "client" as const,
    description: "Scroll UI til neste seksjon",
  },
  { name: "addKeyFact", type: "client" as const, description: "Vis nøkkelfakta i panelet" },
  { name: "saveMemory", type: "client" as const, description: "Lagre agentminne" },
  {
    name: "finalizeOnboarding",
    type: "client" as const,
    description: "Fullfør og aktiver workspace",
  },
  { name: "store", type: "engine" as const, description: "Lagre data i engine_inbox" },
  { name: "fetch", type: "engine" as const, description: "Les kontekst og historikk" },
  { name: "advance", type: "engine" as const, description: "Gå til neste stage i engine" },
  { name: "getJourneyContext", type: "engine" as const, description: "Sjekk journey-fremgang" },
];

// ─── Sub-components ───

function MissionPanel({
  selectedMission,
  onSelect,
}: {
  selectedMission: MissionTemplate | null;
  onSelect: (m: MissionTemplate) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MISSION_TEMPLATES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            className={`rounded-xl border p-4 text-left transition-all ${
              selectedMission?.id === m.id
                ? "border-[oklch(0.75_0.18_55)/0.5] bg-[oklch(0.75_0.18_55)/0.1]"
                : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-white/50" />
              <span className="text-sm font-semibold text-white">{m.name}</span>
              <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                {m.mode}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/40">{m.description}</p>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
              <span>{m.stageCount} stages</span>
              <span>{m.agent}</span>
              <span>{m.guardrails.length} guardrails</span>
            </div>
          </button>
        ))}
      </div>

      {selectedMission && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.08] bg-black/40 p-4"
        >
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
            Stage Chain
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {selectedMission.stages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-1">
                <div className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
                  <p className="text-[10px] font-medium text-white/70">{stage.id}</p>
                  <p className="text-[9px] text-white/30">{stage.goal}</p>
                </div>
                {i < selectedMission.stages.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-white/20" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
              Guardrails
            </p>
            <ul className="mt-2 space-y-1">
              {selectedMission.guardrails.map((g) => (
                <li key={g} className="flex items-start gap-2 text-xs text-white/50">
                  <Shield className="mt-0.5 h-3 w-3 shrink-0 text-red-400/60" />
                  {g}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
              System Prompt
            </p>
            <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-white/50">
              {selectedMission.systemPrompt}
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PersonalityPanel({
  selected,
  onSelect,
  customFreedom,
  onFreedomChange,
}: {
  selected: PersonalityPreset | null;
  onSelect: (p: PersonalityPreset) => void;
  customFreedom: number;
  onFreedomChange: (v: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {PERSONALITY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={`rounded-xl border p-3 text-left transition-all ${
              selected?.id === p.id
                ? "border-purple-400/40 bg-purple-500/10"
                : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <p className="text-sm font-semibold text-white">{p.label}</p>
            <p className="mt-0.5 text-[10px] text-white/40">{p.tone}</p>
            <p className="mt-1 text-xs text-white/30">{p.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-purple-400/60"
                  style={{ width: `${p.creativeFreedom * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-white/30">{p.creativeFreedom}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Creative Freedom
        </p>
        <input
          type="range"
          min={0}
          max={100}
          value={customFreedom * 100}
          onChange={(e) => onFreedomChange(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-purple-400"
        />
        <div className="mt-1 flex justify-between text-[10px] text-white/25">
          <span>Streng (0.0)</span>
          <span className="font-medium text-white/50">{customFreedom.toFixed(2)}</span>
          <span>Fri (1.0)</span>
        </div>
      </div>
    </div>
  );
}

function ToolTestPanel() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string[]>(["Velg et verktøy for å teste."]);

  const simulateTool = useCallback((name: string) => {
    setSelectedTool(name);
    const tool = AVAILABLE_TOOLS.find((t) => t.name === name);
    setTestLog((prev) =>
      [
        `${new Date().toLocaleTimeString()} — ${name}() → ${tool?.type === "engine" ? "HTTP POST /sessions/:id/" + name : "client callback"} → OK (simulated)`,
        ...prev,
      ].slice(0, 12),
    );
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AVAILABLE_TOOLS.map((tool) => (
          <button
            key={tool.name}
            type="button"
            onClick={() => simulateTool(tool.name)}
            className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
              selectedTool === tool.name
                ? "border-amber-400/40 bg-amber-500/10"
                : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <Wrench
              className={`h-3.5 w-3.5 ${tool.type === "engine" ? "text-sky-400/60" : "text-amber-400/60"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/70">{tool.name}</p>
              <p className="truncate text-[10px] text-white/30">{tool.description}</p>
            </div>
            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40">
              {tool.type}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Test Log
        </p>
        <div className="max-h-32 space-y-1 overflow-auto">
          {testLog.map((entry, i) => (
            <p key={`${entry}-${i}`} className="text-[11px] text-white/50">
              {entry}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuardianPanel({ selectedMission }: { selectedMission: MissionTemplate | null }) {
  const [evaluationLog, setEvaluationLog] = useState<string[]>(["Guardian evalueringsloop klar."]);
  const [isRunning, setIsRunning] = useState(false);

  const runEvaluation = useCallback(() => {
    if (!selectedMission) return;
    setIsRunning(true);
    setEvaluationLog((prev) =>
      [
        `${new Date().toLocaleTimeString()} — Evaluerer ${selectedMission.stages.length} stages...`,
        ...prev,
      ].slice(0, 15),
    );

    const stages = selectedMission.stages;
    let delay = 400;
    for (const stage of stages) {
      const s = stage;
      setTimeout(() => {
        const elapsed = Math.floor(Math.random() * s.timingMax);
        const pct = Math.round((elapsed / s.timingMax) * 100);
        const status = pct > 80 ? "⚠️ TIMEOUT WARNING" : pct > 50 ? "✓ on track" : "○ tidlig";
        setEvaluationLog((prev) =>
          [
            `${new Date().toLocaleTimeString()} — [${s.id}] ${elapsed}s/${s.timingMax}s (${pct}%) — ${status}`,
            ...prev,
          ].slice(0, 15),
        );
      }, delay);
      delay += 300;
    }

    setTimeout(() => {
      setEvaluationLog((prev) =>
        [
          `${new Date().toLocaleTimeString()} — Evaluering ferdig. Alle stages sjekket.`,
          ...prev,
        ].slice(0, 15),
      );
      setIsRunning(false);
    }, delay);
  }, [selectedMission]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <Gauge className="mx-auto h-5 w-5 text-emerald-400/60" />
          <p className="mt-1 text-lg font-semibold text-white">30s</p>
          <p className="text-[10px] text-white/30">Eval intervall</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <Layers className="mx-auto h-5 w-5 text-sky-400/60" />
          <p className="mt-1 text-lg font-semibold text-white">
            {selectedMission?.stageCount ?? 0}
          </p>
          <p className="text-[10px] text-white/30">Stages</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <Shield className="mx-auto h-5 w-5 text-amber-400/60" />
          <p className="mt-1 text-lg font-semibold text-white">
            {selectedMission?.guardrails.length ?? 0}
          </p>
          <p className="text-[10px] text-white/30">Guardrails</p>
        </div>
      </div>

      <button
        type="button"
        onClick={runEvaluation}
        disabled={!selectedMission || isRunning}
        className="w-full rounded-xl bg-emerald-500/20 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
      >
        {isRunning ? "Evaluerer..." : "Kjør Guardian-evaluering"}
      </button>

      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Guardian Log
        </p>
        <div className="max-h-40 space-y-1 overflow-auto">
          {evaluationLog.map((entry, i) => (
            <p key={`${entry}-${i}`} className="text-[11px] text-white/50">
              {entry}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleplayPanel({ onLaunch }: { onLaunch: (scenario: RoleplayScenario) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Velg et scenario for å starte en interaktiv rollespill-sesjon med AI-agenten.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLEPLAY_SCENARIOS.map((scenario) => {
          const roleColors: Record<string, string> = {
            employee: "border-emerald-400/30 bg-emerald-500/10",
            manager: "border-sky-400/30 bg-sky-500/10",
            admin: "border-purple-400/30 bg-purple-500/10",
          };
          const roleLabels: Record<string, string> = {
            employee: "Ansatt",
            manager: "Leder",
            admin: "Admin",
          };
          return (
            <motion.button
              key={scenario.id}
              type="button"
              onClick={() => onLaunch(scenario)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`rounded-xl border p-4 text-left transition-all ${roleColors[scenario.role]} hover:brightness-110`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                  {roleLabels[scenario.role]}
                </span>
                <Play className="h-4 w-4 text-white/40" />
              </div>
              <h4 className="mt-2 text-sm font-semibold text-white">{scenario.title}</h4>
              <p className="mt-1 text-xs text-white/50">{scenario.description}</p>
              <p className="mt-2 text-[10px] text-white/30 italic">
                &quot;{scenario.context}&quot;
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───

export function EnginePlaypark() {
  const [activeTab, setActiveTab] = useState<PlayparkTab>("missions");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<MissionTemplate | null>(null);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityPreset | null>(null);
  const [customFreedom, setCustomFreedom] = useState(0.6);
  const [activeRoleplay, setActiveRoleplay] = useState<RoleplayScenario | null>(null);

  const tabs: { id: PlayparkTab; label: string; icon: typeof Bot }[] = [
    { id: "missions", label: "Missions", icon: Route },
    { id: "personality", label: "Personality", icon: Sparkles },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "guardian", label: "Guardian", icon: Shield },
    { id: "roleplay", label: "Roleplay", icon: GraduationCap },
  ];

  const handleLaunchRoleplay = useCallback((scenario: RoleplayScenario) => {
    setActiveRoleplay(scenario);
  }, []);

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed top-14 right-3 z-40 flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/60 px-3 py-1.5 backdrop-blur-xl transition-colors hover:bg-white/10"
      >
        <FlaskConical className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs font-medium text-white/60">Engine Playpark</span>
      </button>

      {/* Full-screen overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-[oklch(0.08_0.01_250)] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5 text-purple-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Engine Agent Playpark</h2>
                  <p className="text-xs text-white/35">
                    Test missions, personality, tools, guardrails og rollespill
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/[0.06] px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-purple-400 text-white"
                        : "border-transparent text-white/40 hover:text-white/60"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-6">
              <div className="mx-auto max-w-4xl">
                {activeTab === "missions" && (
                  <MissionPanel selectedMission={selectedMission} onSelect={setSelectedMission} />
                )}
                {activeTab === "personality" && (
                  <PersonalityPanel
                    selected={selectedPersonality}
                    onSelect={setSelectedPersonality}
                    customFreedom={customFreedom}
                    onFreedomChange={setCustomFreedom}
                  />
                )}
                {activeTab === "tools" && <ToolTestPanel />}
                {activeTab === "guardian" && <GuardianPanel selectedMission={selectedMission} />}
                {activeTab === "roleplay" && <RoleplayPanel onLaunch={handleLaunchRoleplay} />}
              </div>
            </div>

            {/* Active config bar */}
            <div className="flex items-center gap-4 border-t border-white/[0.06] px-6 py-3 text-[10px] text-white/30">
              <span className="flex items-center gap-1">
                <Route className="h-3 w-3" />
                Mission: {selectedMission?.name ?? "ingen"}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Personality: {selectedPersonality?.label ?? "standard"}
              </span>
              <span className="flex items-center gap-1">
                <Cog className="h-3 w-3" />
                Freedom: {customFreedom.toFixed(2)}
              </span>
              {activeRoleplay && (
                <span className="flex items-center gap-1 text-emerald-400/60">
                  <GraduationCap className="h-3 w-3" />
                  Roleplay: {activeRoleplay.title}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roleplay active indicator */}
      <AnimatePresence>
        {activeRoleplay && !isOpen && (
          <motion.button
            type="button"
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-14 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 backdrop-blur-xl"
          >
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">
              Roleplay: {activeRoleplay.title}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveRoleplay(null);
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-white/10"
            >
              <X className="h-3 w-3 text-emerald-400/60" />
            </button>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
