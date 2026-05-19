// tools-schedule.ts — Schedule proposal tools for the LiveKit voice agent.
//
// Botsson proposes. The human accepts. The uncommitted dies quietly.
//
// These tools NEVER write to the database directly. Each publishes a
// data-channel event (type: "shift_proposal_*") over botsson-activity.
// BotssonShell forwards to window event "botsson:shift-proposal".
// ScheduleVoiceToolsBridge listens and calls addProposal() in
// AgentProposalsContext — the existing human-approval pipeline.
//
// Path-gating: tools return a dialogic redirect if the user is not on
// /dashboard/schedule. Botsson offers to navigate; no proposal published.
//
// Defence model (SMA-299 / Fase 4 R1):
//   Proposal tools do NOT use the ADR-0078 three-layer channel guard because
//   they do not write to domain tables. Their defence is structural isolation:
//   registered only in the voice-agent runtime (no chat twin in V0). Domain
//   mutation is gated at the human acceptance step, not at the voice channel.
//   Input validation (UUID format, path check) is defence-in-depth, not a
//   channel guard. When a chat propose_* twin is built, full L1+L2+L3 guard
//   is required. SMA-299 tracks ADR-0078 amendment to formalise this model.
//
// No gate_action needed: no mutation touches domain tables.
// No emit() needed: activity_trail entry comes from stage-engine recorder
// (flows automatically after Task 2 auth fix).
//
// ADR-0289: last deliberate additions to the parallel tool array before R1.3.

import { llm } from "@livekit/agents";
import { _publishActivity } from "./adapter-internal.js";
import { getSessionContextSnapshot } from "./context.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCHEDULE_PATH_PREFIX = "/dashboard/schedule";

function checkSchedulePath(): string | null {
  const ctx = getSessionContextSnapshot();
  const path = ctx.route?.path ?? "";
  // Exact match OR prefix-with-slash so a future "/dashboard/schedule-builder"
  // does not silently bypass the gate via startsWith(prefix).
  if (path !== SCHEDULE_PATH_PREFIX && !path.startsWith(SCHEDULE_PATH_PREFIX + "/")) {
    return (
      "Du må være på vaktplan-siden for at jeg skal kunne foreslå dette. " +
      "Vil du at jeg navigerer deg dit?"
    );
  }
  return null;
}

// Allowed keys for propose_update_shift.patch — defence-in-depth against LLM
// hallucinating cross-employee or cross-workspace keys. JSON-schema layer
// rejects unknown keys at the OpenRouter boundary; this set is mirrored by
// the execute() body for runtime defence.
const ALLOWED_PATCH_KEYS = new Set(["startTime", "endTime", "role", "dateId"]);

export const scheduleTools = {
  // ── propose_create_shift ──────────────────────────────────
  propose_create_shift: llm.tool({
    description: [
      "Foreslå å lage en ny vakt i vaktplanen.",
      'Bruk når brukeren sier "lag vakt", "sett opp vakt", "legg til vakt",',
      '"planlegg vakt til [navn] [dag] kl [tid]-[tid]".',
      "Forslaget vises som et ghost card i vaktplanen som brukeren må godkjenne.",
      "Kun tilgjengelig når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        employee_id: {
          type: "string",
          description: "UUID til den ansatte som skal ha vakten.",
        },
        employee_name: {
          type: "string",
          description: "Visningsnavn på den ansatte (for ghost card label).",
        },
        date_id: {
          type: "string",
          description: 'Dato i YYYY-MM-DD format, f.eks. "2026-05-09".',
        },
        role: {
          type: "string",
          description: 'Stillingstittel eller rolle, f.eks. "Servitør", "Kjøkken".',
        },
        start_time: {
          type: "string",
          description: 'Starttid HH:MM, f.eks. "16:00".',
        },
        end_time: {
          type: "string",
          description: 'Sluttid HH:MM, f.eks. "22:00".',
        },
      },
      required: ["employee_id", "date_id", "role", "start_time", "end_time"],
      additionalProperties: false,
    },
    execute: async ({
      employee_id,
      employee_name,
      date_id,
      role,
      start_time,
      end_time,
    }: {
      employee_id: string;
      employee_name?: string;
      date_id: string;
      role: string;
      start_time: string;
      end_time: string;
    }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;

      if (!UUID_RE.test(employee_id)) {
        return `employee_id "${employee_id}" er ikke en gyldig UUID. Søk opp ansatt-ID først.`;
      }

      const [sh, sm] = start_time.split(":").map(Number);
      const [eh, em] = end_time.split(":").map(Number);
      if (
        isNaN(sh) ||
        isNaN(sm) ||
        isNaN(eh) ||
        isNaN(em) ||
        sh < 0 ||
        sh > 23 ||
        eh < 0 ||
        eh > 23
      ) {
        return `Ugyldig tid: start="${start_time}", slutt="${end_time}". Bruk HH:MM format.`;
      }

      const workHours = (eh * 60 + em - (sh * 60 + sm)) / 60;

      _publishActivity({
        type: "shift_proposal_create",
        payload: {
          id: crypto.randomUUID(),
          type: "create",
          source: "agent_response",
          employeeId: employee_id,
          employeeName: employee_name,
          dateId: date_id,
          role,
          startTime: start_time,
          endTime: end_time,
          workHours,
          dayCategory: "evening",
          indicator: "blue",
          breaks: 0,
        },
      });

      return `Forslag sendt: vakt for ${employee_name ?? employee_id} ${date_id} kl ${start_time}–${end_time}. Brukeren må godkjenne det i vaktplanen.`;
    },
  }),

  // ── propose_update_shift ──────────────────────────────────
  propose_update_shift: llm.tool({
    description: [
      "Foreslå å endre en eksisterende vakt (tid, rolle, dato).",
      'Bruk når brukeren sier "endre vakten til", "flytt vakten", "oppdater vakt",',
      '"forleng vakten til". Sender endringsforslag som ghost card.',
      "Kun tilgjengelig når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        shift_id: {
          type: "string",
          description: "UUID til vakten som skal endres.",
        },
        employee_id: {
          type: "string",
          description: "UUID til den ansatte (for kontekst i ghost card).",
        },
        date_id: {
          type: "string",
          description: "Dato for vakten i YYYY-MM-DD format.",
        },
        patch: {
          type: "object",
          description:
            'Felter som skal endres. Bare disse nøklene er tillatt: "startTime" (HH:MM), "endTime" (HH:MM), "role" (string), "dateId" (YYYY-MM-DD).',
          properties: {
            startTime: { type: "string", description: "HH:MM" },
            endTime: { type: "string", description: "HH:MM" },
            role: { type: "string" },
            dateId: { type: "string", description: "YYYY-MM-DD" },
          },
          additionalProperties: false,
        },
      },
      required: ["shift_id", "employee_id", "date_id", "patch"],
      additionalProperties: false,
    },
    execute: async ({
      shift_id,
      employee_id,
      date_id,
      patch,
    }: {
      shift_id: string;
      employee_id: string;
      date_id: string;
      patch: Record<string, unknown>;
    }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;

      if (!UUID_RE.test(shift_id)) {
        return `shift_id "${shift_id}" er ikke en gyldig UUID.`;
      }

      // Runtime patch allow-list — defence-in-depth even if JSON-schema gate
      // is bypassed. Reject (not silently strip) to surface LLM hallucination.
      const forbiddenKeys = Object.keys(patch).filter((k) => !ALLOWED_PATCH_KEYS.has(k));
      if (forbiddenKeys.length > 0) {
        return `Patch inneholder ikke-tillatte nøkler: ${forbiddenKeys.join(", ")}. Bare startTime, endTime, role og dateId er gyldige.`;
      }

      _publishActivity({
        type: "shift_proposal_update",
        payload: {
          id: crypto.randomUUID(),
          type: "update",
          source: "agent_response",
          shiftId: shift_id,
          employeeId: employee_id,
          dateId: date_id,
          patch,
        },
      });

      const patchSummary = Object.entries(patch)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ");
      return `Endringsforslag sendt: vakt ${shift_id} — ${patchSummary}. Brukeren må godkjenne det.`;
    },
  }),

  // ── propose_delete_shift ──────────────────────────────────
  propose_delete_shift: llm.tool({
    description: [
      "Foreslå å slette en eksisterende vakt.",
      'Bruk når brukeren sier "slett vakten", "fjern vakten til [navn]", "ta bort vakt".',
      "Sender sletteforslag som ghost card — vakten beholdes til brukeren godkjenner.",
      "Kun tilgjengelig når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        shift_id: {
          type: "string",
          description: "UUID til vakten som skal slettes.",
        },
        employee_id: {
          type: "string",
          description: "UUID til den ansatte (for kontekst i ghost card).",
        },
        date_id: {
          type: "string",
          description: "Dato for vakten i YYYY-MM-DD format.",
        },
      },
      required: ["shift_id", "employee_id", "date_id"],
      additionalProperties: false,
    },
    execute: async ({
      shift_id,
      employee_id,
      date_id,
    }: {
      shift_id: string;
      employee_id: string;
      date_id: string;
    }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;

      if (!UUID_RE.test(shift_id)) {
        return `shift_id "${shift_id}" er ikke en gyldig UUID.`;
      }

      _publishActivity({
        type: "shift_proposal_delete",
        payload: {
          id: crypto.randomUUID(),
          type: "delete",
          source: "agent_response",
          shiftId: shift_id,
          employeeId: employee_id,
          dateId: date_id,
        },
      });

      return `Sletteforslag sendt for vakt ${shift_id}. Vakten beholdes til brukeren godkjenner.`;
    },
  }),

  // ── set_schedule_date ──────────────────────────────────
  // View-state tool, not a mutation. Published as schedule_view_change event;
  // ScheduleVoiceToolsBridge listens and calls navigateToDate(weekOffset).
  // Path-gated. No human approval required (changes view only).
  set_schedule_date: llm.tool({
    description: [
      "Bytt hvilken uke vaktplanen viser. View-endring, ingen vakt-mutasjon.",
      'Bruk når brukeren sier "neste uke", "forrige uke", "denne uka",',
      '"to uker fram", "tilbake 3 uker", "uka som var".',
      "Tar weekOffset relativt til nåværende uke (0=denne, +1=neste, -1=forrige).",
      "Bare når brukeren er på vaktplan-siden. Andre sider: si nei og foreslå nav først.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        week_offset: {
          type: "integer",
          description:
            "Antall uker fram (+) eller tilbake (-) fra nåværende uke. 0=denne uka. Område: -26 til +26.",
          minimum: -26,
          maximum: 26,
        },
      },
      required: ["week_offset"],
      additionalProperties: false,
    },
    execute: async ({ week_offset }: { week_offset: number }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      if (!Number.isInteger(week_offset) || week_offset < -26 || week_offset > 26) {
        return `week_offset "${week_offset}" må være heltall mellom -26 og +26.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: { action: "navigate_date", weekOffset: week_offset },
      });
      const label =
        week_offset === 0
          ? "denne uka"
          : week_offset === 1
            ? "neste uke"
            : week_offset === -1
              ? "forrige uke"
              : week_offset > 0
                ? `${week_offset} uker fram`
                : `${Math.abs(week_offset)} uker tilbake`;
      return `Bytter vaktplan til ${label}.`;
    },
  }),

  // ── set_schedule_columns ──────────────────────────────────
  // Switches the schedule's column grouping. Enum-gated.
  set_schedule_columns: llm.tool({
    description: [
      "Bytt hvordan kolonnene i vaktplanen er gruppert.",
      'Bruk når brukeren sier "vis per ansatt", "grupper på jobb", "vis per team",',
      '"vis per lokasjon".',
      "Allowed values: ansatt | jobb | team | lokasjon.",
      "Bare når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        view: {
          type: "string",
          enum: ["ansatt", "jobb", "team", "lokasjon"],
          description:
            "Kolonnegruppering. ansatt=per person, jobb=per rolle, team=per team, lokasjon=per sted.",
        },
      },
      required: ["view"],
      additionalProperties: false,
    },
    execute: async ({ view }: { view: string }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      const allowed = ["ansatt", "jobb", "team", "lokasjon"];
      if (!allowed.includes(view)) {
        return `Ugyldig view "${view}". Bruk: ${allowed.join(", ")}.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: { action: "switch_columns", view },
      });
      return `Bytter kolonnegruppering til ${view}.`;
    },
  }),

  // ── set_schedule_period ──────────────────────────────────
  // Adjusts the visible time period (number of weeks shown). Enum-gated.
  set_schedule_period: llm.tool({
    description: [
      "Bytt hvor mange uker vaktplanen viser på en gang.",
      'Bruk når brukeren sier "vis månedsoversikt", "to uker", "kun denne uka",',
      '"vis to måneder".',
      "Allowed values: 1, 2, 4, 8 (uker). 4=månedsoversikt, 8=to måneder.",
      "Bare når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        weeks: {
          type: "integer",
          enum: [1, 2, 4, 8],
          description: "Antall uker som vises samtidig. 1, 2, 4 (måned), eller 8 (to måneder).",
        },
      },
      required: ["weeks"],
      additionalProperties: false,
    },
    execute: async ({ weeks }: { weeks: number }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      if (![1, 2, 4, 8].includes(weeks)) {
        return `Ugyldig periode "${weeks}". Bruk: 1, 2, 4, eller 8 uker.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: { action: "set_period", weeks },
      });
      const label =
        weeks === 1
          ? "én uke"
          : weeks === 2
            ? "to uker"
            : weeks === 4
              ? "månedsoversikt (4 uker)"
              : "to måneder (8 uker)";
      return `Viser ${label}.`;
    },
  }),

  // ── set_schedule_filter ──────────────────────────────────
  // Filters the schedule by situation. Free-string accepted but normalized.
  set_schedule_filter: llm.tool({
    description: [
      "Filtrer vaktplanen på en situasjon.",
      'Bruk når brukeren sier "vis bare ubemannet", "filter på sykmeldt",',
      '"vis bare overbemannet", "fjern filter", "vis alle".',
      'Allowed values: "Alle" (fjern filter), "Underbemannet", "Overbemannet", "Sykmeldt", "Ferie".',
      "Bare når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        filter: {
          type: "string",
          enum: ["Alle", "Underbemannet", "Overbemannet", "Sykmeldt", "Ferie"],
          description: 'Filter-situasjon. "Alle" fjerner filteret.',
        },
      },
      required: ["filter"],
      additionalProperties: false,
    },
    execute: async ({ filter }: { filter: string }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      const allowed = ["Alle", "Underbemannet", "Overbemannet", "Sykmeldt", "Ferie"];
      if (!allowed.includes(filter)) {
        return `Ugyldig filter "${filter}". Bruk: ${allowed.join(", ")}.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: { action: "set_filter", filter },
      });
      return filter === "Alle"
        ? "Filter fjernet — viser alle vakter."
        : `Filtrert på ${filter.toLowerCase()}.`;
    },
  }),

  // ── set_schedule_layout ──────────────────────────────────
  // Switches between layout modes. Enum-gated.
  set_schedule_layout: llm.tool({
    description: [
      "Bytt layout-modus for vaktplanen.",
      'Bruk når brukeren sier "vis ukeplan", "månedsvisning", "vaktliste",',
      '"vis bemanning per dag", "list-visning".',
      "Allowed values: daily (ukeplan), monthly (månedsvisning), list (vaktliste), grid (bemanning).",
      "Bare når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        layout: {
          type: "string",
          enum: ["daily", "monthly", "list", "grid"],
          description:
            "Layout-modus. daily=ukeplan, monthly=månedsvisning, list=vaktliste, grid=bemanning per dag.",
        },
      },
      required: ["layout"],
      additionalProperties: false,
    },
    execute: async ({ layout }: { layout: string }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      const allowed = ["daily", "monthly", "list", "grid"];
      if (!allowed.includes(layout)) {
        return `Ugyldig layout "${layout}". Bruk: ${allowed.join(", ")}.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: { action: "switch_layout", layout },
      });
      const labels: Record<string, string> = {
        daily: "Ukeplan",
        monthly: "Månedsvisning",
        list: "Vaktliste",
        grid: "Bemanning per dag",
      };
      return `Bytter til ${labels[layout]}.`;
    },
  }),

  // ── set_schedule_focus_day ──────────────────────────────────
  // Focuses a specific day in the current week view. Validates YYYY-MM-DD.
  set_schedule_focus_day: llm.tool({
    description: [
      "Fokuser en bestemt dag i vaktplanen (markerer dagen + skroller dit).",
      'Bruk når brukeren sier "vis fredag", "hopp til 14. mai", "se på lørdag",',
      '"åpne dagsplan for mandag".',
      "Dato må være i YYYY-MM-DD format. Sett open_planner=true for å åpne dagsplan-modal.",
      "Bare når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        date_id: {
          type: "string",
          description: 'Dato i YYYY-MM-DD format, f.eks. "2026-05-14".',
        },
        open_planner: {
          type: "boolean",
          description: "Åpne dagsplan-modal etter fokus. Default false.",
        },
      },
      required: ["date_id"],
      additionalProperties: false,
    },
    execute: async ({ date_id, open_planner }: { date_id: string; open_planner?: boolean }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date_id)) {
        return `date_id "${date_id}" må være YYYY-MM-DD.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: { action: "focus_day", dateId: date_id, openPlanner: !!open_planner },
      });
      return open_planner ? `Åpner dagsplan for ${date_id}.` : `Fokuserer ${date_id} i vaktplanen.`;
    },
  }),

  // ── set_schedule_density ───────────────────────────────────────────────────
  // L-0234: single schedule_view_change event, new "set_density" action discriminant.
  // Persistence is ride-along via the shared UI setter in schedule-voice-tools-bridge.tsx
  // — voice tool itself does NOT write to domain tables (view-state-only per plan §5).
  set_schedule_density: llm.tool({
    description: [
      "Bytt tetthet på vaktplan-kort.",
      'Bruk når brukeren sier "vis mer info", "kompakt visning", "gi meg pulsen",',
      '"større kort", "krymp", "vis dagen som hetekart".',
      "Allowed values: cozy | default | compact | pulse.",
      "Pulse = heatmap-modus for å se hele uka på én skjerm.",
      "Bare når brukeren er på vaktplan-siden.",
    ].join(" "),
    parameters: {
      type: "object" as const,
      properties: {
        density: {
          type: "string",
          enum: ["cozy", "default", "compact", "pulse"],
        },
      },
      required: ["density"],
      additionalProperties: false,
    },
    execute: async ({ density }: { density: string }) => {
      const redirect = checkSchedulePath();
      if (redirect) return redirect;
      if (!["cozy", "default", "compact", "pulse"].includes(density)) {
        return `Ugyldig tetthet "${density}". Tillatte verdier: cozy, default, compact, pulse.`;
      }
      _publishActivity({
        type: "schedule_view_change",
        payload: {
          action: "set_density",
          density: density as "cozy" | "default" | "compact" | "pulse",
        },
      });
      return density === "pulse" ? "Bytter til puls-modus." : `Bytter til ${density}-visning.`;
    },
  }),
};
