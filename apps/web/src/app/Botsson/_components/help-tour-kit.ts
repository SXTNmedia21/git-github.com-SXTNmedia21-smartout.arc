"use client";

// ============================================
// help-tour-kit.ts
// Returns a ClientToolKit with two UI tools for the /dashboard/help page tour.
// Why: Emma needs tool handles to scroll/highlight page sections when guiding a
// user through the Help Hub — voice or chat can invoke `ui.navigate_to` and
// `ui.highlight_element` to surface the right tier without the user having to
// scroll manually.
// ============================================

import { useMemo } from "react";
import type {
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "@smartout/agent-sdk";
import { isValidAnchor } from "@/app/dashboard/help/_lib/tour-anchors";
import type { TourAnchor } from "@/app/dashboard/help/_lib/tour-anchors";
import { emit, nonEmpty } from "@smartout/telemetry";

/* ━━━ Anchor enum string for Zod description / param spec ━━━━━━━━━━━━━━━━━━ */
// Kept as a plain string list so the definition can be serialised to JSON
// without pulling in Zod at the provider boundary (Ultravox / LiveKit both
// expect raw JSON schema on their wire format).
const ANCHOR_VALUES = [
  "panic_bar",
  "chat_hero",
  "active_ticket_badge",
  "quick_paths",
  "curated_articles",
  "kontakt_footer",
] as const;

/* ━━━ Tool 1: ui.navigate_to ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const navigateToDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "ui.navigate_to",
    description:
      "Smooth-scroll the /dashboard/help page to a known anchor " +
      "(panic_bar, chat_hero, active_ticket_badge, quick_paths, curated_articles, kontakt_footer). " +
      "Returns ok+scrolled_to on success or ok=false+reason on failure.",
    dynamicParameters: [
      {
        name: "target_id",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "string",
          enum: [...ANCHOR_VALUES],
          description: "The anchor key identifying which section to scroll to.",
        },
        required: true,
      },
    ],
    client: {},
  },
};

/* ━━━ Tool 2: ui.highlight_element ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const highlightElementDef: ClientToolDefinition = {
  temporaryTool: {
    modelToolName: "ui.highlight_element",
    description:
      "Render an outline overlay and label badge on a known anchor on /dashboard/help. " +
      "Auto-dismisses after duration_ms (default 5000 ms). " +
      "Returns ok+highlighted on success or ok=false+reason on failure.",
    dynamicParameters: [
      {
        name: "target_id",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "string",
          enum: [...ANCHOR_VALUES],
          description: "The anchor key identifying which section to highlight.",
        },
        required: true,
      },
      {
        name: "label",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 80,
          description: "Short descriptive label shown in the overlay badge.",
        },
        required: true,
      },
      {
        name: "duration_ms",
        location: "PARAMETER_LOCATION_BODY" as const,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 15000,
          default: 5000,
          description: "How long the highlight stays visible in milliseconds (default 5000).",
        },
        required: false,
      },
    ],
    client: {},
  },
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export interface HelpTourKitOptions {
  workspaceId: string;
  actorId: string;
  /** Called by the implementation so the bridge can delegate to useHelpTour state. */
  onInvoke: (
    tool: "navigate_to" | "highlight_element",
    target_id: TourAnchor,
    opts?: { label: string; duration_ms: number },
  ) => void;
}

/**
 * Returns a stable ClientToolKit with two tools for the help page tour.
 * The implementations delegate all UI side-effects to `onInvoke` so the
 * actual scroll/highlight logic lives in useHelpTour (single source of truth).
 */
export function useHelpTourKit({
  workspaceId,
  actorId,
  onInvoke,
}: HelpTourKitOptions): ClientToolKit {
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const impl_navigate_to: ClientToolImplementation = (params) => {
    const target_id = params["target_id"] as string;

    if (!isValidAnchor(target_id)) {
      return JSON.stringify({ ok: false, reason: `Unknown anchor: ${target_id}` });
    }

    onInvoke("navigate_to", target_id);

    // Fire-and-forget telemetry — emit is async-safe in client context
    void emit({
      event: "help.tour_step_invoked",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      properties: {
        workspaceId: nonEmpty(workspaceId, "workspaceId"),
        actorId: nonEmpty(actorId, "actorId"),
        tool: "navigate_to",
        target_id,
        reduced_motion: reducedMotion,
      },
    });

    return JSON.stringify({ ok: true, scrolled_to: target_id });
  };

  const impl_highlight_element: ClientToolImplementation = (params) => {
    const target_id = params["target_id"] as string;
    const label = params["label"] as string;
    const duration_ms = typeof params["duration_ms"] === "number" ? params["duration_ms"] : 5000;

    if (!isValidAnchor(target_id)) {
      return JSON.stringify({ ok: false, reason: `Unknown anchor: ${target_id}` });
    }

    if (!label || label.trim().length === 0 || label.length > 80) {
      return JSON.stringify({ ok: false, reason: "label must be 1–80 characters" });
    }

    if (duration_ms < 1 || duration_ms > 15000) {
      return JSON.stringify({ ok: false, reason: "duration_ms must be 1–15000" });
    }

    onInvoke("highlight_element", target_id, { label: label.trim(), duration_ms });

    void emit({
      event: "help.tour_step_invoked",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      properties: {
        workspaceId: nonEmpty(workspaceId, "workspaceId"),
        actorId: nonEmpty(actorId, "actorId"),
        tool: "highlight_element",
        target_id,
        reduced_motion: reducedMotion,
      },
    });

    return JSON.stringify({ ok: true, highlighted: target_id });
  };

  return useMemo(
    () => ({
      definitions: [navigateToDef, highlightElementDef],
      implementations: {
        "ui.navigate_to": impl_navigate_to,
        "ui.highlight_element": impl_highlight_element,
      },
    }),
    [workspaceId, actorId, onInvoke],
  );
}
