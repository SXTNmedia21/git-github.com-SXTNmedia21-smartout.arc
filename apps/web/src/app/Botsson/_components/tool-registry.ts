"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Botsson Dynamic Tool Registry              */
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
 *
 * COLLISION DETECTION (ADR-0325 Phase 1 + ADR-0326):
 * Detects duplicate `modelToolName` registrations across different source bridges.
 * Phase 1 ships as grace mode (console.error). When Phase 2 semantic dedupe sortie
 * completes (collapsing 6-8 of 11 known duplicates to sharedMount), this detector
 * will be promoted to throw new Error(...) for hard enforcement.
 * Known collisions (11 as of 2026-05-14): listOpenDeviations × 3, switchStatusFilter × 2,
 * listTeams × 2, proposeActivateSeason × 2, getUnreadCount × 2, listOpenDeviations × 1 more.
 * See docs/decisions/0325-tool-name-discipline.md + docs/decisions/0326-page-tool-registration-semantics.md
 */
export function useRegisteredTools(): ClientToolKit {
  const sets = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  return useMemo(() => {
    if (sets.length === 0) return EMPTY_TOOLKIT;

    const definitions: ClientToolDefinition[] = [];
    const implementations: Record<string, ClientToolImplementation> = {};
    // Tracks first-seen source per modelToolName for collision detection (ADR-0325 Phase 1)
    const seen = new Map<string, string>(); // modelToolName -> first-seen source

    for (const set of sets) {
      for (const def of set.definitions) {
        const name = def.temporaryTool?.modelToolName;
        if (!name) continue;
        const existing = seen.get(name);
        if (existing !== undefined && existing !== set.source) {
          // Collision detected — two different source bridges registered the same tool name.
          // Per ADR-0325 Phase 1 grace mode: console.error (not throw) until Phase 2 dedupe sortie.
          // The LLM will see duplicate definitions; implementation routes by mount order (last-wins).
          // Phase 2 sortie will classify: semantic-duplicate (collapse to sharedMount) vs
          // genuine-conflict (targeted rename per ADR-0325 Phase 3 convention getKommUnreadCount etc.)
          // TODO Phase 1.5: promote to throw new Error(msg) after dedupe sortie closes.
          const msg =
            `[page-tools] Duplicate tool registration: "${name}" registered by both "${existing}" and "${set.source}". ` +
            `Per ADR-0325 page-tool naming discipline, this is a collision. ` +
            `Phase 1 grace mode: console.error. Promote to throw after dedupe sortie (Phase 2). ` +
            `See docs/decisions/0325-tool-name-discipline.md`;
          if (process.env.NODE_ENV === "development") {
            console.error(msg);
          }
        }
        seen.set(name, set.source);
        definitions.push(def);
      }
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
