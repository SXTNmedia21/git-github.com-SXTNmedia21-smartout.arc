"use client";

import "./Botsson.css";
import { BotssonProvider } from "./BotssonProvider";
import { BotssonShell } from "./BotssonShell";
import { EmmaProfile } from "./EmmaProfile";
import { PlaygroundControls } from "./PlaygroundControls";

export function BotssonPlayground() {
  return (
    <BotssonProvider>
      <div className="bg-background relative min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="font-heading text-foreground mb-2 text-2xl font-semibold">
            Botsson Playground
          </h1>
          <p className="text-muted-foreground mb-8 text-sm">
            Click the orb to expand. Press ESC to collapse. Drag to move. Drag edges to resize. Open
            the Logg view inside the arena for tool calls + telemetri.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <EmmaProfile />
            <div className="space-y-4">
              <PlaygroundControls />
            </div>
          </div>
        </div>

        <BotssonShell />
      </div>
    </BotssonProvider>
  );
}
