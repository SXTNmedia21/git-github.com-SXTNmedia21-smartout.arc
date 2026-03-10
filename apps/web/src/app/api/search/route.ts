/**
 * Search API route.
 *
 * Why this exists:
 * Parse user search input, run orchestrated search modes, and emit
 * lightweight in-memory metrics without impacting API reliability.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runSearchOrchestrator } from "@/lib/search/orchestrator";
import { parseSearchPrefix } from "@/lib/search/query-prefix";
import type { SearchMode } from "@/lib/search/query-prefix";
import { recordSearchMetric } from "@/lib/search/metrics";

const SearchQuerySchema = z.object({
  workspaceId: z.string().min(1),
  q: z.string().optional().default(""),
});

/**
 * Handles search requests and returns grouped orchestrator results.
 * Why: centralize API input validation, mode parsing, and metric capture.
 * Returns: JSON payload with groups + timing, or an error response.
 */
export async function GET(req: NextRequest) {
  const parsed = SearchQuerySchema.safeParse({
    workspaceId: req.nextUrl.searchParams.get("workspaceId"),
    q: req.nextUrl.searchParams.get("q") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid workspaceId" }, { status: 400 });
  }

  const { workspaceId, q: rawQuery } = parsed.data;

  if (!rawQuery.trim()) {
    return NextResponse.json({ groups: [], timing_ms: 0 });
  }

  const { mode, query } = parseSearchPrefix(rawQuery);
  const startedAt = Date.now();

  const recordMetric = (timingMs: number, resultCount: number) => {
    try {
      recordSearchMetric({
        query,
        mode,
        timing_ms: timingMs,
        result_count: resultCount,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Metrics should never break search responses.
    }
  };

  try {
    const result = await runSearchOrchestrator({
      workspaceId,
      query,
      mode: mode as SearchMode,
      limitPerGroup: 5,
    });

    recordMetric(
      result.timing_ms,
      result.groups.reduce((sum, group) => sum + group.results.length, 0),
    );

    return NextResponse.json(result);
  } catch {
    recordMetric(Math.max(0, Date.now() - startedAt), 0);
    return NextResponse.json({ error: "Failed to execute search" }, { status: 500 });
  }
}
