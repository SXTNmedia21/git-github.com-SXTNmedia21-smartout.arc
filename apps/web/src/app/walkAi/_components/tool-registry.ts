"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi Dynamic Tool Registry              */
/*                                            */
/*  Pages register tools when they mount.     */
/*  Emma's tool kit grows/shrinks as the      */
/*  user navigates between pages.             */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useEffect, useRef, useMemo, useSyncExternalStore } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

type RegisteredToolSet = {
  /** Source page/module that registered these tools */
  source: string;
  definitions: ClientToolDefinition[];
  implementations: Record<string, ClientToolImplementation>;
};

/* ━━━ Singleton store ━━━━━━━━━━━━━━━━━━━━━ */

const registry = new Map<string, RegisteredToolSet>();
let snapshot: RegisteredToolSet[] = [];
const SERVER_SNAPSHOT: RegisteredToolSet[] = [];
const listeners = new Set<() => void>();

/** Stable empty toolkit — returned when no tools are registered to avoid new object per render */
const EMPTY_TOOLKIT: ClientToolKit = { definitions: [], implementations: {} };

function notify() {
  snapshot = Array.from(registry.values());
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): RegisteredToolSet[] {
  return snapshot;
}

/**
 * Register a set of tools from a page/module.
 * Returns an unregister function.
 */
export function registerTools(source: string, tools: ClientToolKit): () => void {
  registry.set(source, {
    source,
    definitions: tools.definitions,
    implementations: tools.implementations,
  });
  notify();

  return () => {
    registry.delete(source);
    notify();
  };
}

/* ━━━ Hook: useRegisteredTools ━━━━━━━━━━━━ */

/**
 * Returns all currently registered page-specific tools,
 * merged into a single definitions + implementations object.
 * Returns a stable reference when the registry is empty (prevents render cascades).
 */
export function useRegisteredTools(): ClientToolKit {
  const sets = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  return useMemo(() => {
    if (sets.length === 0) return EMPTY_TOOLKIT;

    const definitions: ClientToolDefinition[] = [];
    const implementations: Record<string, ClientToolImplementation> = {};

    for (const set of sets) {
      definitions.push(...set.definitions);
      Object.assign(implementations, set.implementations);
    }

    return { definitions, implementations };
  }, [sets]);
}

/* ━━━ Hook: useRegisterTools ━━━━━━━━━━━━━━ */

/**
 * Page-level hook — registers tools on mount, unregisters on unmount.
 * Uses a ref to track the previous tools and only re-registers when
 * the definitions actually change (by count + names), not on every render.
 *
 * IMPORTANT: Callers should memoize the tools object for best performance,
 * but this hook is defensive against unstable references.
 *
 * Usage in schedule page:
 *   const tools = useScheduleVoiceTools(input);
 *   useRegisterTools("schedule", tools);
 */
export function useRegisterTools(source: string, tools: ClientToolKit | null) {
  const prevKeyRef = useRef<string>("");
  const unregisterRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!tools) {
      // No tools — unregister if previously registered
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
        prevKeyRef.current = "";
      }
      return;
    }

    // Build a stable key from tool names to detect actual changes
    const key = tools.definitions
      .map((d) => d.temporaryTool.modelToolName)
      .sort()
      .join(",");

    if (key === prevKeyRef.current) return; // No change — skip re-registration

    // Unregister previous set before registering new
    if (unregisterRef.current) {
      unregisterRef.current();
    }

    unregisterRef.current = registerTools(source, tools);
    prevKeyRef.current = key;

    return () => {
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
        prevKeyRef.current = "";
      }
    };
  }, [source, tools]);
}
