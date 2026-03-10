"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SystemSpeedTestResponse } from "@/app/api/platform-admin/health/system-speed-test/route";
import { platformAdminRoutes } from "@/lib/platform-admin-routes";

type SnapshotLabel = "A" | "B";

type TestSnapshot = {
  label: SnapshotLabel;
  result: SystemSpeedTestResponse;
};

/**
 * Formats bytes into KiB/MiB for quick readability in admin health.
 * Why: payload size is part of the load profile for speed regressions.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/**
 * Displays before/after speed snapshots and delta for A/B reruns.
 * Why: enables quick regression checks directly in platform admin health.
 */
export function SystemSpeedTestCard() {
  const [snapshots, setSnapshots] = useState<TestSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRunTriggeredRef = useRef(false);

  const snapshotA = snapshots.find((snapshot) => snapshot.label === "A");
  const snapshotB = snapshots.find((snapshot) => snapshot.label === "B");

  const delta = useMemo(() => {
    if (!snapshotA || !snapshotB) return null;
    const coreDelta = snapshotB.result.core.duration_ms - snapshotA.result.core.duration_ms;
    const extendedDelta =
      snapshotB.result.extended.duration_ms - snapshotA.result.extended.duration_ms;
    return { coreDelta, extendedDelta };
  }, [snapshotA, snapshotB]);

  /**
   * Executes one speed test request and returns the parsed result.
   * Why: auto-run mode needs deterministic A then B sequencing.
   */
  async function fetchSnapshotResult(): Promise<SystemSpeedTestResponse> {
    const response = await fetch("/api/platform-admin/health/system-speed-test");
    if (!response.ok) {
      throw new Error(`Failed with HTTP ${response.status}`);
    }
    return (await response.json()) as SystemSpeedTestResponse;
  }

  /**
   * Stores a snapshot under a fixed label.
   * Why: auto-run and manual mode must both write predictable A/B slots.
   */
  function setSnapshot(label: SnapshotLabel, result: SystemSpeedTestResponse) {
    setSnapshots((current) => {
      const withoutLabel = current.filter((snapshot) => snapshot.label !== label);
      return [...withoutLabel, { label, result }];
    });
  }

  /**
   * Runs one speed test snapshot and stores it as A then B.
   * Why: allows easy baseline + rerun comparisons without leaving the page.
   */
  async function runSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSnapshotResult();
      const nextLabel: SnapshotLabel = snapshots.some((snapshot) => snapshot.label === "A")
        ? "B"
        : "A";
      setSnapshot(nextLabel, result);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Unknown error while running speed test",
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * Auto-runs A/B snapshots once when the card is mounted.
   * Why: user requested no manual click to start system speed testing.
   */
  useEffect(() => {
    if (autoRunTriggeredRef.current) return;
    autoRunTriggeredRef.current = true;

    const runAuto = async () => {
      setLoading(true);
      setError(null);
      try {
        const resultA = await fetchSnapshotResult();
        setSnapshot("A", resultA);
        const resultB = await fetchSnapshotResult();
        setSnapshot("B", resultB);
      } catch (runError) {
        setError(
          runError instanceof Error
            ? runError.message
            : "Unknown error while auto-running speed test",
        );
      } finally {
        setLoading(false);
      }
    };

    void runAuto();
  }, []);

  /**
   * Clears A/B snapshots so a new comparison can start.
   * Why: keeps test sessions explicit for reliable comparisons.
   */
  function resetSnapshots() {
    setSnapshots([]);
    setError(null);
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4" />
            System Speed Test (A/B)
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Measures 30-day schedule-like data load (core + extended layers), then compares rerun.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetSnapshots} disabled={loading}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={runSnapshot} disabled={loading}>
            <Play className="mr-1 h-3.5 w-3.5" />
            {snapshotA ? "Run B" : "Run A"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(platformAdminRoutes.walkthrough, "_blank")}
            disabled={loading}
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            Start 20-step walkthrough
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {[
          { slot: "A", snapshot: snapshotA },
          { slot: "B", snapshot: snapshotB },
        ].map(({ slot, snapshot }) => (
          <div key={slot} className="rounded-lg border p-3">
            {!snapshot ? (
              <p className="text-muted-foreground text-xs">Snapshot not recorded yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Snapshot {snapshot.label}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {new Date(snapshot.result.tested_at).toLocaleTimeString("no-NO")}
                  </p>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Workspace {snapshot.result.workspace_id.slice(0, 8)}..., window{" "}
                  {snapshot.result.date_start} to {snapshot.result.date_end}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Core duration</p>
                    <p className="font-semibold">{snapshot.result.core.duration_ms} ms</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Extended duration</p>
                    <p className="font-semibold">{snapshot.result.extended.duration_ms} ms</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Core rows / payload</p>
                    <p className="font-semibold">
                      {snapshot.result.core.total_rows} /{" "}
                      {formatBytes(snapshot.result.core.total_payload_bytes)}
                    </p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-muted-foreground">Extended rows / payload</p>
                    <p className="font-semibold">
                      {snapshot.result.extended.total_rows} /{" "}
                      {formatBytes(snapshot.result.extended.total_payload_bytes)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {delta ? (
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold">A → B delta</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Core: {delta.coreDelta >= 0 ? "+" : ""}
            {delta.coreDelta.toFixed(2)} ms, Extended: {delta.extendedDelta >= 0 ? "+" : ""}
            {delta.extendedDelta.toFixed(2)} ms
          </p>
        </div>
      ) : null}
    </Card>
  );
}
