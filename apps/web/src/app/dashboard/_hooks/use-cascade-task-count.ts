"use client";

/**
 * Derives badge counts (critical + should) from the shared cascade tasks query.
 * Shares the same TanStack Query cache key as useCascadeTasks — no duplicate fetch.
 */

import { useCascadeTasks } from "./use-cascade-tasks";

export function useCascadeTaskCount() {
  const query = useCascadeTasks();

  return {
    ...query,
    data: query.data
      ? { critical: query.data.critical_count, should: query.data.should_count }
      : undefined,
  };
}
