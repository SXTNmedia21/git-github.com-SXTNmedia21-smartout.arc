"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Summary = {
  label: string;
  count: number;
  last: number;
  lastTs: number;
  p50: number;
  p95: number;
  max: number;
};

type Sample = {
  label: string;
  ms: number;
  ts: number;
};

type PerfPayload = {
  samples: Sample[];
  summary: Summary[];
  count: number;
  generatedAt: number;
};

const POLL_INTERVAL_MS = 5_000;

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

function classifyLatency(ms: number): string {
  if (ms < 100) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 500) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function relativeTime(tsMs: number): string {
  const diff = Date.now() - tsMs;
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function PerfTable() {
  const [data, setData] = useState<PerfPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPerf = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform-admin/perf", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as PerfPayload;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerf();
  }, [fetchPerf]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchPerf, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchPerf]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Server-side perf samples</h3>
          <p className="text-muted-foreground text-xs">
            In-memory ring buffer (last 500). Cleared on process restart. Dev + prod.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-refresh 5s
          </label>
          <Button variant="outline" size="sm" onClick={fetchPerf} disabled={loading}>
            <RefreshCw className={loading ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} />
            Refresh
          </Button>
        </div>
      </div>

      {!data ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-sm">Loading perf samples…</p>
        </Card>
      ) : data.summary.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-sm">
            No samples yet. Navigate around the dashboard to populate.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="bg-muted/50 grid grid-cols-12 gap-2 border-b px-4 py-2 text-xs font-medium uppercase">
            <div className="col-span-5">Label</div>
            <div className="col-span-1 text-right">Count</div>
            <div className="col-span-1 text-right">Last</div>
            <div className="col-span-1 text-right">p50</div>
            <div className="col-span-1 text-right">p95</div>
            <div className="col-span-1 text-right">Max</div>
            <div className="col-span-2 text-right">Updated</div>
          </div>
          <div className="divide-y">
            {data.summary.map((row) => (
              <div
                key={row.label}
                className="hover:bg-muted/30 grid grid-cols-12 gap-2 px-4 py-1.5 text-xs"
              >
                <div className="col-span-5 truncate font-mono">{row.label}</div>
                <div className="text-muted-foreground col-span-1 text-right tabular-nums">
                  {row.count}
                </div>
                <div className={`col-span-1 text-right tabular-nums ${classifyLatency(row.last)}`}>
                  {fmtMs(row.last)}
                </div>
                <div className={`col-span-1 text-right tabular-nums ${classifyLatency(row.p50)}`}>
                  {fmtMs(row.p50)}
                </div>
                <div className={`col-span-1 text-right tabular-nums ${classifyLatency(row.p95)}`}>
                  {fmtMs(row.p95)}
                </div>
                <div className={`col-span-1 text-right tabular-nums ${classifyLatency(row.max)}`}>
                  {fmtMs(row.max)}
                </div>
                <div className="text-muted-foreground col-span-2 text-right">
                  {relativeTime(row.lastTs)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data && (
        <p className="text-muted-foreground text-xs">
          {data.count} samples across {data.summary.length} labels · generated{" "}
          {relativeTime(data.generatedAt)}
        </p>
      )}
    </div>
  );
}
