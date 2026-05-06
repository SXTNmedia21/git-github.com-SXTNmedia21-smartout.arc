// apps/journey-control/src/components/run-viewer.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Line = {
  type: "stdout" | "stderr" | "done" | "killed";
  line?: string;
  exitCode?: number;
  reason?: string;
};

type Props = { slug: string; runId: string };

export function RunViewer({ slug, runId }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState<Line | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/journeys/${slug}/stream/${runId}`);
    es.onmessage = (e) => {
      try {
        const msg: Line = JSON.parse(e.data);
        if (msg.type === "done" || msg.type === "killed") {
          setDone(msg);
          es.close();
        } else {
          setLines((prev) => [...prev.slice(-499), msg]);
        }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [slug, runId]);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [lines]);

  return (
    <div className="border-border bg-card flex flex-col rounded-lg border">
      <div className="border-border flex items-center justify-between border-b p-3">
        <div className="font-mono text-sm">
          {slug} <span className="text-muted-foreground">{runId}</span>
        </div>
        <div className="flex items-center gap-3">
          {!done && (
            <button
              onClick={async () => {
                await fetch(`/api/journeys/${slug}/abort/${runId}`, { method: "POST" });
              }}
              className="text-destructive hover:text-destructive/80 text-xs"
            >
              Abort
            </button>
          )}
          {done && (
            <span
              className={
                done.type === "done" && done.exitCode === 0
                  ? "text-xs text-green-500"
                  : "text-destructive text-xs"
              }
            >
              {done.type === "done" ? `exit ${done.exitCode}` : `killed: ${done.reason}`}
            </span>
          )}
        </div>
      </div>
      <div ref={containerRef} className="bg-muted/30 max-h-96 overflow-auto p-3 font-mono text-xs">
        {lines.map((l, i) => (
          <div
            key={i}
            className={l.type === "stderr" ? "text-destructive/80" : "text-muted-foreground"}
          >
            {l.line}
          </div>
        ))}
        {lines.length === 0 && <div className="text-muted-foreground">Waiting for output…</div>}
      </div>
    </div>
  );
}
