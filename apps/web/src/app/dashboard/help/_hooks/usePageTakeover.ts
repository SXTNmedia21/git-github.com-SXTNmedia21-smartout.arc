"use client";

// ============================================
// usePageTakeover.ts
// State machine for the page-takeover lifecycle (M3.2 / ADR-0228):
//
//   idle ─proposeAction()→ previewing ─confirmAction()→ executing ─→ done
//                                    └─cancelAction()→ cancelled
//
// Telemetry emits at each transition. Caller (HelpTakeoverToolsBridge) gets
// activeTarget + state and renders <TakeoverPreview> when state === 'previewing'.
// ============================================

import { useCallback, useRef, useState } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  resolveTakeoverTarget,
  type TakeoverTarget,
} from "@/app/dashboard/help/_lib/takeover-targets";
import { pageTakeoverGateAction } from "@/app/dashboard/help/_actions/page-takeover-gate-action";

export type TakeoverState = "idle" | "previewing" | "executing" | "done" | "cancelled";

interface ActiveTarget {
  target_id: TakeoverTarget;
  selector: string;
  label: string;
  capability: string;
  proposed_at: number;
}

export interface UsePageTakeoverOptions {
  workspaceId: string;
  actorId: string;
}

export interface UsePageTakeoverResult {
  state: TakeoverState;
  activeTarget: ActiveTarget | null;
  proposeAction: (
    target_id: string,
  ) => Promise<
    { ok: true; target_id: TakeoverTarget } | { ok: false; reason: string; user_message?: string }
  >;
  confirmAction: () => Promise<{ ok: true; executed: true } | { ok: false; reason: string }>;
  cancelAction: (trigger: "esc" | "off_target_click") => void;
}

export function usePageTakeover({
  workspaceId,
  actorId,
}: UsePageTakeoverOptions): UsePageTakeoverResult {
  const [state, setState] = useState<TakeoverState>("idle");
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const stateRef = useRef<TakeoverState>("idle");
  stateRef.current = state;

  const proposeAction = useCallback(
    async (
      target_id: string,
    ): Promise<
      { ok: true; target_id: TakeoverTarget } | { ok: false; reason: string; user_message?: string }
    > => {
      // Server gate check first — denies before any UI surfaces
      const gate = await pageTakeoverGateAction({ target_id, channel: "chat" });
      if (!gate.ok) {
        return { ok: false, reason: gate.reason, user_message: gate.user_message };
      }

      const spec = resolveTakeoverTarget(gate.target_id as TakeoverTarget);

      // Emit proposed AFTER gate allow
      await emit({
        event: "page_takeover.action_proposed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          target_id: nonEmpty(spec.target_id, "target_id"),
          action_type: spec.action_type,
          capability: nonEmpty(spec.capability, "capability"),
        },
      });

      setActiveTarget({
        target_id: spec.target_id,
        selector: spec.selector,
        label: spec.label,
        capability: spec.capability,
        proposed_at: Date.now(),
      });
      setState("previewing");

      return { ok: true, target_id: spec.target_id };
    },
    [workspaceId, actorId],
  );

  const confirmAction = useCallback(async (): Promise<
    { ok: true; executed: true } | { ok: false; reason: string }
  > => {
    const target = activeTarget;
    if (!target || stateRef.current !== "previewing") {
      return { ok: false, reason: "no_active_preview" };
    }

    const previewDuration = Date.now() - target.proposed_at;
    const spec = resolveTakeoverTarget(target.target_id);

    setState("executing");

    await emit({
      event: "page_takeover.action_confirmed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      properties: {
        target_id: nonEmpty(target.target_id, "target_id"),
        action_type: spec.action_type,
        preview_duration_ms: previewDuration,
      },
    });

    let success = true;
    let failureReason: string | undefined;

    try {
      const el = document.querySelector(target.selector);
      if (!(el instanceof HTMLElement)) {
        success = false;
        failureReason = "element_not_found";
      } else if (spec.action_type === "click") {
        el.click();
      } else {
        success = false;
        failureReason = `action_type_${spec.action_type}_not_supported_v1`;
      }
    } catch (e) {
      success = false;
      failureReason = `exception: ${e instanceof Error ? e.message : String(e)}`;
    }

    await emit({
      event: "page_takeover.action_executed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      properties: {
        target_id: nonEmpty(target.target_id, "target_id"),
        action_type: spec.action_type,
        success,
        ...(failureReason ? { failure_reason: failureReason } : {}),
      },
    });

    setState("done");
    setActiveTarget(null);

    if (!success) {
      return { ok: false, reason: failureReason ?? "execution_failed" };
    }
    return { ok: true, executed: true };
  }, [activeTarget, workspaceId, actorId]);

  const cancelAction = useCallback(
    (trigger: "esc" | "off_target_click") => {
      const target = activeTarget;
      if (!target || stateRef.current !== "previewing") return;

      const spec = resolveTakeoverTarget(target.target_id);

      void emit({
        event: "page_takeover.action_cancelled",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          target_id: nonEmpty(target.target_id, "target_id"),
          action_type: spec.action_type,
          trigger,
        },
      });

      setState("cancelled");
      setActiveTarget(null);
    },
    [activeTarget, workspaceId, actorId],
  );

  return {
    state,
    activeTarget,
    proposeAction,
    confirmAction,
    cancelAction,
  };
}
