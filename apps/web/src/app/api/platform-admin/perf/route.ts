import { NextResponse } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { getRecent, type PerfSample } from "@/lib/perf-store";

/**
 * GET /api/platform-admin/perf
 * Returns the in-memory perf ring buffer + an aggregated per-label summary
 * (count, last, p50, p95). Used by platform-admin/health to surface
 * server-side timing without leaving the dashboard.
 *
 * Super-admin guarded — perf data can leak request rates and route names.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Summary = {
  label: string;
  count: number;
  last: number;
  lastTs: number;
  p50: number;
  p95: number;
  max: number;
};

function summarize(samples: PerfSample[]): Summary[] {
  const byLabel = new Map<string, PerfSample[]>();
  for (const s of samples) {
    const list = byLabel.get(s.label);
    if (list) list.push(s);
    else byLabel.set(s.label, [s]);
  }
  const out: Summary[] = [];
  for (const [label, list] of byLabel) {
    const sorted = list.map((s) => s.ms).sort((a, b) => a - b);
    const last = list[list.length - 1]!;
    const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;
    out.push({
      label,
      count: list.length,
      last: last.ms,
      lastTs: last.ts,
      p50: p(0.5),
      p95: p(0.95),
      max: sorted[sorted.length - 1]!,
    });
  }
  return out.sort((a, b) => b.lastTs - a.lastTs);
}

export async function GET() {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const samples = getRecent();
  const summary = summarize(samples);

  return NextResponse.json({
    samples,
    summary,
    count: samples.length,
    generatedAt: Date.now(),
  });
}
