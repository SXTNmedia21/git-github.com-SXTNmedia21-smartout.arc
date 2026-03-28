// apps/web/src/lib/wizard-tools/shared.ts
"use client";

/**
 * Shared helpers for wizard tool builders.
 *
 * All wizard tools use refs to avoid stale closures — useRegisterTools
 * compares tool names (not implementations) to skip re-registration,
 * so closures captured at registration time would go stale.
 *
 * Every mutating tool emits "agent tool_called" telemetry.
 */

import { useRef, useEffect, useMemo } from "react";
import { emit } from "@smartout/telemetry";
import type {
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "@smartout/agent-sdk";

// ─── Ref helpers ──────────────────────────────────────────

/** Keep a ref synced with a value. Returns the ref. */
export function useSyncRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

// ─── Telemetry helper ─────────────────────────────────────

export function emitToolInvoked(
  wizardId: string,
  stepId: string,
  toolName: string,
  workspaceId: string,
  actorId: string,
) {
  void emit({
    event: "agent tool_called" as const,
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "workspace" as const, entity_id: workspaceId },
      data: { tool_name: toolName, capability: "wizard", success: true },
    },
  });
}

// ─── Navigation tool definitions ──────────────────────────

/** Standard navigation tool definitions shared by every wizard step. */
export const NAV_TOOL_DEFINITIONS: ClientToolDefinition[] = [
  {
    temporaryTool: {
      modelToolName: "advance_to_next_step",
      description:
        "Move to the next wizard step. Runs validation first — returns error if validation fails.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "go_back",
      description: "Go back to the previous wizard step.",
      dynamicParameters: [],
      client: {},
    },
  },
];

/**
 * Build navigation tool implementations using refs to next/back.
 * Call this inside useMemo with empty deps — refs handle freshness.
 */
export function buildNavImplementations(
  nextRef: React.RefObject<(() => void | Promise<void>) | undefined>,
  backRef: React.RefObject<(() => void) | undefined>,
): Record<string, ClientToolImplementation> {
  return {
    advance_to_next_step: async () => {
      try {
        await nextRef.current?.();
        return "Advanced to next step successfully.";
      } catch {
        return "Cannot advance: validation errors on current step. Ask the user to review the highlighted fields.";
      }
    },
    go_back: () => {
      backRef.current?.();
      return "Moved back to the previous step.";
    },
  };
}

// ─── Tool kit builder ─────────────────────────────────────

/**
 * Merge step-specific tools with navigation tools into a single toolkit.
 * Returns a stable reference (useMemo with empty deps).
 *
 * CONSTRAINT: Tool definitions must be static per step. Dynamic tool
 * lists (add/remove tools based on state) require a different pattern.
 */
export function useWizardToolKit(
  stepDefinitions: ClientToolDefinition[],
  stepImplementations: Record<string, ClientToolImplementation>,
  nextRef: React.RefObject<(() => void | Promise<void>) | undefined>,
  backRef: React.RefObject<(() => void) | undefined>,
): ClientToolKit {
  return useMemo(
    () => ({
      definitions: [...stepDefinitions, ...NAV_TOOL_DEFINITIONS],
      implementations: {
        ...stepImplementations,
        ...buildNavImplementations(nextRef, backRef),
      },
    }),
    [], // empty deps — refs handle freshness
  );
}
