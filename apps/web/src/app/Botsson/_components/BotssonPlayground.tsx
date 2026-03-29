"use client";

import { useState } from "react";
import "./Botsson.css";
import { BotssonProvider } from "./BotssonProvider";
import { BotssonShell } from "./BotssonShell";
import { EmmaProfile } from "./EmmaProfile";
import { PlaygroundControls } from "./PlaygroundControls";
import { PlaygroundLog } from "./PlaygroundLog";
import { TelemetryLog } from "./TelemetryLog";

type LogTab = "agent" | "telemetry";

export function BotssonPlayground() {
  const [activeLog, setActiveLog] = useState<LogTab | null>(null);

  return (
    <BotssonProvider>
      <div className="bg-background relative min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-foreground text-2xl font-semibold">Botsson Playground</h1>
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
          <p className="text-muted-foreground mb-8 text-sm">
            Click the orb to expand. Press ESC to collapse. Drag to move. Drag edges to resize.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
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

        <BotssonShell />
      </div>
    </BotssonProvider>
  );
}

function LogToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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
