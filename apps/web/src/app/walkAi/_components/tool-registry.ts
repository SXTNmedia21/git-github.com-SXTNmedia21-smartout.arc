"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  WalkAi Dynamic Tool Registry              */
/*                                            */
/*  Pages register tools when they mount.     */
/*  Emma's tool kit grows/shrinks as the      */
/*  user navigates between pages.             */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useEffect, useSyncExternalStore } from "react";
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
const listeners = new Set<() => void>();

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
 */
export function useRegisteredTools(): ClientToolKit {
  const sets = useSyncExternalStore(subscribe, getSnapshot, () => []);

  if (sets.length === 0) {
    return { definitions: [], implementations: {} };
  }

  const definitions: ClientToolDefinition[] = [];
  const implementations: Record<string, ClientToolImplementation> = {};

  for (const set of sets) {
    definitions.push(...set.definitions);
    Object.assign(implementations, set.implementations);
  }

  return { definitions, implementations };
}

/* ━━━ Hook: useRegisterTools ━━━━━━━━━━━━━━ */

/**
 * Page-level hook — registers tools on mount, unregisters on unmount.
 *
 * Usage in schedule page:
 *   const tools = useScheduleVoiceTools(input);
 *   useRegisterTools("schedule", tools);
 */
export function useRegisterTools(source: string, tools: ClientToolKit | null) {
  useEffect(() => {
    if (!tools) return;
    return registerTools(source, tools);
  }, [source, tools]);
}
