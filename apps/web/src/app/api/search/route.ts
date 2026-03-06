import { type NextRequest, NextResponse } from "next/server";
import { runSearchOrchestrator } from "@/lib/search/orchestrator";
import { parseSearchPrefix } from "@/lib/search/query-prefix";
import type { SearchMode } from "@/lib/search/query-prefix";
import { recordSearchMetric } from "@/lib/search/metrics";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  const rawQuery = req.nextUrl.searchParams.get("q") ?? "";

  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  if (!rawQuery.trim()) {
    return NextResponse.json({ groups: [], timing_ms: 0 });
  }

  const { mode, query } = parseSearchPrefix(rawQuery);

  const result = await runSearchOrchestrator({
    workspaceId,
    query,
    mode: mode as SearchMode,
    limitPerGroup: 5,
  });

  recordSearchMetric({
    query,
    mode,
    timing_ms: result.timing_ms,
    result_count: result.groups.reduce(
      (sum: number, g: { results: unknown[] }) => sum + g.results.length,
      0,
    ),
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(result);
}
