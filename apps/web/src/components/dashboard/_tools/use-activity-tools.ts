"use client";

/**
 * use-activity-tools.ts — Botsson read tools for the Activity surface.
 *
 * Three read-only tools backed by live useActivityFeed data:
 *   getRecentActivity   — last N events from the feed (default 20)
 *   searchActivity      — filter by actor, entity_type, event, category, and/or date-range
 *   getActivitySummary  — aggregate counts by category + recent high-signal events
 *
 * All tools are read-only — no gateAction, no emit. dataRef pattern keeps
 * implementations stable while still reading live cache entries.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { ActivityEntry } from "@/app/dashboard/_hooks/use-activity-feed";

export type ActivityToolInput = {
  /** Feed entries from useActivityFeed (default limit + today). */
  feed: ActivityEntry[];
  /** Full feed with wider range for search (30d, higher limit). */
  feedWide: ActivityEntry[];
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function summarizeByCategory(entries: ActivityEntry[]) {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    counts[e.category] = (counts[e.category] ?? 0) + 1;
  }
  return counts;
}

function serializeEntry(e: ActivityEntry) {
  return {
    id: e.id,
    time: e.createdAt,
    event: e.event,
    actionVerb: e.actionVerb,
    actor: e.actorName,
    entityType: e.entityType,
    entityLabel: e.entityLabel,
    description: e.description,
    category: e.category,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useActivityTools(input: ActivityToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getRecentActivity",
          description:
            "Get the most recent activity log entries for this workspace. Use when the manager asks 'hva har skjedd?', 'vis aktivitetslogg', or wants a quick recap of recent events. Returns up to 20 entries by default.",
          dynamicParameters: [
            {
              name: "limit",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "number",
                description:
                  "Maximum number of entries to return (1–50). Defaults to 20 if omitted.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "searchActivity",
          description:
            "Search the activity log by actor name, entity type, event keyword, or category. Use when manager asks about a specific person ('hva har Anna gjort?'), a specific type ('vis alle scheduling-hendelser'), or wants to filter by time. All params are optional — omit to return all recent entries.",
          dynamicParameters: [
            {
              name: "actorName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Filter by actor display name (case-insensitive substring match), e.g. 'Anna'.",
              },
              required: false,
            },
            {
              name: "entityType",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Filter by entity type, e.g. 'schedule_shift', 'profile', 'deviation'.",
              },
              required: false,
            },
            {
              name: "eventKeyword",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Keyword to match against event name (case-insensitive), e.g. 'late', 'check_in'.",
              },
              required: false,
            },
            {
              name: "category",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["scheduling", "operations", "training", "all"],
                description: "Filter by activity category. 'all' returns all categories.",
              },
              required: false,
            },
            {
              name: "limit",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "number",
                description: "Max results to return (1–50). Defaults to 20.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getActivitySummary",
          description:
            "Get an aggregated summary of workspace activity — entry counts by category, total event count, and the 5 most recent high-signal events. Use when manager asks for an overview or trend ('er det mye aktivitet i dag?', 'gi meg en oversikt').",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getRecentActivity: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const limit = Math.min(50, Math.max(1, (params.limit as number | undefined) ?? 20));
        const entries = d.feed.slice(0, limit);
        return JSON.stringify({
          total: d.feed.length,
          returned: entries.length,
          entries: entries.map(serializeEntry),
        });
      },

      searchActivity: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const actorName = (params.actorName as string | undefined)?.toLowerCase();
        const entityType = (params.entityType as string | undefined)?.toLowerCase();
        const eventKeyword = (params.eventKeyword as string | undefined)?.toLowerCase();
        const category = params.category as string | undefined;
        const limit = Math.min(50, Math.max(1, (params.limit as number | undefined) ?? 20));

        let results = d.feedWide;

        if (actorName) {
          results = results.filter((e) => e.actorName.toLowerCase().includes(actorName));
        }
        if (entityType) {
          results = results.filter((e) => e.entityType.toLowerCase().includes(entityType));
        }
        if (eventKeyword) {
          results = results.filter((e) => e.event.toLowerCase().includes(eventKeyword));
        }
        if (category && category !== "all") {
          results = results.filter((e) => e.category === category);
        }

        const sliced = results.slice(0, limit);
        return JSON.stringify({
          matched: results.length,
          returned: sliced.length,
          filters: { actorName, entityType, eventKeyword, category },
          entries: sliced.map(serializeEntry),
        });
      },

      getActivitySummary: () => {
        const d = dataRef.current;
        // Derive high-signal entries: events containing "late", "deviation", "error", or "escalat"
        const highSignal = d.feed
          .filter(
            (e) =>
              e.event.includes("late") ||
              e.event.includes("deviation") ||
              e.event.includes("error") ||
              e.event.includes("escalat"),
          )
          .slice(0, 5);

        return JSON.stringify({
          totalEntries: d.feed.length,
          byCategory: summarizeByCategory(d.feed),
          recentHighSignal: highSignal.map(serializeEntry),
          latestEntryAt: d.feed[0]?.createdAt ?? null,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
