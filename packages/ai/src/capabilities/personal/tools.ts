/**
 * Personal capability tools — five everyday-utility tools for Mr. Botsson.
 * (feat/botsson-personal-tools)
 *
 * Tools:
 *   add_note       — quick capture → engine_memory (memory_type='general', scope='personal')
 *   create_task    — personal todo → personal_task table (new, see migration)
 *   set_reminder   — alarm at a time → engine_delayed_trigger
 *   get_history    — recent activity → activity_trail (actor_id = profileId)
 *   update_setting — per-profile preference → engine_memory (memory_type='preference')
 *
 * Schema decisions:
 *   add_note: engine_memory with memory_type='general'. Existing table, no migration.
 *     Could use 'note' but that is not in the constraint set. 'general' is the closest.
 *     NOTE: add_note bypasses the save_memory gate (which is the "memory" capability gate).
 *     It writes directly as service_role. This is intentional — the personal capability
 *     has its own gate seeded in the migration.
 *
 *   create_task: NEW personal_task table (20260520100000_personal_task.sql).
 *     session_task is D6 ops-facing; engine_state_step tracks process steps.
 *     Neither has due_at / priority / status lifecycle. New table is correct.
 *
 *   set_reminder: engine_delayed_trigger table. ADR-0163 reuse pattern.
 *     trigger_id and event_id are required FKs — we INSERT a synthetic engine_event
 *     first to hold the reminder payload, then a stub trigger row, then the trigger row.
 *     The fire-delayed-triggers Edge Function polls this table.
 *     Implementation note: trigger_id FK on engine_delayed_trigger requires a real
 *     engine_trigger row. We create a stub row per reminder rather than share one
 *     per workspace — simpler isolation. The stub trigger has no engine_process binding
 *     (engine_trigger.process_id nullable per schema).
 *
 *   get_history: activity_trail filtered by actor_id = profileId. Read-only. No gate.
 *
 *   update_setting: engine_memory with memory_type='preference', scope='personal'.
 *     profile.preferences JSONB does not exist (verified: no migration adds it).
 *     engine_authority_config is workspace+capability keyed — wrong shape for per-profile
 *     key/value prefs. engine_memory is correct: it already stores preferences, is
 *     profile-scoped, and feeds back into the system prompt automatically via
 *     collectContext(). Key is embedded in the content string ("Innstilling: {key}={value}").
 *
 * Authority: all mutations call gate_action (ADR-0099 / L-0066).
 *   Read-only (get_history) is ungated — reads from activity_trail are safe.
 *
 * Channels: chat + voice for all tools.
 *   No PII in these tools (no bank/personnummer/salary data) → no channel restriction.
 *
 * Telemetry: all five tools emit. Mutations → posthog + activity_trail.
 *   get_history → posthog + logger (read-only).
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";

const CAPABILITY = "personal" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ── add_note ─────────────────────────────────────────────────────────────────

export const addNote = defineTool({
  name: "add_note",
  description:
    "Lagre et raskt notat. Bruk når brukeren sier 'noter', 'skriv ned', 'husk dette', 'notat'. " +
    "Tags er valgfrie nøkkelord som gjør notatet lettere å finne.",
  capability: CAPABILITY,
  schema: z.object({
    text: z
      .string()
      .min(1)
      .max(2000)
      .describe("Notatets innhold, i brukerens egne ord. Norsk foretrukket."),
    tags: z
      .array(z.string().max(50))
      .max(10)
      .optional()
      .describe("Valgfrie emneord, f.eks. ['møte', 'viktig']."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    // Gate check before write (ADR-0099).
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "write",
      entityId: ctx.profileId,
    });
    if (!gate.allow) {
      return `Notatet ble ikke lagret: ${gate.reason ?? "ikke tillatt"}.`;
    }

    // Persist as engine_memory (memory_type='general', scope='personal').
    // Tags embedded in content so they surface in semantic search.
    const tagSuffix =
      params.tags && params.tags.length > 0 ? ` [tags: ${params.tags.join(", ")}]` : "";
    const content = `${params.text}${tagSuffix}`;

    const { data, error } = await ctx.supabaseAdmin
      .from("engine_memory")
      .insert({
        profile_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        memory_type: "general",
        content,
        source_session_id: ctx.sessionId || null,
      })
      .select("id")
      .single();

    if (error) return `Feil ved lagring av notat: ${error.message}`;

    await emit({
      event: "personal.note_added",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "agent_session",
          entity_id: data.id,
          entity_label: params.text.slice(0, 60),
        },
        data: { tags: params.tags ?? [] },
      },
    });

    return `Notatet er lagret${params.tags && params.tags.length > 0 ? ` med tags: ${params.tags.join(", ")}` : ""}.`;
  },
});

// ── create_task ───────────────────────────────────────────────────────────────

export const createTask = defineTool({
  name: "create_task",
  description:
    "Lag en personlig oppgave med valgfri frist og prioritet. " +
    "Bruk når brukeren sier 'gjør X i morgen', 'minn meg om Y', 'jeg må huske å Z', " +
    "'legg til oppgave', 'ny oppgave'. " +
    "fire_at for påminnelser — bruk set_reminder i stedet om brukeren vil ha en varsling på et bestemt tidspunkt.",
  capability: CAPABILITY,
  schema: z.object({
    title: z
      .string()
      .min(1)
      .max(500)
      .describe("Oppgavetittel — kort og handlingsorientert, f.eks. 'Bestill forklær til lager'."),
    due_at: z
      .string()
      .optional()
      .describe("Valgfri frist i ISO-8601 format, f.eks. '2026-05-22T12:00:00+02:00'."),
    priority: z
      .enum(["low", "normal", "high", "urgent"])
      .default("normal")
      .describe("Prioritet: low (lav), normal, high (høy), urgent (haster)."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "write",
      entityId: ctx.profileId,
    });
    if (!gate.allow) {
      return `Oppgaven ble ikke opprettet: ${gate.reason ?? "ikke tillatt"}.`;
    }

    const { data, error } = await ctx.supabaseAdmin
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

    if (error) return `Feil ved opprettelse av oppgave: ${error.message}`;

    await emit({
      event: "personal.task_created",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "personal_task",
          entity_id: data.id,
          entity_label: params.title,
        },
        data: {
          title: params.title,
          priority: params.priority,
          has_due_at: params.due_at != null,
        },
      },
    });

    // Build a human-readable confirmation the TTS can read aloud.
    const dueMsg = params.due_at
      ? ` med frist ${new Date(params.due_at).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}`
      : "";
    const prioMsg = params.priority !== "normal" ? ` (${params.priority})` : "";

    return `Oppgave opprettet: "${params.title}"${dueMsg}${prioMsg}.`;
  },
});

// ── set_reminder ──────────────────────────────────────────────────────────────

export const setReminder = defineTool({
  name: "set_reminder",
  description:
    "Sett en påminnelse til et bestemt tidspunkt. " +
    "Bruk når brukeren sier 'minn meg klokken X', 'om en time', 'minn meg i morgen tidlig'. " +
    "Skiller seg fra create_task ved at påminnelsen utløser en varsling — ikke bare oppretter en oppgave.",
  capability: CAPABILITY,
  schema: z.object({
    text: z
      .string()
      .min(1)
      .max(500)
      .describe("Hva brukeren skal minnes på, f.eks. 'Ring leverandøren om bestillingen'."),
    fire_at: z
      .string()
      .describe(
        "Tidspunkt for varslingen i ISO-8601 format, f.eks. '2026-05-20T09:00:00+02:00'. " +
          "Regn ut absolutt tidspunkt fra relative uttrykk ('om en time', 'i morgen kl 08').",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "write",
      entityId: ctx.profileId,
    });
    if (!gate.allow) {
      return `Påminnelsen ble ikke satt: ${gate.reason ?? "ikke tillatt"}.`;
    }

    // engine_delayed_trigger requires both trigger_id and event_id FKs.
    // Pattern: insert a synthetic engine_event first (idempotency_key ensures
    // deduplication if this exact reminder is re-created), then create a stub
    // engine_trigger row (no process binding), then the delayed trigger row.

    // Step 1: insert a synthetic engine_event row to anchor the reminder payload.
    const idempotencyKey = `reminder:${ctx.profileId}:${params.fire_at}:${params.text.slice(0, 30)}`;
    const { data: eventRow, error: eventError } = await ctx.supabaseAdmin
      .from("engine_event")
      .insert({
        workspace_id: ctx.workspaceId,
        event_type: "personal.reminder",
        payload: {
          profile_id: ctx.profileId,
          text: params.text,
          fire_at: params.fire_at,
        },
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (eventError) {
      // Duplicate idempotency key means an identical reminder already exists.
      if (eventError.code === "23505") {
        return `En identisk påminnelse finnes allerede for det tidspunktet.`;
      }
      return `Feil ved opprettelse av hendelse for påminnelse: ${eventError.message}`;
    }

    // Step 2: stub engine_trigger row (event_type match, no process binding).
    const { data: triggerRow, error: triggerError } = await ctx.supabaseAdmin
      .from("engine_trigger")
      .insert({
        workspace_id: ctx.workspaceId,
        event_type: "personal.reminder",
        // process_id is nullable in engine_trigger (no mandatory FK to engine_process).
      })
      .select("id")
      .single();

    if (triggerError)
      return `Feil ved opprettelse av trigger for påminnelse: ${triggerError.message}`;

    // Step 3: engine_delayed_trigger row — fire-delayed-triggers Edge Function polls this.
    const { data: delayedRow, error: delayedError } = await ctx.supabaseAdmin
      .from("engine_delayed_trigger")
      .insert({
        trigger_id: triggerRow.id,
        event_id: eventRow.id,
        workspace_id: ctx.workspaceId,
        fire_at: params.fire_at,
        fired: false,
      })
      .select("id")
      .single();

    if (delayedError) return `Feil ved oppretting av forsinket trigger: ${delayedError.message}`;

    await emit({
      event: "personal.reminder_set",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "agent_session",
          entity_id: delayedRow.id,
          entity_label: params.text.slice(0, 60),
        },
        data: { fire_at: params.fire_at },
      },
    });

    const fireDate = new Date(params.fire_at);
    const formattedTime = fireDate.toLocaleString("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `Påminnelse satt: "${params.text}" — varsler deg ${formattedTime}.`;
  },
});

// ── get_history ───────────────────────────────────────────────────────────────

export const getHistory = defineTool({
  name: "get_history",
  description:
    "Hent brukerens siste hendelser fra aktivitetsoversikten. " +
    "Bruk når brukeren sier 'hva har jeg gjort', 'mine siste handlinger', " +
    "'hva skjedde tidligere', 'vis min aktivitet', 'siste hendelser'.",
  capability: CAPABILITY,
  schema: z.object({
    category: z
      .string()
      .optional()
      .describe(
        "Valgfritt: filtrer på hendelseskategori, f.eks. 'scheduling', 'training', 'contracts'.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Antall hendelser å hente. Standard 10, maks 50."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Read-only — no gate check required. activity_trail is an audit log.
    let query = ctx.supabaseAdmin
      .from("activity_trail")
      .select("id, event, action_verb, category, entity_type, entity_label, created_at, data")
      .eq("workspace_id", ctx.workspaceId)
      .eq("actor_id", ctx.profileId)
      .order("created_at", { ascending: false })
      .limit(params.limit);

    if (params.category) {
      query = query.eq("category", params.category);
    }

    const { data, error } = await query;
    if (error) return `Feil ved henting av historikk: ${error.message}`;
    if (!data || data.length === 0) return "Ingen hendelser funnet.";

    // Emit as read telemetry (posthog + logger only per registry).
    void emit({
      event: "personal.history_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: { category: params.category ?? null, limit: params.limit },
      },
    });

    return JSON.stringify(data);
  },
});

// ── update_setting ────────────────────────────────────────────────────────────

export const updateSetting = defineTool({
  name: "update_setting",
  description:
    "Oppdater en personlig innstilling eller preferanse. " +
    "Bruk når brukeren sier 'sett min preferanse', 'endre min [innstilling]', " +
    "'jeg foretrekker', 'sett standard [X] til [Y]'. " +
    "Innstillinger lagres som preferanseminner og leses automatisk av agenten neste gang.",
  capability: CAPABILITY,
  schema: z.object({
    key: z
      .string()
      .min(1)
      .max(100)
      .describe(
        "Innstillingsnøkkelen, f.eks. 'foretrukket_vakttype', 'foretrukket_avdeling', 'tiltaleform'.",
      ),
    value: z
      .string()
      .min(1)
      .max(500)
      .describe("Ny verdi for innstillingen, f.eks. 'kveldsvakt', 'kjøkken', 'du'."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "write",
      entityId: ctx.profileId,
    });
    if (!gate.allow) {
      return `Innstillingen ble ikke oppdatert: ${gate.reason ?? "ikke tillatt"}.`;
    }

    // Store as engine_memory preference. The content format "Innstilling: {key}={value}"
    // is intentional — semantic search and the system prompt injection pipeline read this
    // verbatim. Future callers should be aware of this encoding.
    //
    // We upsert by deleting any existing preference with the same key first, then inserting.
    // engine_memory has no unique constraint on (profile_id, memory_type, content prefix)
    // so we do a soft-delete by expiring the old row(s) before inserting the new one.
    const contentPattern = `Innstilling: ${params.key}=`;

    // Expire previous values for this key so they drop out of context injection.
    await ctx.supabaseAdmin
      .from("engine_memory")
      .update({ expires_at: new Date().toISOString() })
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "preference")
      .like("content", `${contentPattern}%`);

    const content = `${contentPattern}${params.value}`;

    const { data, error } = await ctx.supabaseAdmin
      .from("engine_memory")
      .insert({
        profile_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        memory_type: "preference",
        content,
        source_session_id: ctx.sessionId || null,
      })
      .select("id")
      .single();

    if (error) return `Feil ved oppdatering av innstilling: ${error.message}`;

    await emit({
      event: "personal.setting_updated",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "agent_session",
          entity_id: data.id,
          entity_label: `${params.key}=${params.value}`,
        },
        data: { key: params.key },
      },
    });

    return `Innstilling oppdatert: ${params.key} er nå satt til "${params.value}".`;
  },
});
