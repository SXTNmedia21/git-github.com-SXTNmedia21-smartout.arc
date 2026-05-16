"use client";

/**
 * useDayTimelineScope — reads and writes the ?scope=type:<id> URL search-param.
 *
 * Scope persists across page reload. Other search-params (date, dept) are
 * preserved on write. Consumers pass scope to useDayTimelineEvents to filter
 * the Dagslinjen strip by avdeling, team, or vakt.
 */

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type DayTimelineScope =
  | { type: "all" }
  | { type: "department"; id: string }
  | { type: "team"; id: string }
  | { type: "shift"; id: string };

/** Serialise scope → URL param string, e.g. "team:abc-123" */
function encodeScope(scope: DayTimelineScope): string {
  if (scope.type === "all") return "all";
  return `${scope.type}:${scope.id}`;
}

/** Parse URL param string → typed scope. Falls back to "all" on bad input. */
function decodeScope(raw: string | null): DayTimelineScope {
  if (!raw || raw === "all") return { type: "all" };
  const colon = raw.indexOf(":");
  if (colon === -1) return { type: "all" };
  const type = raw.slice(0, colon) as DayTimelineScope["type"];
  const id = raw.slice(colon + 1);
  if (!id) return { type: "all" };
  if (type === "department" || type === "team" || type === "shift") {
    return { type, id };
  }
  return { type: "all" };
}

export function useDayTimelineScope(): {
  scope: DayTimelineScope;
  setScope: (s: DayTimelineScope) => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const scope = decodeScope(searchParams.get("scope"));

  const setScope = useCallback(
    (next: DayTimelineScope) => {
      // Preserve all existing search-params; only mutate "scope"
      const params = new URLSearchParams(searchParams.toString());
      const encoded = encodeScope(next);
      if (encoded === "all") {
        params.delete("scope");
      } else {
        params.set("scope", encoded);
      }
      const qs = params.toString();
      router.push(`?${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  return { scope, setScope };
}
