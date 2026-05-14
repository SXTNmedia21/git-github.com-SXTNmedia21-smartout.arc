"use client";

/**
 * todo-tools-bridge.tsx — registers Botsson read tools for the "Å gjøre" cascade
 * task surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps TodoTaskView free from voice-tool registration bookkeeping.
 *  - Re-uses the same useCascadeTasks hook that TodoTaskView already calls.
 *    Query-key dedup means there is no extra network cost.
 *  - Mounts only in the ready state (data loaded, tasks > 0). No write tools
 *    are registered here — cascade task write actions do not exist yet (deferred).
 *
 * Tools registered:
 *  - listTodos (read) — full cascade task list, filterable by urgency.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useCascadeTasks } from "../../_hooks/use-cascade-tasks";
import { useTodoTools } from "./use-todo-tools";

export function TodoToolsBridge() {
  const { data } = useCascadeTasks();

  const tools = useTodoTools({ cascadeResult: data });

  useRegisterTools("todo", tools);

  return null;
}
