"use client";

import { useState } from "react";
import "./walkai.css";
import { WalkAiProvider } from "./WalkAiProvider";
import { WalkAiShell } from "./WalkAiShell";
import { EmmaProfile } from "./EmmaProfile";
import { PlaygroundControls } from "./PlaygroundControls";
import { PlaygroundLog } from "./PlaygroundLog";
import { TelemetryLog } from "./TelemetryLog";

type LogTab = "agent" | "telemetry";

export function WalkAiPlayground() {
  const [activeLog, setActiveLog] = useState<LogTab | null>(null);

  return (
    <WalkAiProvider>
      <div className="relative min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold text-foreground">
              WalkAi Playground
            </h1>
            <div className="flex items-center gap-2">
              <LogToggle
                label="Agent Log"
                active={activeLog === "agent"}
                onClick={() => setActiveLog((v) => (v === "agent" ? null : "agent"))}
              />
              <LogToggle
                label="Telemetry"
                active={activeLog === "telemetry"}
                onClick={() => setActiveLog((v) => (v === "telemetry" ? null : "telemetry"))}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            Click the orb to expand. Press ESC to collapse. Drag to move. Drag edges to resize.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* Emma's profile — always visible */}
            <EmmaProfile />

            {/* Dev controls + logs */}
            <div className="space-y-4">
              <PlaygroundControls />
              <PlaygroundLog open={activeLog === "agent"} />
              <TelemetryLog open={activeLog === "telemetry"} />
            </div>
          </div>
        </div>

        <WalkAiShell />
      </div>
    </WalkAiProvider>
  );
}

function LogToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
        active
          ? "border-brand-orange/40 bg-brand-orange/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
