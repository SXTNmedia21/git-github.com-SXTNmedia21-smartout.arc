// tools-orb.ts — LLM tools that let Mr. Botsson control the Orb from the voice-agent.
//
// Each tool publishes an "orb_command" activity event over the LiveKit data
// channel (topic: "botsson-activity"). The browser-side BotssonVoiceCall
// component subscribes via packages/botsson-sdk and dispatches a
// "botsson:voice-activity" window event; BotssonProvider picks it up and
// routes the command to the correct action (expand, collapse, pulse, etc.).
//
// No DB writes. No gate_action needed — these are pure UI commands.
// No telemetry emit required (UI state, not a business mutation).
//
// Cross-cutting laws:
//   - Law 3 (channel guard): N/A — no PII involved.
//   - Law 5 (no service role to L1): N/A — no DB.
//   - Law 1 (workspace scope): N/A — no DB.
//
// Event shape published:
//   { type: "orb_command", action: OrbAction, args: Record<string, unknown>, ts: number }
//
// Browser handler lives in:
//   apps/web/src/app/Botsson/_components/BotssonVoiceCall.tsx

import { llm } from "@livekit/agents";

// Re-use the internal publishActivity from adapter.ts via this module.
// We import from the adapter so that tools-orb.ts doesn't need its own Room ref.
// The adapter calls setRoomContext() before any tool can fire, so activeLkRoom is
// always populated when tools execute during an active voice session.

// NOTE: publishActivity is not exported by adapter.ts today. We re-export a
// thin wrapper here and adapter.ts will import it from us after refactoring.
// For now we accept the same module-level Room reference by importing from adapter.
// The adapter will import and spread orbTools, which means adapter.ts is loaded
// first — Room is available when orbTools.execute runs.
import { _publishActivity } from "./adapter-internal.js";

// ---------------------------------------------------------------------------
// Orb command shapes
// ---------------------------------------------------------------------------

// Kept local — the canonical type lives in packages/botsson-sdk/src/types.ts.
// We don't import from botsson-sdk here: voice-agent is a standalone Node process
// that doesn't depend on the web app's packages tree.

type OrbCommandAction = "expand" | "collapse" | "pulse" | "pin" | "unpin" | "move" | "set_state";

function publishOrbCommand(action: OrbCommandAction, args: Record<string, unknown> = {}): void {
  _publishActivity({ type: "orb_command", action, args });
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const orbTools = {
  // -- EXPAND ----------------------------------------------------------------
  expand_orb: llm.tool({
    description: [
      "Utvid Botsson-orben til full arena-modus.",
      "Bruk når brukeren vil se chat-historikk, notater, oppgaver, eller jobber med noe som trenger skjermflate.",
      'Eksempel: "vis meg notatene mine", "åpne chatten", "vis meg oppgavene".',
      "Etter utvidelse: sett i gang med det brukeren ba om — ikke bare bekreft at du utvidet.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    execute: async () => {
      publishOrbCommand("expand");
      return "Arena åpnet.";
    },
  }),

  // -- COLLAPSE --------------------------------------------------------------
  collapse_orb: llm.tool({
    description: [
      "Kollaps Botsson-arenaen tilbake til en liten orb.",
      'Bruk når brukeren sier "lukk", "minimer", "gå bort", "forsvinne litt", eller samtalen er ferdig.',
      "Etter kollaps: bli stille og vent. Ikke tilby å åpne igjen med mindre brukeren ber om det.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    execute: async () => {
      publishOrbCommand("collapse");
      return "Orb minimert. Bli stille og vent.";
    },
  }),

  // -- PULSE -----------------------------------------------------------------
  pulse_orb: llm.tool({
    description: [
      "Få orben til å pulsere/blinke for å hente brukerens oppmerksomhet.",
      "Bruk når du har noe viktig å fortelle og trenger å signalisere det visuelt,",
      'eller når brukeren sier "gjør deg synlig", "varsle meg", "la orben pulsere".',
      "Pulserer i angitt antall sekunder, deretter tilbake til normal.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        duration_seconds: {
          type: "integer",
          description: "Antall sekunder orben skal pulsere. Standard: 3.",
          default: 3,
        },
      },
      additionalProperties: false,
    },
    execute: async ({ duration_seconds = 3 }: { duration_seconds?: number }) => {
      publishOrbCommand("pulse", { duration_seconds });
      return `Orben pulserer i ${duration_seconds} sekunder.`;
    },
  }),

  // -- PIN -------------------------------------------------------------------
  pin_orb: llm.tool({
    description: [
      "Fest orben åpen (utvidet arena) mens en lang oppgave kjører.",
      "Orben vil ikke kollapse automatisk — forblir åpen til unpin_orb kalles.",
      "Bruk når du skal utføre en flerstegs-oppgave som tar tid og brukeren bør se fremgangen.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    execute: async () => {
      publishOrbCommand("pin");
      return "Orben er festet åpen. Husker å kalle unpin_orb når oppgaven er ferdig.";
    },
  }),

  // -- UNPIN -----------------------------------------------------------------
  unpin_orb: llm.tool({
    description: [
      "Løsne orben fra festet modus — orb kan igjen kollapse automatisk.",
      "Kall alltid unpin_orb når en lang oppgave er ferdig (etter at pin_orb ble kalt).",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {},
      additionalProperties: false,
    },
    execute: async () => {
      publishOrbCommand("unpin");
      return "Orben er løsnet. Kan nå minimere automatisk.";
    },
  }),

  // -- MOVE ------------------------------------------------------------------
  move_orb: llm.tool({
    description: [
      "Flytt orben til et bestemt hjørne av skjermen.",
      'Bruk når brukeren sier "flytt deg til øverst til venstre", "gå til hjørnet", "flytt orben til høyre".',
      "Tilgjengelige hjørner: top-left, top-right, bottom-left, bottom-right.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        corner: {
          type: "string",
          enum: ["top-left", "top-right", "bottom-left", "bottom-right"],
          description: "Hjørnet orben skal flyttes til.",
        },
      },
      required: ["corner"],
      additionalProperties: false,
    },
    execute: async ({
      corner,
    }: {
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    }) => {
      publishOrbCommand("move", { corner });
      return `Orben flyttes til ${corner}.`;
    },
  }),

  // -- NAVIGATE --------------------------------------------------------------
  // Allowlist of valid Botsson-navigable paths. Kept in sync with
  // apps/web/src/app/Botsson/_components/BotssonTools.ts DASHBOARD_PAGES.
  // Phase 2 sortie will move both to a shared package (@smartout/ai or similar).
  // Reason: 2026-05-19 — LLM hallucinated /dashboard/hse via free-form path.
  navigate_to: llm.tool({
    description: [
      "Naviger brukeren til en bestemt side i Smartout-dashbordet.",
      'Bruk når brukeren sier "gå til vaktplan", "vis meg kontrakten min",',
      '"åpne innstillinger", "ta meg til opplæring", osv.',
      "Stien MÅ være eksakt match mot allowlisten — ikke gjett, ikke konstruér nye URL-er.",
      "Gyldige stier: /dashboard, /dashboard/schedule, /dashboard/my-schedule,",
      "/dashboard/calendar, /dashboard/operations, /dashboard/shift-clock, /dashboard/close,",
      "/dashboard/reconciliation, /dashboard/planning, /dashboard/year-wheel,",
      "/dashboard/people, /dashboard/contracts, /dashboard/governance, /dashboard/policies,",
      "/dashboard/handbook, /dashboard/hms, /dashboard/reports, /dashboard/payroll,",
      "/dashboard/cost, /dashboard/billing, /dashboard/komm, /dashboard/chat,",
      "/dashboard/notifications, /dashboard/proposals, /dashboard/my-training,",
      "/dashboard/my-contract, /dashboard/my-cv, /dashboard/my-profile, /dashboard/my-salary,",
      "/dashboard/settings, /dashboard/ai, /dashboard/website, /dashboard/help.",
      "Hvis brukeren ber om en side som ikke er i listen, si fra — IKKE finn opp en URL.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Eksakt relativ URL-sti fra allowlisten over, f.eks. /dashboard/schedule.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    execute: async ({ path }: { path: string }) => {
      // Allowlist enforced server-side. Phase 1 keeps the list inline; Phase
      // 2 sortie will share it with apps/web via a shared package.
      const ALLOWED_PATHS = new Set<string>([
        "/dashboard",
        "/dashboard/schedule",
        "/dashboard/my-schedule",
        "/dashboard/calendar",
        "/dashboard/operations",
        "/dashboard/shift-clock",
        "/dashboard/close",
        "/dashboard/reconciliation",
        "/dashboard/planning",
        "/dashboard/year-wheel",
        "/dashboard/people",
        "/dashboard/contracts",
        "/dashboard/governance",
        "/dashboard/policies",
        "/dashboard/handbook",
        "/dashboard/hms",
        "/dashboard/reports",
        "/dashboard/payroll",
        "/dashboard/cost",
        "/dashboard/billing",
        "/dashboard/komm",
        "/dashboard/chat",
        "/dashboard/notifications",
        "/dashboard/proposals",
        "/dashboard/my-training",
        "/dashboard/my-contract",
        "/dashboard/my-cv",
        "/dashboard/my-profile",
        "/dashboard/my-salary",
        // SM-9: organization → settings#struktur-overview
        "/dashboard/settings#struktur-overview",
        "/dashboard/settings",
        "/dashboard/ai",
        "/dashboard/website",
        "/dashboard/help",
      ]);
      if (!path.startsWith("/")) {
        return `Ugyldig sti: "${path}". Stien må starte med /.`;
      }
      if (!ALLOWED_PATHS.has(path)) {
        return (
          `Ugyldig sti: "${path}". Stien er ikke i allowlisten. ` +
          `Du kan kun navigere til kjente dashbord-ruter. ` +
          `Si fra til brukeren at siden ikke finnes — IKKE finn opp en URL.`
        );
      }
      // Publish a navigate activity event. BotssonShell.handleVoiceActivity
      // listens on topic "botsson-activity" and calls router.push(ev.path).
      _publishActivity({ type: "navigate", path });
      return `Navigerer til ${path}.`;
    },
  }),

  // -- SET STATE -------------------------------------------------------------
  set_orb_state: llm.tool({
    description: [
      "Sett orbens visuelle tilstand for å signalisere hva Mr. Botsson gjør.",
      "working = jobber aktivt med noe (pulserende arbeidsindikator).",
      "alert = viktig varsel (oransje, oppmerksom).",
      "celebrating = feirer en suksess (gledelig animasjon).",
      "idle = tilbake til normal hvilemodus.",
      "Bruk working/celebrating/alert ved naturlige punkter i samtalen — ikke overbruk.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          enum: ["working", "alert", "celebrating", "idle"],
          description: 'Ny orb-tilstand: "working", "alert", "celebrating", eller "idle".',
        },
      },
      required: ["state"],
      additionalProperties: false,
    },
    execute: async ({ state }: { state: "working" | "alert" | "celebrating" | "idle" }) => {
      publishOrbCommand("set_state", { state });
      return `Orb-tilstand: ${state}.`;
    },
  }),
};
