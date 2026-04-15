// apps/web/src/app/design/shift-timeline/page.tsx
"use client";

/**
 * Visual spec page for the shift timeline primitives.
 *
 * Renders all 16 state combinations (4 phases × 4 states) plus the
 * optional deviation/blocking decorations and all StageBadge variants.
 * Used as a non-production design reference during Phase 6 — linked
 * from no user-facing navigation.
 */

import * as React from "react";
import {
  LifecycleStage,
  StageConnector,
  ActiveOrb,
  StageBadge,
  type ShiftPhase,
  type StageState,
} from "@smartout/ui";

const PHASES: { phase: ShiftPhase; label: string }[] = [
  { phase: "planlegges", label: "Planlegges" },
  { phase: "pagar", label: "Pågår" },
  { phase: "oppgjor", label: "Oppgjør" },
  { phase: "avsluttet", label: "Avsluttet" },
];

const STATES: StageState[] = ["completed", "active", "upcoming", "skipped"];

export default function ShiftTimelineDesignPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
      <header>
        <h1 className="font-heading text-3xl">Shift timeline — primitives</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Design reference for Phase 6. All 16 state combos + badge variants. Copy shown in
          Norwegian for visual anchoring — actual components receive copy via i18n.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">State matrix</h2>
        <div className="grid grid-cols-4 gap-4">
          {PHASES.map((p) =>
            STATES.map((s) => (
              <div
                key={`${p.phase}-${s}`}
                className="border-border/60 bg-card rounded-lg border p-3"
              >
                <div className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                  {p.phase} · {s}
                </div>
                <LifecycleStage
                  phase={p.phase}
                  state={s}
                  label={p.label}
                  metric={s === "active" ? "7,5 t" : undefined}
                  ariaCurrent={s === "active" ? "step" : false}
                />
              </div>
            )),
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Deviation decorations</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border-border/60 bg-card rounded-lg border p-3">
            <LifecycleStage
              phase="pagar"
              state="active"
              label="Pågår"
              hasDeviation
              metric="4,25 t"
            />
          </div>
          <div className="border-border/60 bg-card rounded-lg border p-3">
            <LifecycleStage
              phase="oppgjor"
              state="active"
              label="Oppgjør"
              hasBlockingDeviation
              metric="7,25 t"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Connectors</h2>
        <div className="border-border/60 bg-card flex items-center gap-4 rounded-lg border p-4">
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground text-xs">completed→completed</div>
            <StageConnector fromState="completed" toState="completed" />
          </div>
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground text-xs">completed→active</div>
            <StageConnector fromState="completed" toState="active" />
          </div>
          <div className="flex flex-col items-center">
            <div className="text-muted-foreground text-xs">upcoming</div>
            <StageConnector fromState="active" toState="upcoming" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Active orb</h2>
        <div className="flex gap-8">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div
              key={size}
              className="border-border/60 bg-card relative flex h-96 w-72 items-center justify-center rounded-lg border"
            >
              <ActiveOrb anchorPhase="pagar" size={size} />
              <div className="text-muted-foreground relative z-10 text-xs">{size}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">Badges</h2>
        <div className="border-border/60 bg-card flex flex-wrap gap-2 rounded-lg border p-4">
          <StageBadge variant="deviation" label="Avvik" />
          <StageBadge variant="blocking" label="Blokkerer" />
          <StageBadge variant="pending-approval" label="Venter godkjenning" />
          <StageBadge variant="punched-in" label="Stemplet inn" />
          <StageBadge variant="punched-out" label="Stemplet ut" />
          <StageBadge variant="locked" label="Låst" />
        </div>
      </section>
    </main>
  );
}
