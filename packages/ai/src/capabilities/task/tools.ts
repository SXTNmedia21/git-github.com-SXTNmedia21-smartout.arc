/**
 * Task capability tools — ADR-0298 Sortie 3.
 *
 * Six tools unifying five task sources (session_task, personal_task, schedule_day_task,
 * emma_task, engine_state_step) behind a single capability surface.
 *
 * Read surface:
 *   list_mine        — fn_list_my_tasks RPC (4-source UNION); chat + voice
 *
 * Write surface (source-dispatched):
 *   create_personal  — personal_task (self, employee+); chat-only V1 (ADR-0298 R6)
 *   create_session   — session_task via BFF (manager+, assignee-verified); chat-only V1
 *   create_day_ad_hoc— schedule_day_task (manager+, date-anchored); chat-only V1
 *   complete         — source-dispatched to correct table/endpoint; chat + voice
 *   cancel_personal  — personal_task cancel (self-only, irreversible); chat-only V1
 *
 * Authority model (ADR-0298 §Authority + ADR-0287 gate_action mandatory):
 *   list_mine        — ungated read
 *   create_personal  — suggest, self (employee+)
 *   create_session   — suggest, manager+; assignee workspace-membership verified
 *   create_day_ad_hoc— suggest, manager+
 *   complete         — suggest, source-dependent (see spec §4.5)
 *   cancel_personal  — suggest, self-only
 *
 * Channel policy (ADR-0298 R6, V1):
 *   chat + voice:  list_mine, complete
 *   chat-only:     create_personal, create_session, create_day_ad_hoc, cancel_personal
 *   Enforcement: runtime check inside each chat-only tool body (in addition to capability
 *   allowedChannels declaration in index.ts which is chat+voice to allow read tools on voice).
 *
 * Identity (ADR-0151): workspace_id + profile_id are ALWAYS server-derived from
 * AgentToolContext. No tool parameter accepts workspace_id / profile_id / completed_by.
 * Schema uses .strict() (L-0237) to forbid forgeable identity fields in body.
 *
 * Phase 2 note: bodies throw not_implemented — Phase 4+5 implements them.
 * Tool metadata (name, description, schema, channel restriction comment) is complete and
 * correct per spec §4.1. Do NOT change tool names or Zod schemas without a spec amendment.
 */

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";

const CAPABILITY = "task" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Zod primitives
// ─────────────────────────────────────────────────────────────────────────────

/** ISO-8601 datetime string (e.g. '2026-05-22T12:00:00+02:00'). Validated as string only;
 *  semantic datetime validation happens at DB layer. */
const ISODateTimeSchema = z
  .string()
  .min(1)
  .describe("ISO-8601 datetime, e.g. '2026-05-22T12:00:00+02:00'");

/** ISO-8601 date string (e.g. '2026-05-22'). YYYY-MM-DD format. */
const ISODateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
  .describe("ISO-8601 date, e.g. '2026-05-22'");

/** UUID v4 string. */
const UUIDSchema = z.string().uuid().describe("UUID v4 identifier");

/** Non-empty string for human-readable fields (title, reason).
 *  .min(1) enforces non-empty; .max(500) prevents runaway input.
 *  ADR-0298 R4: no workspace_id / profile_id accepted as parameter. */
const TitleSchema = z
  .string()
  .min(1, "Title must be non-empty")
  .max(500)
  .describe("Human-readable task title — short, action-oriented.");

const ReasonSchema = z
  .string()
  .min(1, "Reason must be non-empty")
  .max(1000)
  .describe("Why this task is being created or cancelled — logged to audit trail.");

const PrioritySchema = z
  .enum(["low", "normal", "high", "urgent"])
  .default("normal")
  .describe("Priority: low, normal (default), high, urgent.");

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1 — task.list_mine
// Channels: chat + voice (no free-text input, no PII risk)
// Gate: ungated read (calls fn_list_my_tasks RPC)
// ─────────────────────────────────────────────────────────────────────────────

export const listMine = defineTool({
  name: "list_mine",
  description:
    "Hent alle oppgaver som tilhører den innloggede brukeren, på tvers av alle kilder " +
    "(sesjon, personlig, dagsplan, emma). " +
    "Bruk når brukeren sier 'hva må jeg gjøre', 'mine oppgaver', 'hva har jeg i dag', " +
    "'vis oppgavelisten', 'hva er åpent'. " +
    "Returnerer normaliserte rader sortert etter frist. Kaller fn_list_my_tasks RPC.",
  capability: CAPABILITY,
  schema: z
    .object({
      window_start: ISODateTimeSchema.optional().describe(
        "Start av tidsvindu (ISO-8601). Standard: 1 dag tilbake.",
      ),
      window_end: ISODateTimeSchema.optional().describe(
        "Slutt av tidsvindu (ISO-8601). Standard: 7 dager frem.",
      ),
    })
    .strict(),
  execute: async (_params, _ctx: AgentToolContext) => {
    // Phase 4 — T4.1 implements body.
    // Body: call fn_list_my_tasks RPC; thread window_start/window_end; return MyTaskRow[].
    throw new Error("not_implemented — Phase 4");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2 — task.create_personal
// Channels: CHAT-ONLY (ADR-0298 R6 — free-text title PII risk V1)
// Gate: task.create_personal, suggest, self (employee+)
// Writes to: personal_task
// ─────────────────────────────────────────────────────────────────────────────

export const createPersonal = defineTool({
  name: "create_personal",
  description:
    "Lag en personlig oppgave for den innloggede brukeren. " +
    "Bruk når brukeren sier 'lag oppgave', 'ny oppgave', 'jeg må huske å', 'todo', " +
    "'legg til X i oppgavelisten', 'gjør X'. " +
    "Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy, ADR-0298 R6. " +
    "Skriver til personal_task. Krever ingen spesiell rolle (employee+).",
  capability: CAPABILITY,
  schema: z
    .object({
      title: TitleSchema,
      due_at: ISODateTimeSchema.optional().describe(
        "Valgfri frist i ISO-8601 format, f.eks. '2026-05-22T12:00:00+02:00'.",
      ),
      priority: PrioritySchema,
    })
    .strict(),
  execute: async (_params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan oppgaver bare opprettes i chat, ikke via stemme (V1-policy). Si det skriftlig så lager jeg oppgaven.";
    }
    // Phase 4 — T4.2 implements body.
    // Body: gate_action(task.create_personal) → INSERT personal_task → emit "task created" {source:'personal'}
    throw new Error("not_implemented — Phase 4");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 — task.create_session
// Channels: CHAT-ONLY (ADR-0298 R6 — free-text title + assignee PII risk V1)
// Gate: task.create_session, suggest, manager+
// Writes to: session_task (via BFF / addTaskAction delegation)
// Special: assignee_profile_id requires workspace-membership verification (L-0177)
// ─────────────────────────────────────────────────────────────────────────────

export const createSession = defineTool({
  name: "create_session",
  description:
    "Opprett en sesjonsoppgave koblet til en aktiv avdelingsøkt. " +
    "Bruk når en leder sier 'lag oppgave til Anna', 'sett oppgave på morgenvakten', " +
    "'legg til HACCP-sjekk', 'ny oppgave i denne vakten'. " +
    "Krever manager+ rolle. Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy. " +
    "assignee_profile_id er den valgfrie mottakeren (må tilhøre samme workspace). " +
    "Delegerer til addTaskAction Server Action for å bevare telemetri og gate-konsistens.",
  capability: CAPABILITY,
  schema: z
    .object({
      session_id: UUIDSchema.describe(
        "UUID for den aktive department_session oppgaven kobles til.",
      ),
      title: TitleSchema,
      assignee_profile_id: UUIDSchema.optional().describe(
        "Valgfri: UUID for profilen som skal tildeles oppgaven. " +
          "Må tilhøre samme workspace som aktøren — avvises eksplisitt hvis ikke (L-0177).",
      ),
      hook_id: UUIDSchema.optional().describe(
        "Valgfri: UUID for session_hook oppgaven er koblet til (prosedyre/rutine-ankre).",
      ),
      compliance: z
        .boolean()
        .optional()
        .describe("Om oppgaven er compliance-relatert (HACCP, HMS, o.l.). Standard false."),
      reason: ReasonSchema.describe("Årsak til at oppgaven opprettes — logges til aktivitetsspor."),
    })
    .strict(),
  execute: async (_params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan sesjonsoppgaver bare opprettes i chat, ikke via stemme (V1-policy).";
    }
    // Phase 5 — T5.1 implements body.
    // Body: gate_action(task.create_session, manager+) → resolveAssigneeWorkspaceMembership
    //   → port addTaskAction body → INSERT session_task → emit "task created" {source:'session'}
    throw new Error("not_implemented — Phase 5");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4 — task.create_day_ad_hoc
// Channels: CHAT-ONLY (ADR-0298 R6 — free-text title + assignee PII risk V1)
// Gate: task.create_day_ad_hoc, suggest, manager+
// Writes to: schedule_day_task
// ─────────────────────────────────────────────────────────────────────────────

export const createDayAdHoc = defineTool({
  name: "create_day_ad_hoc",
  description:
    "Opprett en dagsplan-oppgave forankret på en bestemt dato. " +
    "Bruk når en leder sier 'legg til X på tirsdagens dagsplan', 'ny oppgave 22. mai', " +
    "'sett opp bestilling på fredag', 'highlight oppgave for i morgen'. " +
    "Krever manager+ rolle. Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy. " +
    "Skriver til schedule_day_task (D6 Production).",
  capability: CAPABILITY,
  schema: z
    .object({
      date: ISODateSchema.describe("Dato oppgaven gjelder for (YYYY-MM-DD)."),
      title: TitleSchema,
      assignee_profile_id: UUIDSchema.optional().describe(
        "Valgfri: UUID for profilen som skal utføre oppgaven. " +
          "Workspace-tilhørighet verifiseres ved innsetting (L-0177).",
      ),
      highlight: z
        .boolean()
        .optional()
        .describe("Om oppgaven skal fremheves på dagsplanen. Standard false."),
      category: z
        .string()
        .max(100)
        .optional()
        .describe("Valgfri kategorilabel, f.eks. 'rydding', 'bestilling', 'HMS'. Fri tekst."),
    })
    .strict(),
  execute: async (_params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan dagsplanoppgaver bare opprettes i chat, ikke via stemme (V1-policy).";
    }
    // Phase 5 — T5.2 implements body.
    // Body: gate_action(task.create_day_ad_hoc, manager+) → resolveAssigneeWorkspaceMembership (if assignee)
    //   → INSERT schedule_day_task → emit "task created" {source:'day_ad_hoc'}
    throw new Error("not_implemented — Phase 5");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 5 — task.complete
// Channels: chat + voice (no free-text input; source discriminator only)
// Gate: task.complete, suggest, source-dependent (see spec §4.5)
// Writes to: source-dispatched (personal_task | session_task | schedule_day_task | emma dismiss)
// ─────────────────────────────────────────────────────────────────────────────

export const complete = defineTool({
  name: "complete",
  description:
    "Marker en oppgave som fullført. " +
    "Bruk når brukeren sier 'ferdig med X', 'merk som utført', 'oppgave fullført', " +
    "'kryss av X', 'done'. " +
    "Tilgjengelig på chat og stemme. " +
    "source angir hvilken oppgavetype som fullføres: " +
    "'session' (sesjonsoppgave), 'personal' (personlig), 'day_ad_hoc' (dagsplan), 'emma' (Botsson-foreslått). " +
    "Dispatcher ruter til riktig tabell eller endepunkt basert på source.",
  capability: CAPABILITY,
  schema: z
    .object({
      id: UUIDSchema.describe("UUID for oppgaven som skal fullføres."),
      source: z
        .enum(["session", "personal", "day_ad_hoc", "emma"])
        .describe(
          "Oppgavekilde: 'session' (session_task), 'personal' (personal_task), " +
            "'day_ad_hoc' (schedule_day_task), 'emma' (emma_task — dismiss via /api/emma/tasks/dismiss).",
        ),
    })
    .strict(),
  execute: async (_params, _ctx: AgentToolContext) => {
    // Phase 5 — T5.3 implements body.
    // Body: gate_action(task.complete) → source-dispatch per spec §4.5:
    //   personal   → UPDATE personal_task SET status='done' WHERE id AND profile_id=self
    //   session    → existing operations.complete_task helper (manager+ OR assigned_to=self)
    //   day_ad_hoc → UPDATE schedule_day_task SET status='completed' WHERE id AND workspace scoped
    //   emma       → POST /api/emma/tasks/dismiss {id} with forwarded auth
    // Emit: "task completed" {source, completed_via: 'self'|'manager'|'agent'}
    throw new Error("not_implemented — Phase 5");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 6 — task.cancel_personal
// Channels: CHAT-ONLY (ADR-0298 R6 — irreversible action + reason PII risk V1)
// Gate: task.cancel_personal, suggest, self-only
// Writes to: personal_task (status=cancelled, irreversible)
// ─────────────────────────────────────────────────────────────────────────────

export const cancelPersonal = defineTool({
  name: "cancel_personal",
  description:
    "Avbryt en personlig oppgave (irreversibel). " +
    "Bruk når brukeren sier 'avbryt oppgave', 'slett oppgave', 'fjern fra listen', " +
    "'ikke lenger aktuelt', 'kanseller X'. " +
    "Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy. " +
    "Kun self-grant: brukeren kan bare avbryte sine egne personlige oppgaver. " +
    "Handlingen er irreversibel — oppgaven settes til 'cancelled', ikke slettet.",
  capability: CAPABILITY,
  schema: z
    .object({
      id: UUIDSchema.describe("UUID for den personlige oppgaven som skal avbrytes."),
      reason: ReasonSchema.describe(
        "Grunn til avbryting, f.eks. 'ikke lenger aktuelt', 'gjort manuelt'. Logges til aktivitetsspor.",
      ),
    })
    .strict(),
  execute: async (_params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan oppgaveavbrytelse bare gjøres i chat, ikke via stemme (V1-policy).";
    }
    // Phase 4 — T4.3 implements body.
    // Body: gate_action(task.cancel_personal, self) → UPDATE personal_task SET status='cancelled'
    //   WHERE id AND profile_id=ctx.profileId → emit "task cancelled" {source:'personal', reason}
    throw new Error("not_implemented — Phase 4");
  },
});
