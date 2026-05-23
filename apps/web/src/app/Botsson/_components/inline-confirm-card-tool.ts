"use client";

/**
 * inline-confirm-card-tool — BotssonChat-fixed client-tool for show_proposal_card.
 *
 * Why this is BotssonChat-fixed, NOT page-scoped (L-0331 + ADR-0398 §Registration):
 *   show_proposal_card must be available on EVERY chat surface regardless of which page
 *   hosts BotssonChat. Page tools (useRegisteredTools / useRegisterTools) are page-keyed
 *   and unmount when the user navigates. InlineConfirmCard is a shell-level primitive.
 *
 * Two exports:
 *   showProposalCardDefinition — ClientToolDefinition sent to stage-engine so the LLM
 *     knows the tool exists. Surface-constrained to chat+web (compose-verb, ADR-0399).
 *   makeShowProposalCardImpl   — factory that returns a ClientToolImplementation which
 *     renders the card and awaits user resolution. Call-site: BotssonChat.tsx.
 *
 * Import strategy (avoid @smartout/ai dist-not-built resolution error):
 *   - ClientToolDefinition + ClientToolImplementation → @smartout/agent-sdk (uses src/)
 *   - InlineConfirmCardDescriptor + InlineConfirmCardResult → @smartout/ui (uses src/)
 *   - Descriptor validation: lightweight type-guard inline (no Zod import needed here;
 *     full Zod parse happens server-side in the capability tool body).
 *
 * Telemetry contract (ADR-0134 + ADR-0398 §Telemetry):
 *   - inline_confirm_card.shown      → emitted server-side in publish-announcement.ts (T3)
 *   - inline_confirm_card.confirmed  → emitted server-side in publish-announcement.ts (T3)
 *   - inline_confirm_card.cancelled  → emitted HERE (browser-side, proxied to /api/telemetry)
 *   - inline_confirm_card.edited     → emitted HERE (browser-side, proxied to /api/telemetry)
 *
 * References: ADR-0078 (channel pinning), ADR-0327 (roundtrip protocol), ADR-0398 (HITL
 * primitive), ADR-0399 (surface constraints), L-0331 (fixed-tier sub-pattern).
 */

import type { ClientToolDefinition, ClientToolImplementation } from "@smartout/agent-sdk";
import type { InlineConfirmCardDescriptor, InlineConfirmCardResult } from "@smartout/ui";
import { emit, nonEmpty } from "@smartout/telemetry";

// ── Lightweight descriptor type-guard ────────────────────────────────────────
// Full Zod validation (InlineConfirmCardDescriptorSchema.safeParse) runs server-side in
// the capability tool body. Client-side we do a structural check sufficient to protect
// against malformed LLM output before passing to the UI component.
// Matches the discriminator field (type === "inline_confirm_card") + required fields.
function isValidDescriptor(value: unknown): value is InlineConfirmCardDescriptor {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v["type"] === "inline_confirm_card" &&
    typeof v["proposal_id"] === "string" &&
    v["proposal_id"].length > 0 &&
    typeof v["surface"] === "string" &&
    typeof v["draft"] === "object" &&
    typeof v["preview"] === "object" &&
    v["preview"] !== null &&
    typeof (v["preview"] as Record<string, unknown>)["title"] === "string" &&
    Array.isArray(v["actions"]) &&
    (v["actions"] as unknown[]).length >= 2
  );
}

// ── Definition (sent to stage-engine; LLM discovers it) ─────────────────────
//
// Surface constraints per ADR-0399: channel_constraint=["chat"] because InlineConfirmCard
// is a compose-verb affordance (visual card rendering — voice can never display it).
// platforms=["web"] — mobile Phase 2 will use native RN rendering via a separate ADR.
// NOTE: this definition does NOT appear in BotssonTools.ts (which is for voice/arena tools).
// It is registered via BotssonChat's fixed-primitives record ONLY.

// showProposalCardDefinition typed as ClientToolDefinition (agent-sdk shape).
// surfaceConstraints (ADR-0399) is spread in as an extra field — agent-sdk's type predates
// ADR-0399, but stage-engine reads the field via the harness/types.ClientToolDefinition shape.
// Structural typing ensures compatibility; stage-engine strips unknown fields gracefully.
export const showProposalCardDefinition: ClientToolDefinition & {
  surfaceConstraints?: { channel_constraint: string[]; platforms: string[] };
} = {
  temporaryTool: {
    modelToolName: "show_proposal_card",
    description:
      "Render an inline confirm card in the chat surface showing a mutation draft with three action buttons: " +
      "Bekreft (confirm), Endre (edit), Avbryt (cancel). " +
      "The user resolves the card by clicking one of the buttons. " +
      'Returns JSON: {proposal_id, action:"confirm"|"edit"|"cancel", patch?}. ' +
      "USAGE: call this tool immediately after ANY capability tool returns " +
      '{phase:"draft", proposal_id, ...}. Do NOT verbalize the draft — let the card speak. ' +
      'Required fields: type="inline_confirm_card", proposal_id (UUID from draft response), ' +
      'surface ("announcement"|"message"|"shift_approve"), draft (opaque payload), ' +
      'preview.title, actions (at minimum [{id:"confirm",...},{id:"cancel",...}]).',
    dynamicParameters: [
      {
        name: "type",
        location: "PARAMETER_LOCATION_BODY",
        required: true,
        schema: {
          type: "string",
          enum: ["inline_confirm_card"],
          description: 'Must be exactly "inline_confirm_card"',
        },
      },
      {
        name: "proposal_id",
        location: "PARAMETER_LOCATION_BODY",
        required: true,
        schema: {
          type: "string",
          description:
            "UUID from the capability tool draft response (= future p_client_message_id)",
        },
      },
      {
        name: "surface",
        location: "PARAMETER_LOCATION_BODY",
        required: true,
        schema: {
          type: "string",
          enum: ["announcement", "message", "shift_approve"],
          description: "Which mutation domain: announcement | message | shift_approve",
        },
      },
      {
        name: "draft",
        location: "PARAMETER_LOCATION_BODY",
        required: true,
        schema: {
          type: "object",
          description: "Tool-specific draft payload (opaque to UI — passed back on confirm/edit)",
        },
      },
      {
        name: "preview",
        location: "PARAMETER_LOCATION_BODY",
        required: true,
        schema: {
          type: "object",
          description:
            "UI preview fields: {title, body_excerpt?, recipient_count?, affected_entity?, metadata:[]}",
          properties: {
            title: { type: "string" },
            body_excerpt: { type: "string" },
            recipient_count: { type: "number" },
            affected_entity: { type: "string" },
            metadata: { type: "array" },
          },
        },
      },
      {
        name: "actions",
        location: "PARAMETER_LOCATION_BODY",
        required: true,
        schema: {
          type: "array",
          description:
            "Action objects. confirm+cancel are mandatory. " +
            'Example: [{id:"confirm",label:"Bekreft",variant:"primary"},{id:"cancel",label:"Avbryt",variant:"destructive"}]',
        },
      },
      {
        name: "voice_prompt",
        location: "PARAMETER_LOCATION_BODY",
        required: false,
        schema: {
          type: "string",
          description: "Server-controlled voice fallback copy (no client-side interpolation)",
        },
      },
      {
        name: "recipient_preview_available",
        location: "PARAMETER_LOCATION_BODY",
        required: false,
        schema: {
          type: "boolean",
          description: "Whether the recipient chip is interactive (drills into recipient list)",
        },
      },
    ],
    client: {},
  },
  // ADR-0399: compose-verb — chat only, web only. Voice MUST NOT receive card descriptors.
  surfaceConstraints: {
    channel_constraint: ["chat"],
    platforms: ["web"],
  },
};

// ── Implementation factory ────────────────────────────────────────────────────
//
// pushCard is provided by BotssonChat.tsx — it injects the card into the message stream
// and returns a Promise that resolves when the user clicks a button.

export function makeShowProposalCardImpl({
  pushCard,
  workspaceId,
  actorId,
}: {
  /** Inject descriptor into message stream; resolves when user picks an action. */
  pushCard: (descriptor: InlineConfirmCardDescriptor) => Promise<InlineConfirmCardResult>;
  /** Workspace ID for telemetry. Must be non-empty (ADR-0193). */
  workspaceId: string;
  /** Actor ID (profile_id) for telemetry. Must be non-empty (ADR-0193). */
  actorId: string;
}): ClientToolImplementation {
  return async (args: Record<string, unknown>): Promise<string> => {
    // Validate descriptor — lightweight structural guard (full Zod parse runs server-side).
    if (!isValidDescriptor(args)) {
      return JSON.stringify({
        error: "Invalid InlineConfirmCardDescriptor: missing required fields",
        is_error: true,
      });
    }
    const descriptor = args;

    // Render card and await user resolution.
    // pushCard never throws — BotssonChat.tsx handles rejection.
    const result = await pushCard(descriptor);

    // Telemetry for browser-side resolution events (cancelled + edited).
    // shown + confirmed fire server-side in publish-announcement.ts (T3, per ADR-0398).
    if (result.action === "cancel") {
      void emit({
        event: "inline_confirm_card.cancelled",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          surface: descriptor.surface,
          proposal_id: descriptor.proposal_id,
        },
      });
    } else if (result.action === "edit") {
      void emit({
        event: "inline_confirm_card.edited",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          surface: descriptor.surface,
          proposal_id: descriptor.proposal_id,
          // Count whitelisted editable_fields present in the patch (ADR-0398 §resume-payload)
          edited_field_count: Object.keys(result.patch ?? {}).length,
        },
      });
    }
    // action === "confirm": shown + confirmed fire server-side (T3). Nothing to emit here.

    return JSON.stringify(result);
  };
}
