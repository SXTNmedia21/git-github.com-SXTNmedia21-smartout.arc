// apps/journey-control/src/app/api/journeys/[slug]/abort/[runId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { abortRun } from "@/lib/journey-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; runId: string }> },
) {
  const { runId } = await ctx.params;
  const ok = abortRun(runId);
  return NextResponse.json({ ok });
}
