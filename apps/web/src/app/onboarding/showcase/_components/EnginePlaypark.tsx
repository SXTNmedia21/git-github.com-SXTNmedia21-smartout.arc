"use client";

import { useCallback, useState } from "react";
import {
  Bot,
  Brain,
  ChevronRight,
  Cog,
  Eye,
  FlaskConical,
  Gauge,
  GraduationCap,
  Layers,
  MessageCircle,
  Play,
  Route,
  Search,
  Shield,
  Sliders,
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
  voice: string;
  temperature: number;
  maxDurationSeconds: number;
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

type PostureDimension = {
  key: string;
  label: string;
  description: string;
  value: number;
};

type PersonalityPreset = {
  id: string;
  label: string;
  tone: string;
  posture: Record<string, number>;
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

type CapabilityEntry = {
  name: string;
  description: string;
  tools: string[];
  readOnlyTools: string[];
  suggestTools: string[];
  registered: boolean;
};

type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

type PlayparkTab =
  | "missions"
  | "personality"
  | "tools"
  | "capabilities"
  | "intent"
  | "memory"
  | "guardian"
  | "roleplay";

// ─── Data: Missions (from packages/ai/src/missions/registry.ts) ───

const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: "onboarding-interview",
    name: "Botsson — Onboarding",
    description: "Guidet bedriftsoppsett. Samler info, foreslår struktur, aktiverer workspace.",
    mode: "sequential",
    agent: "Botsson",
    personality: "Kollegaen alle liker. Skarp, varm, direkte.",
    voice: "Mark",
    temperature: 0.6,
    maxDurationSeconds: 1800,
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
        tools: ["triggerScrape", "addKeyFact"],
        timingMin: 20,
        timingMax: 60,
      },
      {
        id: "structure",
        order: 4,
        goal: "Avdelinger + lokasjoner + soner",
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
      "BESKRIV → FORESLÅ → BEKREFT — aldri åpne spørsmål",
      "MAKS ÉN setning. Så venter du.",
      "NAVIGER FØRST (advanceToNextSection), SNAKK ETTERPÅ",
    ],
    systemPrompt:
      "Du er Botsson. Du setter opp Smartout for nye kunder gjennom en samtale.\n\nPERSONLIGHET:\nKollegaen alle liker. Har stått bak en bar selv. Skarp, varm, direkte.",
  },
  {
    id: "landing-demo",
    name: "Lise — Landing Demo",
    description: "AI-ambassadør på landingssiden. Varm, nysgjerrig, kjenner Smartout ut og inn.",
    mode: "free",
    agent: "Lise",
    personality: "Varm, nysgjerrig, rakt på sak",
    voice: "Custom (d082550b)",
    temperature: 0.5,
    maxDurationSeconds: 600,
    stageCount: 1,
    stages: [
      {
        id: "conversation",
        order: 1,
        goal: "Presentere Smartout, svare på spørsmål",
        creativeFreedom: 0.7,
        personalityOverride: null,
        nextStage: null,
        tools: [],
        timingMin: 30,
        timingMax: 600,
      },
    ],
    guardrails: [
      "Aldri salgsaktig eller overfladisk",
      "Hold svarene korte — 1-2 setninger",
      "Henvis til prissiden for prisinfo",
    ],
    systemPrompt:
      'Du er "Lise", en av The Founding AI\'s i Smartout — ambassadøren på landingssiden.',
  },
  {
    id: "mr-botsson",
    name: "Mr. Botsson — Workspace",
    description: "AI-assistent i dashboardet. Drift, vakter, opplæring, HACCP, rapporter.",
    mode: "free",
    agent: "Mr. Botsson",
    personality: "Presist, handlingsrettet, ærlig",
    voice: "Mark",
    temperature: 0.3,
    maxDurationSeconds: 1800,
    stageCount: 1,
    stages: [
      {
        id: "assist",
        order: 1,
        goal: "Hjelp med daglig drift",
        creativeFreedom: 0.4,
        personalityOverride: null,
        nextStage: null,
        tools: ["get_profile", "get_team", "get_signals", "navigate_to"],
        timingMin: 30,
        timingMax: 1800,
      },
    ],
    guardrails: [
      "Bruk verktøy aktivt — sjekk data før du svarer",
      "Si ærlig når du ikke vet svaret",
      "Henvis til relevant modul i dashboardet",
    ],
    systemPrompt:
      'Du er "Mr. Botsson", Smartouts AI-assistent inne i dashboardet.\nDu hjelper ledere og ansatte med daglig drift.',
  },
  {
    id: "haccp-inspector",
    name: "HACCP-inspektøren",
    description: "Mattrygghet: temperaturlogg, kontrollpunkter, avvikshåndtering.",
    mode: "sequential",
    agent: "HACCP-inspektøren",
    personality: "Presis, nøyaktig, regelbevisst",
    voice: "Sarah",
    temperature: 0.2,
    maxDurationSeconds: 900,
    stageCount: 4,
    stages: [
      {
        id: "identify",
        order: 1,
        goal: "Avdeling + stasjon",
        creativeFreedom: 0.2,
        personalityOverride: null,
        nextStage: "measure",
        tools: [],
        timingMin: 10,
        timingMax: 30,
      },
      {
        id: "measure",
        order: 2,
        goal: "Temperaturmåling",
        creativeFreedom: 0.1,
        personalityOverride: "Streng og presis",
        nextStage: "evaluate",
        tools: [],
        timingMin: 15,
        timingMax: 60,
      },
      {
        id: "evaluate",
        order: 3,
        goal: "Evaluere mot grenseverdier",
        creativeFreedom: 0.15,
        personalityOverride: null,
        nextStage: "action",
        tools: [],
        timingMin: 10,
        timingMax: 30,
      },
      {
        id: "action",
        order: 4,
        goal: "Korrigerende tiltak ved avvik",
        creativeFreedom: 0.3,
        personalityOverride: null,
        nextStage: null,
        tools: [],
        timingMin: 15,
        timingMax: 60,
      },
    ],
    guardrails: [
      "Vær presis med tall og temperaturer — dette er matsikkerhet",
      "Ved avvik: stopp og instruer korrigerende tiltak umiddelbart",
      "Logg alt — ingen unntak",
      "Aldri bagatelliser avvik",
    ],
    systemPrompt:
      "Du er Smartouts HACCP-inspektør.\nDin rolle er å veilede ansatte gjennom mattrygghetskontroller.",
  },
  {
    id: "shift-assistant",
    name: "Vaktassistenten",
    description: "Vaktplanlegging, bytter, dekning, overtid. Direkte verktøytilgang.",
    mode: "free",
    agent: "Vaktassistenten",
    personality: "Direkte, effektiv, løsningsorientert",
    voice: "Tina",
    temperature: 0.3,
    maxDurationSeconds: 900,
    stageCount: 1,
    stages: [
      {
        id: "assist",
        order: 1,
        goal: "Hjelp med vaktplan",
        creativeFreedom: 0.5,
        personalityOverride: null,
        nextStage: null,
        tools: [
          "getScheduleState",
          "createShift",
          "updateShift",
          "deleteShift",
          "focusDay",
          "openDayPlanner",
        ],
        timingMin: 30,
        timingMax: 600,
      },
    ],
    guardrails: [
      "Bekreft med leder FØR mutasjoner",
      "Vis alltid konsekvenser av endringer",
      "Aldri slett vakter uten eksplisitt godkjenning",
      "Flagg overtid over 37.5 timer",
    ],
    systemPrompt:
      "Du er Smartouts vaktplanleggingsassistent.\nDu har DIREKTE TILGANG til vaktplanen gjennom verktøy.",
  },
];

// ─── Data: Posture (from packages/ai/src/prompts/posture.ts + capabilities/types.ts) ───

const POSTURE_DIMENSIONS: PostureDimension[] = [
  { key: "formality", label: "Formalitet", description: "Uformell ↔ Formell", value: 0.3 },
  { key: "assertiveness", label: "Assertivitet", description: "Forsiktig ↔ Bestemt", value: 0.5 },
  { key: "warmth", label: "Varme", description: "Nøytral ↔ Varm", value: 0.7 },
  { key: "humor", label: "Humor", description: "Seriøs ↔ Leken", value: 0.4 },
  { key: "verbosity", label: "Ordrikhet", description: "Konsis ↔ Detaljert", value: 0.5 },
];

const POSTURE_PRESETS: PersonalityPreset[] = [
  {
    id: "warm-guide",
    label: "Varm guide",
    tone: "Onboarding & opplæring",
    posture: { formality: 0.2, assertiveness: 0.4, warmth: 0.9, humor: 0.5, verbosity: 0.6 },
    description: "Bygger tillit. Tålmodig, oppmuntrende. +warmth, +verbosity.",
  },
  {
    id: "direct-expert",
    label: "Direkte ekspert",
    tone: "Drift & vaktplanlegging",
    posture: { formality: 0.4, assertiveness: 0.7, warmth: 0.5, humor: 0.2, verbosity: 0.3 },
    description: "Raske svar, ingen omveier. +assertiveness, -verbosity.",
  },
  {
    id: "playful-coach",
    label: "Leken coach",
    tone: "Gamification & unge ansatte",
    posture: { formality: 0.15, assertiveness: 0.5, warmth: 0.8, humor: 0.85, verbosity: 0.5 },
    description: "Energisk, motiverende. +humor, +warmth.",
  },
  {
    id: "strict-compliance",
    label: "Streng compliance",
    tone: "HMS, HACCP, lovpålagt",
    posture: { formality: 0.8, assertiveness: 0.8, warmth: 0.3, humor: 0.05, verbosity: 0.4 },
    description: "Ingen improvisasjon. +formality, +assertiveness, -humor.",
  },
];

const SITUATIONS = [
  "onboarding",
  "haccp",
  "scheduling",
  "training",
  "operations",
  "guardian",
  "general",
] as const;
const ROLES = ["trainee", "employee", "manager", "admin", "owner"] as const;
const AUTHORITY_LEVELS: AuthorityLevel[] = [
  "autonomous",
  "confirm",
  "suggest",
  "read_only",
  "disabled",
];

// Role adjustments from posture.ts
const ROLE_ADJUSTMENTS: Record<string, Partial<Record<string, number>>> = {
  trainee: { formality: -0.15, warmth: 0.15, verbosity: 0.2 },
  employee: {},
  manager: { formality: 0.05 },
  admin: { formality: 0.05, assertiveness: -0.05 },
  owner: { formality: 0.1, assertiveness: -0.1 },
};

const SITUATION_ADJUSTMENTS: Record<string, Partial<Record<string, number>>> = {
  onboarding: { warmth: 0.2, verbosity: 0.1 },
  haccp: { assertiveness: 0.2, warmth: -0.1, humor: -0.2 },
  scheduling: { assertiveness: 0.1, verbosity: -0.1 },
  training: { warmth: 0.1, verbosity: 0.1 },
  operations: { assertiveness: 0.1 },
  guardian: { formality: 0.1, assertiveness: 0.1 },
  general: {},
};

// ─── Data: Capabilities (from packages/ai/src/capabilities/) ───

const CAPABILITIES: CapabilityEntry[] = [
  {
    name: "profile",
    description: "Employee profile data, team membership, and contract status",
    tools: ["get_profile", "get_team", "get_contract_status"],
    readOnlyTools: ["get_profile", "get_team", "get_contract_status"],
    suggestTools: [],
    registered: true,
  },
  {
    name: "ui",
    description: "Interact with screen: navigate, fill forms, highlight, panels, toasts",
    tools: ["navigate_to", "fill_field", "highlight_element", "show_panel", "show_toast"],
    readOnlyTools: [],
    suggestTools: [],
    registered: true,
  },
  {
    name: "guardian",
    description: "Workspace health: readiness alerts, maturity signals, agent behavior tracking",
    tools: ["get_signals", "acknowledge_signal", "get_workspace_health"],
    readOnlyTools: ["get_signals", "get_workspace_health"],
    suggestTools: ["acknowledge_signal"],
    registered: false,
  },
  {
    name: "knowledge",
    description: "Company policies, procedures, rules, FAQs",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
  {
    name: "schedule",
    description: "Shift queries, schedule changes, availability, swap requests",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
  {
    name: "training",
    description: "Protocol assignments, readiness status, knowledge tests",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
  {
    name: "operations",
    description: "Department sessions, checklists, routines, daily ops",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
  {
    name: "communication",
    description: "Sending messages, notifications",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
  {
    name: "memory",
    description: "Past conversations, user preferences, semantic retrieval",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
  {
    name: "payroll",
    description: "Salary, overtime, deductions, pay period",
    tools: [],
    readOnlyTools: [],
    suggestTools: [],
    registered: false,
  },
];

// ─── Data: Intent classifier domains (from packages/ai/src/router/intent-classifier.ts) ───

const INTENT_DOMAINS = [
  {
    domain: "knowledge",
    examples: ["Hva er rutinen for varemottak?", "Forklar allergiprotokollen"],
    color: "text-info",
  },
  {
    domain: "schedule",
    examples: ["Hvem jobber i morgen?", "Bytt vakten min fredag"],
    color: "text-sky-400",
  },
  {
    domain: "training",
    examples: ["Hvilke kurs gjenstår?", "Vis readiness-scoren min"],
    color: "text-success",
  },
  {
    domain: "operations",
    examples: ["Start åpningsrutinen", "Hvilke sjekklister mangler?"],
    color: "text-warning",
  },
  {
    domain: "profile",
    examples: ["Vis teamet mitt", "Hva er kontraktstatusen min?"],
    color: "text-violet-400",
  },
  {
    domain: "communication",
    examples: ["Send melding til kjøkkenet", "Varsle leder"],
    color: "text-pink-400",
  },
  {
    domain: "memory",
    examples: ["Hva snakket vi om sist?", "Husk at jeg er allergisk"],
    color: "text-orange-400",
  },
  {
    domain: "payroll",
    examples: ["Hvor mange timer har jeg denne uken?", "Vis overtid"],
    color: "text-rose-400",
  },
  {
    domain: "ui",
    examples: ["Gå til vaktplanen", "Marker feltet for avdeling"],
    color: "text-cyan-400",
  },
  { domain: "general", examples: ["Hei!", "Hva kan du hjelpe meg med?"], color: "text-white/50" },
] as const;

// ─── Data: Tools (expanded with capability tools) ───

const AVAILABLE_TOOLS = [
  // Client tools (onboarding)
  { name: "getOnboardingState", type: "client" as const, description: "Les onboarding-tilstand" },
  { name: "updateBusiness", type: "client" as const, description: "Oppdater bedriftsinfo" },
  { name: "updateSeason", type: "client" as const, description: "Oppdater sesong" },
  { name: "addDepartments", type: "client" as const, description: "Legg til avdelinger" },
  { name: "addLocations", type: "client" as const, description: "Legg til lokasjoner" },
  { name: "addZones", type: "client" as const, description: "Legg til soner" },
  { name: "addProcedures", type: "client" as const, description: "Legg til prosedyrer" },
  { name: "triggerScrape", type: "client" as const, description: "Skann bedriftens nettside" },
  {
    name: "advanceToNextSection",
    type: "client" as const,
    description: "Scroll til neste seksjon",
  },
  { name: "addKeyFact", type: "client" as const, description: "Vis nøkkelfakta i panelet" },
  { name: "saveMemory", type: "client" as const, description: "Lagre agentminne" },
  { name: "finalizeOnboarding", type: "client" as const, description: "Aktiver workspace" },
  // Client tools (schedule)
  { name: "getScheduleState", type: "client" as const, description: "Se hele ukens vaktplan" },
  { name: "createShift", type: "client" as const, description: "Opprett ny vakt" },
  { name: "updateShift", type: "client" as const, description: "Endre en vakt" },
  { name: "deleteShift", type: "client" as const, description: "Slett en vakt" },
  { name: "focusDay", type: "client" as const, description: "Marker dag i vaktplanen" },
  // Capability tools (profile)
  { name: "get_profile", type: "capability" as const, description: "Hent ansattprofil" },
  { name: "get_team", type: "capability" as const, description: "Hent teaminfo" },
  { name: "get_contract_status", type: "capability" as const, description: "Kontraktstatus" },
  // Capability tools (ui)
  { name: "navigate_to", type: "capability" as const, description: "Naviger brukerens skjerm" },
  { name: "fill_field", type: "capability" as const, description: "Fyll inn skjemafelt" },
  { name: "highlight_element", type: "capability" as const, description: "Marker UI-element" },
  { name: "show_panel", type: "capability" as const, description: "Vis panel med data" },
  { name: "show_toast", type: "capability" as const, description: "Vis notifikasjon" },
  // Capability tools (guardian)
  { name: "get_signals", type: "capability" as const, description: "Hent guardian-signaler" },
  { name: "acknowledge_signal", type: "capability" as const, description: "Kvitter signal" },
  {
    name: "get_workspace_health",
    type: "capability" as const,
    description: "Workspace helsestatus",
  },
  // Engine tools
  { name: "store", type: "engine" as const, description: "Lagre i engine_inbox" },
  { name: "fetch", type: "engine" as const, description: "Les kontekst og historikk" },
  { name: "advance", type: "engine" as const, description: "Neste stage i engine" },
  { name: "getJourneyContext", type: "engine" as const, description: "Journey-fremgang" },
];

// ─── Data: Roleplay scenarios (updated with all missions) ───

const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    id: "new-employee-day1",
    title: "Ny ansatt — dag 1",
    description: "Du er en ny servitør på din første dag. Botsson guider deg.",
    role: "employee",
    missionId: "onboarding-interview",
    context: "Første arbeidsdag, nervøs men motivert.",
  },
  {
    id: "manager-morning",
    title: "Leder — morgenrutine",
    description: "2 sykmeldinger, fullbooket kveld. Vaktassistenten hjelper.",
    role: "manager",
    missionId: "shift-assistant",
    context: "Mandag morgen, 2 sykmeldinger, fullbooket kveld.",
  },
  {
    id: "admin-haccp",
    title: "HACCP-avvik",
    description: "Temperaturavvik oppdaget. HACCP-inspektøren guider.",
    role: "admin",
    missionId: "haccp-inspector",
    context: "Kjøleskap KJ-02 viser 9°C. Grense: 4°C.",
  },
  {
    id: "landing-visitor",
    title: "Besøkende — landingsside",
    description: "Du er nysgjerrig på Smartout. Lise forklarer.",
    role: "employee",
    missionId: "landing-demo",
    context: "Driver restaurant, sliter med turnover.",
  },
  {
    id: "dashboard-help",
    title: "Leder — dashboard-hjelp",
    description: "Du trenger hjelp med rapporter og KPI-er. Mr. Botsson hjelper.",
    role: "manager",
    missionId: "mr-botsson",
    context: "Vil se readiness-score for teamet.",
  },
  {
    id: "training-quiz",
    title: "Ansatt — opplæringsquiz",
    description: "Test allergihåndtering med AI-treneren.",
    role: "employee",
    missionId: "onboarding-interview",
    context: "Allergiprotokoll-quiz.",
  },
];

// ─── Memory demo data ───

const MEMORY_EXAMPLES = [
  {
    id: "mem-1",
    content: "Bruker foretrekker korte svar",
    type: "preference",
    similarity: 0.94,
    created: "2025-03-05",
  },
  {
    id: "mem-2",
    content: "Allergisk mot skalldyr — viktig for HACCP",
    type: "fact",
    similarity: 0.91,
    created: "2025-03-04",
  },
  {
    id: "mem-3",
    content: "Jobber primært kveldsskift tirsdag-fredag",
    type: "schedule",
    similarity: 0.87,
    created: "2025-03-03",
  },
  {
    id: "mem-4",
    content: "Fullførte allergiprotokoll med 85% score",
    type: "achievement",
    similarity: 0.82,
    created: "2025-03-02",
  },
  {
    id: "mem-5",
    content: "Foretrekker norsk, forstår svensk",
    type: "preference",
    similarity: 0.78,
    created: "2025-03-01",
  },
];

// ─── Helper: Posture resolver (mirrors posture.ts logic) ───

function clamp(v: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

function resolvePostureClient(
  base: Record<string, number>,
  role: string,
  situation: string,
): Record<string, number> {
  const result = { ...base };
  const roleAdj = ROLE_ADJUSTMENTS[role] ?? {};
  const sitAdj = SITUATION_ADJUSTMENTS[situation] ?? {};

  for (const key of Object.keys(result)) {
    result[key] = clamp((result[key] ?? 0) + (roleAdj[key] ?? 0) + (sitAdj[key] ?? 0));
  }
  return result;
}

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/50">
                {m.mode}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/50">
                {m.voice}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/50">
                t={m.temperature}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-white/40">{m.description}</p>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
              <span>{m.stageCount} stages</span>
              <span>{m.guardrails.length} guardrails</span>
              <span>{Math.round(m.maxDurationSeconds / 60)}min max</span>
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
                  <div className="mt-0.5 flex gap-1">
                    {stage.tools.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="bg-warning/10 text-warning/50 rounded px-1 text-[8px]"
                      >
                        {t}
                      </span>
                    ))}
                    {stage.tools.length > 2 && (
                      <span className="text-[8px] text-white/20">+{stage.tools.length - 2}</span>
                    )}
                  </div>
                </div>
                {i < selectedMission.stages.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-white/20" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
                Guardrails
              </p>
              <ul className="mt-2 space-y-1">
                {selectedMission.guardrails.map((g) => (
                  <li key={g} className="flex items-start gap-2 text-xs text-white/50">
                    <Shield className="text-destructive/60 mt-0.5 h-3 w-3 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
                System Prompt
              </p>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed text-white/50">
                {selectedMission.systemPrompt}
              </pre>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PosturePanel() {
  const [dimensions, setDimensions] = useState<Record<string, number>>(
    Object.fromEntries(POSTURE_DIMENSIONS.map((d) => [d.key, d.value])),
  );
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [role, setRole] = useState<string>("employee");
  const [situation, setSituation] = useState<string>("general");

  const resolved = resolvePostureClient(dimensions, role, situation);

  const applyPreset = (preset: PersonalityPreset) => {
    setSelectedPreset(preset.id);
    setDimensions(preset.posture);
  };

  const dimColors: Record<string, string> = {
    formality: "bg-info",
    assertiveness: "bg-destructive",
    warmth: "bg-orange-400",
    humor: "bg-yellow-400",
    verbosity: "bg-green-400",
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {POSTURE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p)}
            className={`rounded-xl border p-3 text-left transition-all ${
              selectedPreset === p.id
                ? "border-purple-400/40 bg-purple-500/10"
                : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <p className="text-sm font-semibold text-white">{p.label}</p>
            <p className="mt-0.5 text-[10px] text-white/40">{p.tone}</p>
            <p className="mt-1 text-[10px] text-white/30">{p.description}</p>
          </button>
        ))}
      </div>

      {/* 5D Sliders */}
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          5D Personality — Base
        </p>
        <div className="mt-3 space-y-3">
          {POSTURE_DIMENSIONS.map((dim) => (
            <div key={dim.key} className="flex items-center gap-3">
              <span className="w-24 text-xs text-white/50">{dim.label}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={(dimensions[dim.key] ?? 0) * 100}
                onChange={(e) =>
                  setDimensions((prev) => ({ ...prev, [dim.key]: Number(e.target.value) / 100 }))
                }
                className="flex-1 accent-purple-400"
              />
              <span className="w-10 text-right font-mono text-[11px] text-white/40">
                {(dimensions[dim.key] ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Context modifiers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">Role</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full px-2.5 py-1 text-[10px] transition-all ${
                  role === r
                    ? "bg-purple-500/30 text-purple-300"
                    : "bg-white/[0.05] text-white/40 hover:text-white/60"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
            Situation
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {SITUATIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSituation(s)}
                className={`rounded-full px-2.5 py-1 text-[10px] transition-all ${
                  situation === s
                    ? "bg-purple-500/30 text-purple-300"
                    : "bg-white/[0.05] text-white/40 hover:text-white/60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resolved posture */}
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Resolved Posture — {role} in {situation}
        </p>
        <div className="mt-3 flex gap-3">
          {POSTURE_DIMENSIONS.map((dim) => {
            const base = dimensions[dim.key] ?? 0;
            const res = resolved[dim.key] ?? 0;
            const delta = res - base;
            return (
              <div key={dim.key} className="flex-1 text-center">
                <div className="mx-auto h-20 w-3 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`w-full rounded-full ${dimColors[dim.key]} opacity-60 transition-all duration-300`}
                    style={{ height: `${res * 100}%`, marginTop: `${(1 - res) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-medium text-white/50">
                  {dim.label.slice(0, 4)}
                </p>
                <p className="font-mono text-[10px] text-white/30">{res.toFixed(2)}</p>
                {delta !== 0 && (
                  <p
                    className={`text-[9px] ${delta > 0 ? "text-success/60" : "text-destructive/60"}`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(2)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ToolTestPanel() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string[]>(["Velg et verktøy for å teste."]);
  const [filter, setFilter] = useState<string>("all");

  const simulateTool = useCallback((name: string) => {
    setSelectedTool(name);
    const tool = AVAILABLE_TOOLS.find((t) => t.name === name);
    const route =
      tool?.type === "engine"
        ? `HTTP POST /sessions/:id/${name}`
        : tool?.type === "capability"
          ? `capability.${name}()`
          : "client callback";
    setTestLog((prev) =>
      [`${new Date().toLocaleTimeString()} — ${name}() → ${route} → OK (simulated)`, ...prev].slice(
        0,
        15,
      ),
    );
  }, []);

  const toolTypes = ["all", "client", "capability", "engine"] as const;
  const filtered =
    filter === "all" ? AVAILABLE_TOOLS : AVAILABLE_TOOLS.filter((t) => t.type === filter);

  const typeColors: Record<string, string> = {
    client: "text-warning/60",
    capability: "text-violet-400/60",
    engine: "text-sky-400/60",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {toolTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-[10px] transition-all ${
              filter === t ? "bg-white/15 text-white" : "bg-white/[0.05] text-white/40"
            }`}
          >
            {t} (
            {t === "all"
              ? AVAILABLE_TOOLS.length
              : AVAILABLE_TOOLS.filter((x) => x.type === t).length}
            )
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tool) => (
          <button
            key={tool.name}
            type="button"
            onClick={() => simulateTool(tool.name)}
            className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
              selectedTool === tool.name
                ? "border-warning/40 bg-warning/10"
                : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <Wrench className={`h-3.5 w-3.5 shrink-0 ${typeColors[tool.type]}`} />
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

function CapabilityPanel() {
  const [selectedAuthority, setSelectedAuthority] = useState<AuthorityLevel>("autonomous");

  const authorityColors: Record<AuthorityLevel, string> = {
    autonomous: "text-success bg-success/10",
    confirm: "text-sky-400 bg-sky-400/10",
    suggest: "text-warning bg-warning/10",
    read_only: "text-orange-400 bg-orange-400/10",
    disabled: "text-destructive bg-destructive/10",
  };

  const authorityDescriptions: Record<AuthorityLevel, string> = {
    autonomous: "Agent acts independently. No confirmation required.",
    confirm: "Agent proposes action, user must confirm before execution.",
    suggest: "Agent suggests, reduces assertiveness. User decides.",
    read_only: "Agent can only read data. No mutations. Formal tone.",
    disabled: "Capability completely off. Tools hidden from agent.",
  };

  return (
    <div className="space-y-4">
      {/* Authority level selector */}
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Authority Level (per-workspace, per-capability)
        </p>
        <div className="mt-3 flex gap-2">
          {AUTHORITY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedAuthority(level)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                selectedAuthority === level
                  ? authorityColors[level]
                  : "bg-white/[0.03] text-white/30 hover:text-white/50"
              }`}
            >
              {level.replace("_", " ")}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/40">{authorityDescriptions[selectedAuthority]}</p>
      </div>

      {/* Capability matrix */}
      <div className="space-y-2">
        {CAPABILITIES.map((cap) => {
          const toolAccess =
            selectedAuthority === "disabled"
              ? []
              : selectedAuthority === "read_only"
                ? cap.readOnlyTools
                : selectedAuthority === "suggest"
                  ? [...cap.readOnlyTools, ...cap.suggestTools]
                  : cap.tools;

          return (
            <div
              key={cap.name}
              className={`rounded-xl border p-3 transition-all ${
                selectedAuthority === "disabled"
                  ? "border-destructive/10 bg-destructive/[0.03] opacity-50"
                  : "border-white/[0.08] bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    cap.registered ? "bg-success/15 text-success" : "bg-white/[0.06] text-white/30"
                  }`}
                >
                  {cap.name}
                </div>
                <p className="flex-1 text-xs text-white/40">{cap.description}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] ${authorityColors[selectedAuthority]}`}
                >
                  {selectedAuthority.replace("_", " ")}
                </span>
                {!cap.registered && (
                  <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-[9px] text-yellow-400/60">
                    not registered
                  </span>
                )}
              </div>
              {toolAccess.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {toolAccess.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {selectedAuthority === "disabled" && (
                <p className="text-destructive/50 mt-1 text-[10px] italic">
                  All tools hidden from agent
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntentClassifierPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{
    domain: string;
    confidence: number;
    reasoning: string;
  } | null>(null);

  const classify = useCallback((message: string) => {
    if (!message.trim()) return;
    const lower = message.toLowerCase();

    // Simulated client-side classification (mirrors intent-classifier.ts logic)
    let bestDomain = "general";
    let bestConfidence = 0.3;
    let reasoning = "Ingen spesifikk intensjon oppdaget.";

    const patterns: [string, string[], string][] = [
      [
        "knowledge",
        ["rutine", "prosedyre", "regel", "policy", "allergi", "protokoll"],
        "Matches knowledge keywords",
      ],
      [
        "schedule",
        ["vakt", "skift", "jobber", "bytt", "tilgjengelig", "bemanning"],
        "Matches schedule keywords",
      ],
      [
        "training",
        ["kurs", "opplæring", "readiness", "quiz", "test", "trening"],
        "Matches training keywords",
      ],
      [
        "operations",
        ["åpning", "stenging", "sjekkliste", "daglig", "rutine", "drift"],
        "Matches operations keywords",
      ],
      ["profile", ["profil", "team", "kontrakt", "avdeling", "rolle"], "Matches profile keywords"],
      [
        "communication",
        ["send", "melding", "varsle", "notifikasjon"],
        "Matches communication keywords",
      ],
      ["memory", ["husker", "sist", "forrige", "husk"], "Matches memory keywords"],
      ["payroll", ["timer", "lønn", "overtid", "fradrag"], "Matches payroll keywords"],
      ["ui", ["gå til", "vis", "naviger", "marker", "felt"], "Matches UI keywords"],
    ];

    for (const [domain, keywords, reason] of patterns) {
      const matches = keywords.filter((k) => lower.includes(k)).length;
      if (matches > 0) {
        const confidence = Math.min(0.95, 0.5 + matches * 0.15);
        if (confidence > bestConfidence) {
          bestDomain = domain;
          bestConfidence = confidence;
          reasoning = reason;
        }
      }
    }

    // Greetings
    if (/^(hei|hallo|god|takk|yo)\b/i.test(lower)) {
      bestDomain = "general";
      bestConfidence = 0.85;
      reasoning = "Greeting or social message detected";
    }

    setResult({ domain: bestDomain, confidence: bestConfidence, reasoning });
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">
        Simulert intent-klassifisering. I produksjon bruker dette Claude Sonnet via OpenRouter.
      </p>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && classify(input)}
          placeholder="Skriv en melding som ansatt..."
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-purple-400/30 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => classify(input)}
          className="rounded-xl bg-purple-500/20 px-4 py-2.5 text-sm font-semibold text-purple-300 transition-colors hover:bg-purple-500/30"
        >
          Klassifiser
        </button>
      </div>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.08] bg-black/40 p-4"
        >
          <div className="flex items-center gap-4">
            <div
              className={`rounded-lg px-3 py-2 text-sm font-bold ${
                INTENT_DOMAINS.find((d) => d.domain === result.domain)?.color ?? "text-white/50"
              } bg-white/[0.06]`}
            >
              {result.domain}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      result.confidence > 0.7
                        ? "bg-success"
                        : result.confidence > 0.4
                          ? "bg-warning"
                          : "bg-destructive"
                    }`}
                    style={{ width: `${result.confidence * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-white/50">
                  {result.confidence.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-white/30">{result.reasoning}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Domain reference */}
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          10 Intent Domains
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {INTENT_DOMAINS.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => {
                setInput(d.examples[0]);
                classify(d.examples[0]);
              }}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-left transition-all hover:bg-white/[0.05]"
            >
              <p className={`text-xs font-semibold ${d.color}`}>{d.domain}</p>
              <p className="mt-0.5 text-[9px] text-white/30 italic">&quot;{d.examples[0]}&quot;</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemoryPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(MEMORY_EXAMPLES);

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults(MEMORY_EXAMPLES);
      return;
    }
    const lower = q.toLowerCase();
    const filtered = MEMORY_EXAMPLES.filter((m) => m.content.toLowerCase().includes(lower)).map(
      (m) => ({
        ...m,
        similarity: Math.max(0.5, m.similarity - Math.random() * 0.1),
      }),
    );
    setResults(
      filtered.length > 0
        ? filtered
        : MEMORY_EXAMPLES.map((m) => ({ ...m, similarity: Math.max(0.2, m.similarity - 0.3) })),
    );
  }, []);

  const typeColors: Record<string, string> = {
    preference: "text-purple-400 bg-purple-400/10",
    fact: "text-destructive bg-destructive/10",
    schedule: "text-sky-400 bg-sky-400/10",
    achievement: "text-success bg-success/10",
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">
        engine_memory med pgvector-embeddings. Semantisk søk finner relaterte minner basert på
        mening, ikke eksakt match.
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(query)}
            placeholder="Semantisk søk i agentminnet..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pr-4 pl-10 text-sm text-white placeholder:text-white/25 focus:border-purple-400/30 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => search(query)}
          className="rounded-xl bg-orange-500/20 px-4 py-2.5 text-sm font-semibold text-orange-300 transition-colors hover:bg-orange-500/30"
        >
          Søk
        </button>
      </div>

      <div className="space-y-2">
        {results.map((mem) => (
          <motion.div
            key={mem.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
              <Brain className="h-4 w-4 text-orange-400/60" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/70">{mem.content}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] ${typeColors[mem.type] ?? "bg-white/5 text-white/30"}`}
                >
                  {mem.type}
                </span>
                <span className="text-[9px] text-white/20">{mem.created}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-orange-400/60 transition-all duration-300"
                  style={{ width: `${mem.similarity * 100}%` }}
                />
              </div>
              <p className="mt-0.5 font-mono text-[9px] text-white/30">
                {mem.similarity.toFixed(2)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">Schema</p>
        <pre className="mt-2 text-[10px] leading-relaxed text-white/40">
          {`engine_memory
├── memory_id     uuid PK
├── workspace_id  uuid FK → workspace
├── profile_id    uuid FK → profile
├── session_id    uuid FK → engine_sessions
├── content       text
├── type          text (preference/fact/schedule/achievement)
├── embedding     vector(1536) — pgvector
├── metadata      jsonb
└── created_at    timestamptz`}
        </pre>
      </div>
    </div>
  );
}

function GuardianPanel({ selectedMission }: { selectedMission: MissionTemplate | null }) {
  const [eventStream, setEventStream] = useState<string[]>([
    "Guardian klar. Velg en mission og kjør evaluering.",
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const runEvaluation = useCallback(() => {
    if (!selectedMission) return;
    setIsRunning(true);

    const now = () => new Date().toLocaleTimeString();
    setEventStream((prev) =>
      [`${now()} [START] Evaluerer ${selectedMission.name}...`, ...prev].slice(0, 20),
    );

    const stages = selectedMission.stages;
    let delay = 400;

    for (const stage of stages) {
      const s = stage;
      setTimeout(() => {
        const elapsed = Math.floor(Math.random() * s.timingMax);
        const pct = Math.round((elapsed / s.timingMax) * 100);
        const severity = pct > 80 ? "critical" : pct > 50 ? "warning" : "info";
        const icon = severity === "critical" ? "🔴" : severity === "warning" ? "🟡" : "🟢";
        setEventStream((prev) =>
          [
            `${now()} ${icon} [${s.id}] ${elapsed}s/${s.timingMax}s (${pct}%) — ${severity}`,
            ...prev,
          ].slice(0, 20),
        );

        // Whisper intervention simulation
        if (severity === "critical") {
          setTimeout(() => {
            setEventStream((prev) =>
              [
                `${now()} 💬 [WHISPER] Stage "${s.id}" nærmer seg timeout. Vurder å avslutte.`,
                ...prev,
              ].slice(0, 20),
            );
          }, 200);
        }
      }, delay);
      delay += 350;
    }

    setTimeout(() => {
      setEventStream((prev) =>
        [`${now()} [DONE] Evaluering fullført. ${stages.length} stages sjekket.`, ...prev].slice(
          0,
          20,
        ),
      );
      setIsRunning(false);
    }, delay);
  }, [selectedMission]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <Gauge className="text-success/60 mx-auto h-5 w-5" />
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
          <Shield className="text-warning/60 mx-auto h-5 w-5" />
          <p className="mt-1 text-lg font-semibold text-white">
            {selectedMission?.guardrails.length ?? 0}
          </p>
          <p className="text-[10px] text-white/30">Guardrails</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <MessageCircle className="mx-auto h-5 w-5 text-purple-400/60" />
          <p className="mt-1 text-lg font-semibold text-white">Whisper</p>
          <p className="text-[10px] text-white/30">Intervensjon</p>
        </div>
      </div>

      <button
        type="button"
        onClick={runEvaluation}
        disabled={!selectedMission || isRunning}
        className="bg-success/20 text-success hover:bg-success/30 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-40"
      >
        {isRunning ? "Evaluerer..." : "Kjør Guardian-evaluering"}
      </button>

      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Guardian Event Stream
        </p>
        <div className="max-h-48 space-y-1 overflow-auto">
          {eventStream.map((entry, i) => (
            <p
              key={`${entry}-${i}`}
              className={`text-[11px] ${
                entry.includes("[WHISPER]")
                  ? "font-medium text-purple-300"
                  : entry.includes("🔴")
                    ? "text-destructive/70"
                    : entry.includes("🟡")
                      ? "text-warning/70"
                      : "text-white/50"
              }`}
            >
              {entry}
            </p>
          ))}
        </div>
      </div>

      {/* Guardian signal domains */}
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
          Signal Domains
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { domain: "readiness", desc: "Ansatt readiness-varsler", color: "text-success" },
            {
              domain: "workspace_maturity",
              desc: "Workspace modenhetsscore",
              color: "text-sky-400",
            },
            {
              domain: "agent_behavior",
              desc: "Agent-oppførselsovervåking",
              color: "text-purple-400",
            },
          ].map((d) => (
            <div key={d.domain} className="rounded-lg bg-white/[0.03] p-2">
              <p className={`text-xs font-medium ${d.color}`}>{d.domain}</p>
              <p className="text-[9px] text-white/30">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleplayPanel({ onLaunch }: { onLaunch: (scenario: RoleplayScenario) => void }) {
  const roleColors: Record<string, string> = {
    employee: "border-success/30 bg-success/10",
    manager: "border-sky-400/30 bg-sky-500/10",
    admin: "border-purple-400/30 bg-purple-500/10",
  };
  const roleLabels: Record<string, string> = {
    employee: "Ansatt",
    manager: "Leder",
    admin: "Admin",
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40">
        Velg et scenario for å starte en interaktiv rollespill-sesjon med AI-agenten.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLEPLAY_SCENARIOS.map((scenario) => {
          const mission = MISSION_TEMPLATES.find((m) => m.id === scenario.missionId);
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
              {mission && <p className="mt-1 text-[9px] text-white/20">Agent: {mission.agent}</p>}
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
  const [activeRoleplay, setActiveRoleplay] = useState<RoleplayScenario | null>(null);

  const tabs: { id: PlayparkTab; label: string; icon: typeof Bot }[] = [
    { id: "missions", label: "Missions", icon: Route },
    { id: "personality", label: "Posture 5D", icon: Sliders },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "capabilities", label: "Capabilities", icon: Layers },
    { id: "intent", label: "Intent", icon: Brain },
    { id: "memory", label: "Memory", icon: Eye },
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
                    {MISSION_TEMPLATES.length} missions · {AVAILABLE_TOOLS.length} tools ·{" "}
                    {CAPABILITIES.length} capabilities · {INTENT_DOMAINS.length} intent domains
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
            <div className="flex gap-0.5 overflow-x-auto border-b border-white/[0.06] px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${
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
              <div className="mx-auto max-w-5xl">
                {activeTab === "missions" && (
                  <MissionPanel selectedMission={selectedMission} onSelect={setSelectedMission} />
                )}
                {activeTab === "personality" && <PosturePanel />}
                {activeTab === "tools" && <ToolTestPanel />}
                {activeTab === "capabilities" && <CapabilityPanel />}
                {activeTab === "intent" && <IntentClassifierPanel />}
                {activeTab === "memory" && <MemoryPanel />}
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
                <Layers className="h-3 w-3" />
                Caps: {CAPABILITIES.filter((c) => c.registered).length}/{CAPABILITIES.length}{" "}
                registered
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                Tools: {AVAILABLE_TOOLS.length}
              </span>
              {activeRoleplay && (
                <span className="text-success/60 flex items-center gap-1">
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
            className="border-success/30 bg-success/15 fixed top-14 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-xl"
          >
            <Users className="text-success h-3.5 w-3.5" />
            <span className="text-success text-xs font-medium">
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
              <X className="text-success/60 h-3 w-3" />
            </button>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
