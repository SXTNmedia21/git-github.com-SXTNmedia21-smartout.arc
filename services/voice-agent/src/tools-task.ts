// tools-task.ts — Task-ontology tool wrappers for the LiveKit voice agent.
//
// Six thin LLM-tools forwarding to stage-engine via the ask() pipe, mirroring
// the task capability surface from ADR-0298 Sortie 3.
//
// Channel policy (ADR-0298 R6):
//   Voice + chat safe : list_my_tasks, complete_task
//   Chat-only (V1)    : create_personal_task, create_session_task,
//                       create_day_task, cancel_personal_task
//
// Chat-only enforcement is NOT done here — we call ask() which forwards
// channel="voice" to stage-engine. Stage-engine capability channel guard
// (ADR-0288) returns the Norwegian refusal text. The voice-agent does NOT
// block — stage-engine is the single source of truth for channel policy.
//
// All descriptions are Norwegian, matching the user language and stage-engine
// system prompt (mirrors tools-personal.ts style).
//
// Integration: import buildTaskTools and spread result into buildAllBotssonTools()
// in adapter.ts. Do NOT modify any existing tool in adapter.ts.
//
// ADR-0298 row 5a — Sortie 5a.

import { llm } from "@livekit/agents";

// Type for the ask() helper imported from adapter.ts.
// Factory pattern avoids circular imports — adapter.ts injects its ask().
type AskFn = (query: string, label: string) => Promise<string>;

export function buildTaskTools(ask: AskFn) {
  return {
    // ── list_my_tasks ─────────────────────────────────────────────────────────
    list_my_tasks: llm.tool({
      description: [
        "Vis brukerens åpne oppgaver fra alle kilder (personal, session, day, emma).",
        'Bruk når brukeren spør "hva må jeg gjøre", "vis oppgavene mine", "hva står for tur",',
        '"hva må jeg fikse i dag". Returnerer liste i prioritert rekkefølge.',
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          window_start: {
            type: "string",
            description: "Valgfri ISO-8601 startgrense, standard: i går.",
          },
          window_end: {
            type: "string",
            description: "Valgfri ISO-8601 sluttgrense, standard: om 7 dager.",
          },
        },
        additionalProperties: false,
      },
      execute: async ({
        window_start,
        window_end,
      }: {
        window_start?: string;
        window_end?: string;
      }) => {
        const range =
          window_start || window_end
            ? ` (fra ${window_start ?? "i går"} til ${window_end ?? "+7 dager"})`
            : "";
        return ask(`Vis mine åpne oppgaver${range}.`, "list_my_tasks");
      },
    }),

    // ── complete_task ─────────────────────────────────────────────────────────
    complete_task: llm.tool({
      description: [
        "Marker en oppgave som ferdig. Identifiser oppgaven via id (UUID).",
        'Bruk når brukeren sier "marker som ferdig", "ferdig med X", "kryss av Y", "gjort".',
        "Source-feltet angir hvilket oppgavedomene: session, personal, day_ad_hoc, emma.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Oppgavens UUID, hentet fra list_my_tasks.",
          },
          source: {
            type: "string",
            enum: ["session", "personal", "day_ad_hoc", "emma"],
            description:
              "Oppgavens domene. session = D6, personal = brukerens egen, day_ad_hoc = manager-skapt, emma = AI-foreslått.",
          },
        },
        required: ["id", "source"],
        additionalProperties: false,
      },
      execute: async ({ id, source }: { id: string; source: string }) => {
        return ask(`Marker oppgave ${id} (source: ${source}) som ferdig.`, "complete_task");
      },
    }),

    // ── create_personal_task ──────────────────────────────────────────────────
    create_personal_task: llm.tool({
      description: [
        "Lag en personlig oppgave (kun for brukeren selv).",
        'Bruk når brukeren sier "lag personlig oppgave: X" eller "husk å Y for meg".',
        "OBS: chat-only i V1. Voice-kanal returnerer 'Si dette på tekst...' refusjon.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Oppgavebeskrivelse.",
          },
          due_at: {
            type: "string",
            description: "Valgfri ISO-8601 frist.",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
      execute: async (args: { title: string; due_at?: string; priority?: string }) => {
        const due = args.due_at ? ` (frist: ${args.due_at})` : "";
        const prio = args.priority ? ` [prio: ${args.priority}]` : "";
        return ask(
          `Opprett personlig oppgave: "${args.title}"${due}${prio}.`,
          "create_personal_task",
        );
      },
    }),

    // ── create_session_task ───────────────────────────────────────────────────
    // V1: voice surface intentionally narrower than chat per ADR-0298 R6 + L-0233 (Two LLM contexts).
    // description + scheduled_at are chat-only params; voice channel is rejected at tools.ts:415.
    create_session_task: llm.tool({
      description: [
        "Lag en D6 oppgave knyttet til en åpen vakt/session. Manager-only.",
        'Bruk når sjef sier "lag oppgave til Anna under lunsj-vakta" eller "ny sjekk på kveldskontroll".',
        "OBS: chat-only i V1. Voice-kanal returnerer refusjon.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "department_session UUID.",
          },
          title: {
            type: "string",
          },
          assignee_profile_id: {
            type: "string",
            description: "Valgfri tildelt ansatt UUID.",
          },
          hook_id: {
            type: "string",
            description: "Valgfri session_hook UUID.",
          },
          compliance: {
            type: "boolean",
          },
          reason: {
            type: "string",
            description: "Begrunnelse for hvorfor oppgaven opprettes.",
          },
        },
        required: ["session_id", "title", "reason"],
        additionalProperties: false,
      },
      execute: async (args: {
        session_id: string;
        title: string;
        assignee_profile_id?: string;
        hook_id?: string;
        compliance?: boolean;
        reason: string;
      }) => {
        return ask(
          `Opprett session_task på ${args.session_id}: "${args.title}". Begrunnelse: ${args.reason}.`,
          "create_session_task",
        );
      },
    }),

    // ── create_day_task ───────────────────────────────────────────────────────
    create_day_task: llm.tool({
      description: [
        "Lag en ad-hoc dagsoppgave (ikke knyttet til vakt). Manager-only.",
        'Bruk når sjef sier "legg til oppgave på torsdag" eller "alle ansatte skal sjekke X på fredag".',
        "OBS: chat-only i V1. Voice-kanal returnerer refusjon.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "ISO-8601 dato (YYYY-MM-DD).",
          },
          title: {
            type: "string",
          },
          assignee_profile_id: {
            type: "string",
            description: "Valgfri tildelt ansatt UUID.",
          },
          highlight: {
            type: "boolean",
          },
          category: {
            type: "string",
          },
        },
        required: ["date", "title"],
        additionalProperties: false,
      },
      execute: async (args: {
        date: string;
        title: string;
        assignee_profile_id?: string;
        highlight?: boolean;
        category?: string;
      }) => {
        return ask(`Opprett dagsoppgave ${args.date}: "${args.title}".`, "create_day_task");
      },
    }),

    // ── cancel_personal_task ──────────────────────────────────────────────────
    cancel_personal_task: llm.tool({
      description: [
        "Avbryt en personlig oppgave (sletter ikke, markerer cancelled).",
        'Bruk når brukeren sier "avbryt", "drop oppgaven", "ikke nødvendig lenger".',
        "OBS: chat-only i V1. Voice-kanal returnerer refusjon. Irreversibel.",
      ].join(" "),
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Oppgavens UUID.",
          },
          reason: {
            type: "string",
            description: "Begrunnelse for avbrytelse.",
          },
        },
        required: ["id", "reason"],
        additionalProperties: false,
      },
      execute: async ({ id, reason }: { id: string; reason: string }) => {
        return ask(
          `Avbryt personlig oppgave ${id}. Begrunnelse: ${reason}.`,
          "cancel_personal_task",
        );
      },
    }),
  };
}
