/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi — Core Types                       */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type WalkAiDensity = "orb" | "sticky" | "arena" | "immersive";

export type OrbStatus = "idle" | "listening" | "thinking" | "speaking" | "notification";

export type AgentRank = "admin" | "manager" | "employee" | "trainee";

export type AgentPersona = "saga" | "puls" | "gnist" | "vakt";

/** 0 = pure persona, 10 = pure rank authority */
export type PersonaRankBlend = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type AgentIdentity = {
  rank: AgentRank;
  persona: AgentPersona;
  blend: PersonaRankBlend;
};

export type ContentViewType = "chat" | "form" | "video" | "visualizer" | "notepad" | "calculator" | "settings" | "tasks";

export type ContentStackItem = {
  id: string;
  type: ContentViewType;
  props: Record<string, unknown>;
};

export type WalkAiPosition = {
  x: number;
  y: number;
};

export type WalkAiSize = {
  width: number;
  height: number;
};

export type WalkAiState = {
  density: WalkAiDensity;
  position: WalkAiPosition;
  arenaSize: WalkAiSize;
  orbStatus: OrbStatus;
  contentStack: ContentStackItem[];
  isDragging: boolean;
  isResizing: boolean;
};

/** Dimensions per density — single source of truth */
export const DENSITY_DIMENSIONS = {
  orb: { width: 50, height: 50, borderRadius: 25 },
  sticky: { width: 250, height: 200, borderRadius: 12 },
  arena: { width: 600, height: 500, borderRadius: 16 },
  immersive: { width: -1, height: -1, borderRadius: 0 }, // -1 = viewport
} as const;

/** How much of the sticky peeks out when retracted (px) */
export const STICKY_PEEK = 36;

/** Timing */
export const TIMING = {
  morph: 280,
  contentEnter: 180,
  contentExit: 120,
  orbBreathing: 3000,
  stickyRetract: 400,
} as const;

/** Magnetic edge gap — don't go flush, hold this distance */
export const EDGE_GAP = 10;

/** Arena size constraints */
export const ARENA_MIN = { width: 320, height: 300 } as const;
export const ARENA_MAX = { width: 900, height: 800 } as const;

/* ━━━ Voices — Ultravox voice registry ━━━━━ */

export type VoiceOption = {
  id: string;
  name: string;
  description: string;
};

/** Available voices — all Ultravox INCLUDED billing (no external API key needed) */
export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "a0b371b7-4133-4d02-971f-213913d9025a", name: "Lise Botsson", description: "Smartouts stemme (NO)" },
  { id: "d082550b-596a-42f7-9356-840b4a095d3f", name: "Emma", description: "Norsk kvinne" },
  { id: "864c6a02-ee99-47a1-b7d8-a723aa754bf4", name: "Johannes", description: "Norsk mann" },
  { id: "cd617a9a-8ce8-4b44-8306-300b6e55c0f3", name: "Sanna", description: "Svensk kvinne" },
  { id: "90dbf12f-9cb0-4da0-b51f-ad2d4c5d9995", name: "Adam", description: "Svensk mann" },
  { id: "3274a450-a199-4421-8b16-fdfa923ccf23", name: "Mathias", description: "Dansk mann" },
];

/** Default voice — Emma */
export const DEFAULT_VOICE_ID = VOICE_OPTIONS[1]!.id;

/** A personality preset for Lisa — same voice, different behavior */
export type LisaPersonality = {
  name: string;
  description: string;
  identity: AgentIdentity;
  tuning: Partial<VoiceTuning>;
};

/** Lisa's personality presets — she's always Lisa, just different modes */
export const LISA_PERSONALITIES: LisaPersonality[] = [
  {
    name: "Dagsjef",
    description: "Rask, besluttsom, full kontroll",
    identity: { rank: "admin", persona: "puls", blend: 8 },
    tuning: { temperature: 0.2, firstSpeaker: "agent", greeting: "Hei! Hva trenger du?" },
  },
  {
    name: "Mentor",
    description: "Tålmodig veileder, coacher deg gjennom",
    identity: { rank: "manager", persona: "saga", blend: 4 },
    tuning: { temperature: 0.4, firstSpeaker: "user" },
  },
  {
    name: "Nysgjerrig kollega",
    description: "Utforsker ideer sammen med deg",
    identity: { rank: "employee", persona: "gnist", blend: 2 },
    tuning: { temperature: 0.7, firstSpeaker: "user" },
  },
  {
    name: "Trygg start",
    description: "Varm onboarding for nye ansatte",
    identity: { rank: "trainee", persona: "vakt", blend: 1 },
    tuning: { temperature: 0.5, firstSpeaker: "agent", greeting: "Hei og velkommen! Jeg er her for å hjelpe deg i gang. Bare spør om hva som helst." },
  },
  {
    name: "Strategisk rådgiver",
    description: "Rolig, ser mønstre, gir dype innsikter",
    identity: { rank: "admin", persona: "saga", blend: 6 },
    tuning: { temperature: 0.3, firstSpeaker: "user" },
  },
  {
    name: "Brannslukker",
    description: "Energisk tempomaker med coaching-tone",
    identity: { rank: "manager", persona: "puls", blend: 7 },
    tuning: { temperature: 0.2, firstSpeaker: "agent", greeting: "OK, hva brenner?" },
  },
];

/** Voice session tuning knobs */
export type VoiceTuning = {
  temperature: number;       // 0–1, default 0.3
  maxDuration: string;       // e.g. "1800s"
  firstSpeaker: "user" | "agent";
  greeting: string;          // agent greeting text (when agent speaks first)
  inactivityTimeout: string; // e.g. "15s"
  inactivityMessage: string; // what to say on timeout
  timeExceededMessage: string;
};

export const DEFAULT_VOICE_TUNING: VoiceTuning = {
  temperature: 0.3,
  maxDuration: "1800s",
  firstSpeaker: "user",
  greeting: "",
  inactivityTimeout: "15s",
  inactivityMessage: "Er du fortsatt der?",
  timeExceededMessage: "Vi har dessverre gått tom for tid. Ha en fin dag!",
};

/* ━━━ Notes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type WalkAiNote = {
  id: string;
  content: string;
  topic: string;
  createdAt: number;
  updatedAt: number;
  /** What screen/view the user was on when the note was created */
  screen: string;
  /** What the user was working on / talking about */
  context: string;
  /** Profile tags mentioned in the note */
  tags: string[];
};

/** CSS easing — confident, no bounce */
export const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
