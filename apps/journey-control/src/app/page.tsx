// apps/journey-control/src/app/page.tsx
"use client";

import { useState } from "react";
import type { SpeedProfile } from "@smartout/journey-ir";
import { JourneyList } from "@/components/journey-list";
import { SpeedPicker } from "@/components/speed-picker";
import { RunViewer } from "@/components/run-viewer";

export default function Home() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<"compiled" | "draft" | null>(null);
  const [speedProfile, setSpeedProfile] = useState<SpeedProfile>("normal");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!selectedSlug) return;
    setError(null);
    setActiveRunId(null);
    const r = await fetch(`/api/journeys/${selectedSlug}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed_profile: speedProfile }),
    });
    const j = await r.json();
    if (j.ok) setActiveRunId(j.runId);
    else setError(j.error);
  }

  return (
    <main className="container mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-heading text-4xl">Journey Control Center</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pick a journey, choose a speed, run it locally.
        </p>
      </header>

      <div className="grid grid-cols-[1fr_2fr] gap-6">
        <aside>
          <JourneyList
            selectedSlug={selectedSlug}
            onSelect={(slug, kind) => {
              setSelectedSlug(slug);
              setSelectedKind(kind);
              setActiveRunId(null);
            }}
          />
        </aside>

        <section className="space-y-4">
          {selectedSlug ? (
            <>
              <div className="border-border bg-card rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{selectedSlug}</div>
                    <div className="text-muted-foreground text-xs uppercase">{selectedKind}</div>
                  </div>
                  <SpeedPicker
                    value={speedProfile}
                    onChange={setSpeedProfile}
                    disabled={!!activeRunId}
                  />
                </div>
                <div className="flex gap-2">
                  {selectedKind === "compiled" ? (
                    <button
                      onClick={handleRun}
                      disabled={!!activeRunId}
                      className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Run
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-muted text-muted-foreground rounded-md px-4 py-2 text-sm font-medium"
                      title="Compile lands in next phase"
                    >
                      Compile (TBD)
                    </button>
                  )}
                </div>
                {error && <p className="text-destructive mt-3 text-xs">{error}</p>}
              </div>

              {activeRunId && <RunViewer slug={selectedSlug} runId={activeRunId} />}
            </>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
              Pick a journey to begin
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
