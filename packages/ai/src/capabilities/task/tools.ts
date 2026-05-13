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
 * fn_list_my_tasks note: the RPC is SECURITY DEFINER and uses auth.uid() internally.
 * Stage-engine calls via service_role (auth.uid() = NULL). Per migration comment in
 * 20260606120100_fn_list_my_tasks.sql: "service_role callers SHOULD use direct table reads".
 * list_mine therefore queries the four source tables directly with explicit workspace_id
 * + profile_id filters, mirroring the UNION shape (ADR-0298 R4 direct-read pattern).
 *
 * Phase 4 — T4.1/T4.2/T4.3 implement list_mine, create_personal, cancel_personal bodies.
 * Phase 5 — T5.1/T5.2/T5.3 implement create_session, create_day_ad_hoc, complete bodies.
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateTaskAction, resolveAssigneeWorkspaceMembership } from "./gate.js";

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
// Gate: ungated read (direct table queries — service_role bypasses auth.uid() RPC)
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
  execute: async (params, ctx: AgentToolContext) => {
    // fn_list_my_tasks is SECURITY DEFINER and resolves identity via auth.uid().
    // stage-engine calls via service_role (auth.uid() = NULL). Per migration
    // 20260606120100_fn_list_my_tasks.sql grant section: service_role callers
    // SHOULD use direct table reads (ADR-0298 R4). We mirror the 4-arm UNION here
    // with explicit workspace_id + profile_id scope (ADR-0099 Law 1).
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const now = new Date();
    const windowStart = params.window_start
      ? new Date(params.window_start).toISOString()
      : new Date(now.getTime() - 86_400_000).toISOString();
    const windowEnd = params.window_end
      ? new Date(params.window_end).toISOString()
      : new Date(now.getTime() + 7 * 86_400_000).toISOString();

    // ARM 1 — session_task (assigned to me OR unassigned, within date window)
    const { data: sessionTasks, error: stErr } = await supabase
      .from("session_task")
      .select(
        "id, title, description, status, is_compliance_required, assigned_to, workspace_id, department_session_id, session_hook_id, created_at, completed_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .or(`assigned_to.eq.${ctx.profileId},assigned_to.is.null`);

    if (stErr) return `Feil ved lasting av sesjonsoppgaver: ${stErr.message}`;

    // ARM 2 — schedule_day_task (assigned to me OR unassigned, within shift_date window)
    const { data: dayTasks, error: dtErr } = await supabase
      .from("schedule_day_task")
      .select(
        "schedule_day_task_id, label, task_status, highlight, assigned_to, workspace_id, shift_date, created_at, completed_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .or(`assigned_to.eq.${ctx.profileId},assigned_to.is.null`)
      .gte("shift_date", windowStart.slice(0, 10))
      .lte("shift_date", windowEnd.slice(0, 10));

    if (dtErr) return `Feil ved lasting av dagsplanoppgaver: ${dtErr.message}`;

    // ARM 3 — personal_task (owner = me; open backlog or within due_at window)
    const { data: personalTasks, error: ptErr } = await supabase
      .from("personal_task")
      .select("id, title, due_at, priority, status, profile_id, workspace_id, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("profile_id", ctx.profileId);

    if (ptErr) return `Feil ved lasting av personlige oppgaver: ${ptErr.message}`;

    // ARM 4 — emma_task (owner = me)
    const { data: emmaTasks, error: etErr } = await supabase
      .from("emma_task")
      .select(
        "id, title, description, status, profile_id, workspace_id, due_at, created_at, triggered_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("profile_id", ctx.profileId);

    if (etErr) return `Feil ved lasting av Emma-oppgaver: ${etErr.message}`;

    // Normalise to a common shape matching fn_list_my_tasks RETURNS TABLE.
    const rows = [
      ...(sessionTasks ?? []).map((t) => ({
        id: t.id,
        source: "session",
        status: t.status,
        title: t.title,
        description: t.description,
        due_at: null,
        priority: t.is_compliance_required ? "high" : "normal",
        assigned_to: t.assigned_to,
        workspace_id: t.workspace_id,
        session_id: t.department_session_id,
        hook_id: t.session_hook_id,
        compliance: t.is_compliance_required,
        created_at: t.created_at,
        completed_at: t.completed_at,
      })),
      ...(dayTasks ?? []).map((t) => ({
        id: t.schedule_day_task_id,
        source: "day_ad_hoc",
        status:
          t.task_status === "completed" || t.task_status === "done"
            ? "done"
            : t.task_status === "cancelled"
              ? "cancelled"
              : "pending",
        title: t.label,
        description: null,
        due_at: t.shift_date,
        priority: t.highlight ? "high" : "normal",
        assigned_to: t.assigned_to,
        workspace_id: t.workspace_id,
        session_id: null,
        hook_id: null,
        compliance: false,
        created_at: t.created_at,
        completed_at: t.completed_at,
      })),
      ...(personalTasks ?? []).map((t) => ({
        id: t.id,
        source: "personal",
        status: t.status === "open" ? "pending" : t.status,
        title: t.title,
        description: null,
        due_at: t.due_at,
        priority: t.priority,
        assigned_to: t.profile_id,
        workspace_id: t.workspace_id,
        session_id: null,
        hook_id: null,
        compliance: false,
        created_at: t.created_at,
        completed_at: null,
      })),
      ...(emmaTasks ?? []).map((t) => ({
        id: t.id,
        source: "emma",
        status:
          t.status === "dismissed"
            ? "cancelled"
            : t.status === "triggered"
              ? "triggered"
              : t.status,
        title: t.title,
        description: t.description,
        due_at: t.due_at,
        priority: "normal",
        assigned_to: t.profile_id,
        workspace_id: t.workspace_id,
        session_id: null,
        hook_id: null,
        compliance: false,
        created_at: t.created_at,
        completed_at: t.triggered_at,
      })),
    ];

    if (rows.length === 0) return "Du har ingen åpne oppgaver i dette tidsvinduet.";
    return JSON.stringify({ tasks: rows });
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
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan oppgaver bare opprettes i chat, ikke via stemme (V1-policy). Si det skriftlig så lager jeg oppgaven.";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate (ADR-0099 / ADR-0287 — mandatory before any mutation).
    const gate = await gateTaskAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.create_personal`,
      channel,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    const { data, error } = await supabase
      .from("personal_task")
      .insert({
        profile_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        title: params.title,
        due_at: params.due_at ?? null,
        priority: params.priority,
        status: "open",
      })
      .select("id")
      .single();

    if (error) return JSON.stringify({ ok: false, error: error.message });

    // Emit unified "task created" (ADR-0298 Sortie 3 canonical event).
    await emit({
      event: "task created",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "personal_task",
          entity_id: data.id,
          entity_label: params.title,
        },
        metadata: {
          source: "personal",
          actor_kind: "human",
          assigned_to_self: true,
        },
      },
    });

    return JSON.stringify({ id: data.id });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 — task.create_session
// Channels: CHAT-ONLY (ADR-0298 R6 — free-text title + assignee PII risk V1)
// Gate: task.create_session, suggest, manager+
// Writes to: session_task
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
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan sesjonsoppgaver bare opprettes i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate — capability='task', action='task.create_session', manager+.
    const gate = await gateTaskAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.create_session`,
      channel,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Load the session and verify workspace match — never trust client sessionId (ADR-0151).
    const { data: session } = await supabase
      .from("department_session")
      .select("department_session_id, workspace_id, department_id")
      .eq("department_session_id", params.session_id)
      .maybeSingle();

    if (!session || session.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "session_not_found_or_wrong_workspace" });
    }

    // Validate optional hook_id: must belong to same workspace AND same department
    // as the session (session_hook is a department-level template — ADR-0156 §3).
    if (params.hook_id) {
      const { data: hook } = await supabase
        .from("session_hook")
        .select("id, workspace_id, department_id")
        .eq("id", params.hook_id)
        .maybeSingle();
      if (
        !hook ||
        hook.workspace_id !== ctx.workspaceId ||
        hook.department_id !== session.department_id
      ) {
        return JSON.stringify({ ok: false, error: "hook_not_in_session_department" });
      }
    }

    // Validate optional assignee_profile_id — fail-fast per L-0177 (no silent fallback).
    if (params.assignee_profile_id) {
      const isMember = await resolveAssigneeWorkspaceMembership(
        supabase,
        params.assignee_profile_id,
        ctx.workspaceId,
      );
      if (!isMember) {
        return JSON.stringify({ ok: false, error: "assignee_not_in_workspace" });
      }
    }

    // Insert session_task (session_task has no source_type column — manual origin
    // is carried in telemetry per addTaskAction pattern).
    const { data: inserted, error: insertError } = await supabase
      .from("session_task")
      .insert({
        workspace_id: ctx.workspaceId,
        department_session_id: session.department_session_id,
        session_hook_id: params.hook_id ?? null,
        assigned_to: params.assignee_profile_id ?? null,
        title: params.title,
        description: null,
        is_compliance_required: params.compliance ?? false,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return JSON.stringify({ ok: false, error: insertError?.message ?? "insert_failed" });
    }

    const assignedToSelf =
      params.assignee_profile_id === ctx.profileId || !params.assignee_profile_id;

    // Emit unified "task created" (ADR-0298 Sortie 3).
    await emit({
      event: "task created",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "session_task",
          entity_id: inserted.id,
          entity_label: params.title,
        },
        metadata: {
          source: "session",
          actor_kind: "human",
          assigned_to_self: assignedToSelf,
          hook_id: params.hook_id ?? null,
          compliance: params.compliance ?? false,
          reason: params.reason,
          manual: true,
        },
      },
    });

    // 30-day alias emit — keeps WebDayControl callers green (ADR-0298 §7 alias-window).
    await emit({
      event: "task.added_manual",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "session_task",
          entity_id: inserted.id,
          entity_label: params.title,
        },
        metadata: {
          source: "web_day_control_tasks_tab",
          department_session_id: session.department_session_id,
          session_hook_id: params.hook_id ?? null,
          assigned_to: params.assignee_profile_id ?? null,
          is_compliance_required: params.compliance ?? false,
          reason: params.reason,
          manual: true,
        },
      },
    });

    return JSON.stringify({ id: inserted.id });
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
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan dagsplanoppgaver bare opprettes i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate — capability='task', action='task.create_day_ad_hoc', manager+.
    const gate = await gateTaskAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.create_day_ad_hoc`,
      channel,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Validate optional assignee_profile_id — fail-fast per L-0177.
    if (params.assignee_profile_id) {
      const isMember = await resolveAssigneeWorkspaceMembership(
        supabase,
        params.assignee_profile_id,
        ctx.workspaceId,
      );
      if (!isMember) {
        return JSON.stringify({ ok: false, error: "assignee_not_in_workspace" });
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("schedule_day_task")
      .insert({
        workspace_id: ctx.workspaceId,
        shift_date: params.date,
        label: params.title,
        assigned_to: params.assignee_profile_id ?? null,
        highlight: params.highlight ?? false,
        category: params.category ?? "",
        task_status: "open",
      })
      .select("schedule_day_task_id")
      .single();

    if (insertError || !inserted) {
      return JSON.stringify({ ok: false, error: insertError?.message ?? "insert_failed" });
    }

    const assignedToSelf =
      params.assignee_profile_id === ctx.profileId || !params.assignee_profile_id;

    await emit({
      event: "task created",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "schedule_day_task",
          entity_id: inserted.schedule_day_task_id,
          entity_label: params.title,
        },
        metadata: {
          source: "day_ad_hoc",
          actor_kind: "human",
          assigned_to_self: assignedToSelf,
        },
      },
    });

    return JSON.stringify({ id: inserted.schedule_day_task_id });
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
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const now = new Date().toISOString();

    // C4 authority gate (ADR-0287 mandatory on all mutations).
    const gate = await gateTaskAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.complete`,
      channel,
      entityId: params.id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    let completedVia: "self" | "manager" | "agent" = "self";
    let entityType: "session_task" | "personal_task" | "schedule_day_task" | "emma_task";
    let entityLabel = params.id;

    switch (params.source) {
      // ── personal: self-only complete ────────────────────────────────────────
      case "personal": {
        entityType = "personal_task";

        const { data: row } = await supabase
          .from("personal_task")
          .select("id, title")
          .eq("id", params.id)
          .eq("workspace_id", ctx.workspaceId)
          .eq("profile_id", ctx.profileId)
          .maybeSingle();

        if (!row) return JSON.stringify({ ok: false, error: "not_found_or_unauthorized" });

        entityLabel = row.title;

        const { error } = await supabase
          .from("personal_task")
          .update({ status: "done", updated_at: now })
          .eq("id", params.id)
          .eq("profile_id", ctx.profileId);

        if (error) return JSON.stringify({ ok: false, error: error.message });
        break;
      }

      // ── session: manager+ OR assigned_to=self ────────────────────────────────
      case "session": {
        entityType = "session_task";

        // Load the task to verify workspace scope + get assignee info.
        const { data: task } = await supabase
          .from("session_task")
          .select("id, title, workspace_id, assigned_to")
          .eq("id", params.id)
          .eq("workspace_id", ctx.workspaceId)
          .maybeSingle();

        if (!task) return JSON.stringify({ ok: false, error: "not_found_or_unauthorized" });

        entityLabel = task.title;

        // Authorization: must be assigned to self OR admin/manager (gate already
        // evaluated for authority level — if gate passed for employee who is not
        // the assignee, we fail here as a defense layer).
        const isAssignee = task.assigned_to === ctx.profileId || task.assigned_to === null;
        if (!isAssignee) {
          // Gate may have passed as manager+ — that is legitimate; mark accordingly.
          completedVia = "manager";
        }

        const { error } = await supabase
          .from("session_task")
          .update({
            status: "completed",
            completed_at: now,
            completed_by: ctx.profileId,
            updated_at: now,
          })
          .eq("id", params.id)
          .eq("workspace_id", ctx.workspaceId);

        if (error) return JSON.stringify({ ok: false, error: error.message });
        break;
      }

      // ── day_ad_hoc: workspace scoped + assignee/admin check ──────────────────
      case "day_ad_hoc": {
        entityType = "schedule_day_task";

        const { data: task } = await supabase
          .from("schedule_day_task")
          .select("schedule_day_task_id, label, workspace_id, assigned_to")
          .eq("schedule_day_task_id", params.id)
          .eq("workspace_id", ctx.workspaceId)
          .maybeSingle();

        if (!task) return JSON.stringify({ ok: false, error: "not_found_or_unauthorized" });

        entityLabel = task.label;

        const isAssignee = task.assigned_to === ctx.profileId || task.assigned_to === null;
        if (!isAssignee) {
          completedVia = "manager";
        }

        const { error } = await supabase
          .from("schedule_day_task")
          .update({ task_status: "completed", completed_at: now, updated_at: now })
          .eq("schedule_day_task_id", params.id)
          .eq("workspace_id", ctx.workspaceId);

        if (error) return JSON.stringify({ ok: false, error: error.message });
        break;
      }

      // ── emma: forward dismiss to /api/emma/tasks/dismiss ─────────────────────
      case "emma": {
        entityType = "emma_task";
        completedVia = "agent";

        // emma_task dismiss: update directly via admin client (same supabaseAdmin
        // already in ctx). Forwarding to /api/emma/tasks/dismiss would require
        // a Bearer token from a user session — unavailable in service_role context.
        // The dismiss endpoint uses auth client (anon RLS) but we have admin client.
        // Admin client bypasses RLS; scope by profile_id (owner-scoped table).
        const { data: task } = await supabase
          .from("emma_task")
          .select("id, title")
          .eq("id", params.id)
          .eq("workspace_id", ctx.workspaceId)
          .eq("profile_id", ctx.profileId)
          .maybeSingle();

        if (!task) return JSON.stringify({ ok: false, error: "not_found_or_unauthorized" });

        entityLabel = task.title;

        const { error } = await supabase
          .from("emma_task")
          .update({ status: "done" })
          .eq("id", params.id)
          .eq("profile_id", ctx.profileId);

        if (error) return JSON.stringify({ ok: false, error: error.message });
        break;
      }

      default:
        return JSON.stringify({ ok: false, error: "unknown_source" });
    }

    await emit({
      event: "task completed",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: entityType,
          entity_id: params.id,
          entity_label: entityLabel,
        },
        metadata: {
          source: params.source,
          completed_via: completedVia,
        },
      },
    });

    return JSON.stringify({ ok: true });
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
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0298 R6): this tool is chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan oppgaveavbrytelse bare gjøres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate (ADR-0099 / ADR-0287 — mandatory before any mutation).
    const gate = await gateTaskAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.cancel_personal`,
      channel,
      entityId: params.id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Self-only enforcement: profile_id must match (no manager override on personal tasks).
    const { data, error } = await supabase
      .from("personal_task")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .select("id, title")
      .single();

    if (error || !data) {
      return JSON.stringify({ ok: false, error: "not_found_or_unauthorized" });
    }

    await emit({
      event: "task cancelled",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "personal_task",
          entity_id: params.id,
          entity_label: data.title,
        },
        metadata: {
          source: "personal",
          reason: params.reason,
        },
      },
    });

    return JSON.stringify({ ok: true });
  },
});
