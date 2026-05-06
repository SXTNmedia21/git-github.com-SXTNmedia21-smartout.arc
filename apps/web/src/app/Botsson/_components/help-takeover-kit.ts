"use client";

// ============================================
// help-takeover-kit.ts (M3.2 / ADR-0228)
//
// Three tools:
//   - ui.simulate_click — proposes a takeover click on an allow-listed target.
//     Tool returns immediately with ok+state='previewing' (sync) but does NOT
//     execute. The DOM action only fires after user confirms via TakeoverPreview
//     UI (handled by usePageTakeover hook). Fire-and-forget from Botsson's POV.
//   - ui.submit_form — v1 stub. Returns ok:false (no forms in v1 allow-list).
//   - ui.wait_for_state — observes a known DOM predicate. Read-only.
//
// All tools enforce ctx.channel === 'chat' at invocation. Voice channel
// returns voice_forbidden_for_takeover (extends ADR-0078 to mutation tools).
// ============================================

import { useMemo } from "react";
import type {
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "@smartout/agent-sdk";
import {
  TAKEOVER_TARGETS,
  WAIT_PREDICATES,
  isValidWaitPredicate,
} from "@/app/dashboard/help/_lib/takeover-targets";

const TAKEOVER_TARGET_VALUES = Object.keys(TAKEOVER_TARGETS) as Array<
  keyof typeof TAKEOVER_TARGETS
>;

const WAIT_PREDICATE_VALUES = Object.keys(WAIT_PREDICATES) as Array<keyof typeof WAIT_PREDICATES>;

const simulateClickDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "ui.simulate_click",
    description:
      "Propose a click on an allow-listed UI element on /dashboard/help. " +
      "ALWAYS shows a preview overlay with a 3-second confirm-delay BEFORE clicking. " +
      "User must confirm. ESC cancels. Returns ok+state='previewing' immediately " +
      "or ok=false+reason if denied (unknown target, authority disabled, voice channel). " +
      "Allow-listed targets: " +
      TAKEOVER_TARGET_VALUES.join(", "),
    dynamicParameters: [
      {
        name: "target_id",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "string",
          enum: [...TAKEOVER_TARGET_VALUES],
          description: "The allow-listed target_id to click after user confirms.",
        },
        required: true,
      },
    ],
    client: {},
  },
};

const submitFormDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "ui.submit_form",
    description:
      "STUB in v1 — no forms are allow-listed yet. Always returns ok=false " +
      "with reason='no_forms_in_v1_allowlist'. Future versions will let Botsson " +
      "fill + submit named forms via preview-confirm flow.",
    dynamicParameters: [
      {
        name: "form_id",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: { type: "string" },
        required: true,
      },
      {
        name: "field_values",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: { type: "object" },
        required: true,
      },
    ],
    client: {},
  },
};

const waitForStateDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "ui.wait_for_state",
    description:
      "Wait until a known DOM predicate is met on /dashboard/help. " +
      "Allow-listed predicates: " +
      WAIT_PREDICATE_VALUES.join(", ") +
      ". Returns ok+met=true+elapsed_ms when satisfied, ok+met=false+elapsed_ms on timeout. " +
      "Read-only — no mutation.",
    dynamicParameters: [
      {
        name: "predicate",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "string",
          enum: [...WAIT_PREDICATE_VALUES],
        },
        required: true,
      },
      {
        name: "timeout_ms",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "integer",
          minimum: 100,
          maximum: 30000,
          default: 5000,
        },
        required: false,
      },
    ],
    client: {},
  },
};

export interface HelpTakeoverKitOptions {
  workspaceId: string;
  actorId: string;
  channel: "chat" | "voice" | "system";
  /** Called by the implementation to delegate to usePageTakeover.proposeAction. */
  onPropose: (
    target_id: string,
  ) => Promise<
    { ok: true; target_id: string } | { ok: false; reason: string; user_message?: string }
  >;
}

export function useHelpTakeoverKit({
  workspaceId: _ws,
  actorId: _actor,
  channel,
  onPropose,
}: HelpTakeoverKitOptions): ClientToolKit {
  const impl_simulate_click: ClientToolImplementation = async (params) => {
    if (channel !== "chat") {
      return JSON.stringify({
        ok: false,
        reason: "voice_forbidden_for_takeover",
        user_message: "Bytt til chat for å gjøre dette.",
      });
    }
    const target_id = params["target_id"] as string;
    const result = await onPropose(target_id);
    if (!result.ok) {
      return JSON.stringify({
        ok: false,
        reason: result.reason,
        user_message: result.user_message ?? null,
      });
    }
    return JSON.stringify({
      ok: true,
      state: "previewing",
      target_id: result.target_id,
      message: "Preview shown. User has 3s minimum before confirm enables.",
    });
  };

  const impl_submit_form: ClientToolImplementation = () => {
    return JSON.stringify({
      ok: false,
      reason: "no_forms_in_v1_allowlist",
      user_message: "Ingen skjema er godkjent for takeover ennå.",
    });
  };

  const impl_wait_for_state: ClientToolImplementation = async (params) => {
    if (channel !== "chat") {
      return JSON.stringify({
        ok: false,
        reason: "voice_forbidden_for_takeover",
      });
    }
    const predicate = params["predicate"] as string;
    const timeout_ms = typeof params["timeout_ms"] === "number" ? params["timeout_ms"] : 5000;

    if (!isValidWaitPredicate(predicate)) {
      return JSON.stringify({ ok: false, reason: `Unknown predicate: ${predicate}` });
    }

    const spec = WAIT_PREDICATES[predicate];
    const start = Date.now();

    return new Promise<string>((resolve) => {
      const checkInterval = setInterval(() => {
        const el = document.querySelector(spec.selector);
        const elapsed = Date.now() - start;
        if (el) {
          clearInterval(checkInterval);
          resolve(JSON.stringify({ ok: true, met: true, elapsed_ms: elapsed }));
        } else if (elapsed >= timeout_ms) {
          clearInterval(checkInterval);
          resolve(JSON.stringify({ ok: true, met: false, elapsed_ms: elapsed }));
        }
      }, 100);
    });
  };

  return useMemo<ClientToolKit>(
    () => ({
      definitions: [simulateClickDef, submitFormDef, waitForStateDef],
      implementations: {
        "ui.simulate_click": impl_simulate_click,
        "ui.submit_form": impl_submit_form,
        "ui.wait_for_state": impl_wait_for_state,
      },
    }),
    [_ws, _actor, channel, onPropose],
  );
}
