/**
 * Bootstrap capability tools — ADR-0407 Phase 1.
 *
 * Three tools managing workspace bootstrap gate lifecycle:
 *
 * Read surface:
 *   list_bootstrap_gates — fn_list_open_bootstrap_gates RPC; chat + voice
 *
 * Write surface (SECURITY DEFINER RPCs, admin-only):
 *   close_bootstrap_gate — mark a gate closed via fn_close_bootstrap_gate
 *   skip_bootstrap_gate  — mark an optional gate skipped via fn_skip_bootstrap_gate
 *
 * Authority model (ADR-0407 + ADR-0204 gatedMutation):
 *   list_bootstrap_gates  — ungated read (read_only, admin+)
 *   close_bootstrap_gate  — gated suggest, admin+
 *   skip_bootstrap_gate   — gated suggest, admin+ (required gates blocked at RPC)
 *
 * Identity (ADR-0151): workspace_id + profile_id ALWAYS server-derived from
 * AgentToolContext. No tool parameter accepts workspace_id / profile_id.
 * Schema uses .strict() (L-0237) to forbid forgeable identity fields in body.
 *
 * Telemetry:
 *   bootstrap.gates_listed  — activity_trail only (no PostHog — read operation)
 *   bootstrap.gate_closed   — PostHog + activity_trail + engine_event
 *   bootstrap.gate_skipped  — PostHog + activity_trail + engine_event
 *
 * L-0292 fix: capability registered → intent enum entry in same commit (ADR-0112).
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateBootstrapAction } from "./gate.js";

const CAPABILITY = "bootstrap" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Zod primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Gate slug — e.g. 'departments_exist', 'owner_contract_active'. */
const GateSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .describe("Bootstrap gate slug, e.g. 'departments_exist', 'regulatory_framework_bound'");

/** closed_via enum — who/how the gate was closed. */
const ClosedViaSchema = z
  .enum(["botsson", "manual_wizard", "auto", "admin_skip"])
  .describe(
    "How the gate was closed: 'botsson' (AI-guided), 'manual_wizard' (admin via wizard), " +
      "'auto' (system detected completion), 'admin_skip' (skipped by admin).",
  );

/** Skip reason — required, non-empty. */
const SkipReasonSchema = z
  .string()
  .min(1)
  .max(500)
  .describe("Why this gate is being skipped. Required and logged to audit trail.");

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1 — bootstrap.list_bootstrap_gates
// Channels: chat + voice (no free-text input, no PII risk, read-only)
// Gate: ungated read (fn_list_open_bootstrap_gates enforces auth internally)
// ─────────────────────────────────────────────────────────────────────────────

export const listBootstrapGates = defineTool({
  name: "list_bootstrap_gates",
  description:
    "Hent alle åpne bootstrap-porter for workspace. Returnerer porter med status " +
    "'open', 'in_progress' eller 'blocked', sortert etter prioritet og anbefalt dag. " +
    "Bruk når admin spør 'hva gjenstår av oppsett', 'vis bootstrap-sjekklisten', " +
    "'er workspace-konfigurasjonen komplett', 'hva må jeg sette opp?'. " +
    "Kaller fn_list_open_bootstrap_gates RPC. Admin+ påkrevd.",
  capability: CAPABILITY,
  schema: z.object({}).strict(),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data, error } = await supabase.rpc("fn_list_open_bootstrap_gates", {
      p_workspace_id: ctx.workspaceId,
    });

    if (error) {
      return JSON.stringify({ ok: false, error: error.message });
    }

    const gates = data ?? [];

    // Emit read telemetry (activity_trail only — no PostHog for reads)
    await emit({
      event: "bootstrap.gates_listed",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace_bootstrap_gate",
          entity_id: ctx.workspaceId,
          entity_label: "bootstrap_gates_read",
        },
        metadata: {
          open_gate_count: gates.length,
        },
      },
    });

    if (gates.length === 0) {
      return "Alle bootstrap-porter er lukket. Workspace er fullt konfigurert.";
    }

    return JSON.stringify({ gates });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2 — bootstrap.close_bootstrap_gate
// Channels: chat + voice (no free-text risk — only slugs + enum values)
// Gate: gated suggest, admin+
// Writes via: fn_close_bootstrap_gate SECURITY DEFINER RPC
// ─────────────────────────────────────────────────────────────────────────────

export const closeBootstrapGate = defineTool({
  name: "close_bootstrap_gate",
  description:
    "Merk en bootstrap-port som fullført (lukket). " +
    "Bruk når admin sier 'avdelinger er opprettet', 'kontrakten er signert', " +
    "'rammeverket er valgt', 'lukk porten for [gate_slug]'. " +
    "Kaller fn_close_bootstrap_gate SECURITY DEFINER RPC. Admin+ påkrevd. " +
    "profile_id utledes server-side fra AgentToolContext (ADR-0151). " +
    "Tilgjengelig på chat og stemme.",
  capability: CAPABILITY,
  schema: z
    .object({
      gate_slug: GateSlugSchema,
      via: ClosedViaSchema,
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate (ADR-0204 gatedMutation / ADR-0287 mandatory on mutations)
    const gate = await gateBootstrapAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.close_bootstrap_gate`,
      channel,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // profile_id derived server-side from ctx (ADR-0151 — never from request body)
    const { data: gateId, error } = await supabase.rpc("fn_close_bootstrap_gate", {
      p_workspace_id: ctx.workspaceId,
      p_gate_slug: params.gate_slug,
      p_via: params.via,
      p_profile_id: ctx.profileId,
    });

    if (error) {
      return JSON.stringify({ ok: false, error: error.message });
    }

    await emit({
      event: "bootstrap.gate_closed",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace_bootstrap_gate",
          entity_id: (gateId as string) ?? params.gate_slug,
          entity_label: params.gate_slug,
        },
        metadata: {
          gate_slug: params.gate_slug,
          closed_via: params.via,
          gate_evaluation_id: gate.gateEvaluationId ?? undefined,
        },
      },
    });

    return JSON.stringify({ ok: true, gate_id: gateId, gate_slug: params.gate_slug });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3 — bootstrap.skip_bootstrap_gate
// Channels: chat-only (skip reason may contain rationale — free text, V1 policy)
// Gate: gated suggest, admin+
// Writes via: fn_skip_bootstrap_gate SECURITY DEFINER RPC
// Note: required gates are blocked at the RPC level (data integrity)
// ─────────────────────────────────────────────────────────────────────────────

export const skipBootstrapGate = defineTool({
  name: "skip_bootstrap_gate",
  description:
    "Hopp over en valgfri bootstrap-port med begrunnelse. " +
    "Bruk når admin sier 'vi trenger ikke Mattilsynet-rutiner', " +
    "'vi selger ikke alkohol — hopp over alkohol-portene', " +
    "'skip porten for [gate_slug]'. " +
    "Kun tilgjengelig i chat (fri tekst i reason). " +
    "Krever admin+ tilgangsnivå. Required-porter KAN IKKE hoppes over (blokkert i RPC). " +
    "profile_id utledes server-side fra AgentToolContext (ADR-0151).",
  capability: CAPABILITY,
  schema: z
    .object({
      gate_slug: GateSlugSchema,
      reason: SkipReasonSchema,
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard: skip reason is free text — chat-only V1
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan porter bare hoppes over i chat, ikke via stemme (V1-policy). Skriv begrunnelsen i chat.";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // C4 authority gate (ADR-0204 gatedMutation / ADR-0287 mandatory on mutations)
    const gate = await gateBootstrapAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.skip_bootstrap_gate`,
      channel,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // profile_id derived server-side from ctx (ADR-0151 — never from request body)
    const { data: gateId, error } = await supabase.rpc("fn_skip_bootstrap_gate", {
      p_workspace_id: ctx.workspaceId,
      p_gate_slug: params.gate_slug,
      p_reason: params.reason,
      p_profile_id: ctx.profileId,
    });

    if (error) {
      // Required gate skip attempted — surface the RPC error clearly
      return JSON.stringify({ ok: false, error: error.message });
    }

    await emit({
      event: "bootstrap.gate_skipped",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace_bootstrap_gate",
          entity_id: (gateId as string) ?? params.gate_slug,
          entity_label: params.gate_slug,
        },
        metadata: {
          gate_slug: params.gate_slug,
          skip_reason: params.reason,
          gate_evaluation_id: gate.gateEvaluationId ?? undefined,
        },
      },
    });

    return JSON.stringify({ ok: true, gate_id: gateId, gate_slug: params.gate_slug });
  },
});
