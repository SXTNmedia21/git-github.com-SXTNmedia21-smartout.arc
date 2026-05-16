"use client";

// __density-sandbox/page.tsx
// Why: isolated visual exploration for schedule card density tiers.
// NO real Supabase calls, NO Server Actions, NO live page modification.
// Pontus reviews this before approving live integration (T5).
//
// Route: /dashboard/schedule/__density-sandbox
// Dev server: http://localhost:3060/dashboard/schedule/__density-sandbox

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DensitySelector, type ScheduleDensity } from "../_components/density-selector";
import { DemoCell } from "./_demo-cell";
import { FIXTURE_EMPLOYEES, FIXTURE_DAY_LABELS } from "./_fixtures";

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]">
      <span className="text-foreground font-semibold">Fixture-nøkkel:</span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-400/60" />
        Sous Chef / Bartender
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
        Server
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-purple-400/60" />
        Servitør / Vakthavende
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-orange-400/60" />
        Kokk
      </span>
      <span className="flex items-center gap-1.5">
        <AlertCircle className="text-destructive h-3 w-3" />
        Konflikt (Tor: Håkon Lie — 10–18 + 14–22 overlapper)
      </span>
      <span className="text-muted-foreground/70">
        · Dobbel vakt: Ons Ingrid Sørlie (07–15 + 16–23) · Nattskift: Fre Silje Vang (22–02)
      </span>
    </div>
  );
}

// ── Tier info banner ──────────────────────────────────────────────────────────

const TIER_INFO: Record<ScheduleDensity, string> = {
  cozy: "120px rader · full korttekst: rolle, sone, tid, timer · 4px strip",
  default: "100px rader · rolle, sone, tid · 4px strip",
  compact: "52px rader · rolle + tid + statusdot · 2px strip",
  pulse:
    "28px hetekart (ingen konflikt) · 40px mini-kort m/strip (konflikt rømmer) · Tom celle = grå",
};

// ── Main sandbox page ─────────────────────────────────────────────────────────

export default function ScheduleDensitySandboxPage() {
  const [density, setDensity] = useState<ScheduleDensity>("default");

  return (
    <div className="bg-background min-h-screen p-6">
      {/* Header */}
      <div className="mb-6 space-y-1">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Schedule Card Density Sandbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Isolert visuell utforskning — kun fixture-data, ingen Supabase-kall. Bytt tetthet for å
          sammenligne alle 4 nivåer før live-integrasjon (T5).
        </p>
      </div>

      {/* Density selector */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-muted-foreground text-xs font-semibold">Tetthet:</span>
        <DensitySelector value={density} onChange={setDensity} />
      </div>

      {/* Tier info */}
      <div className="border-border bg-muted/30 mb-4 rounded-lg border px-3 py-2">
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-semibold capitalize">{density}</span>
          {" — "}
          {TIER_INFO[density]}
        </p>
      </div>

      {/* Legend */}
      <div className="border-border bg-muted/20 mb-5 rounded-lg border px-3 py-2">
        <Legend />
      </div>

      {/* 5 × 7 mini-grid */}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[700px] border-collapse">
          {/* Header row: day labels */}
          <thead>
            <tr>
              {/* Employee name column header */}
              <th className="border-border bg-muted/40 text-muted-foreground border-r border-b px-3 py-2 text-left text-[11px] font-semibold">
                Ansatt
              </th>
              {FIXTURE_DAY_LABELS.map((label) => (
                <th
                  key={label}
                  className="border-border bg-muted/40 text-muted-foreground border-r border-b px-2 py-2 text-center text-[11px] font-semibold last:border-r-0"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {FIXTURE_EMPLOYEES.map((employee, empIdx) => {
              const isLastRow = empIdx === FIXTURE_EMPLOYEES.length - 1;
              return (
                <tr key={employee.id}>
                  {/* Employee name */}
                  <td
                    className={cn(
                      "border-border bg-muted/20 border-r px-3 py-2",
                      !isLastRow && "border-b",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Initials avatar */}
                      <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                        {employee.initials}
                      </div>
                      <span className="text-foreground text-[11px] font-medium whitespace-nowrap">
                        {employee.name}
                      </span>
                    </div>
                  </td>

                  {/* Day cells */}
                  {employee.days.map((day, dayIdx) => {
                    const isLastCol = dayIdx === employee.days.length - 1;
                    return (
                      <td
                        key={day.date}
                        className={cn(
                          "p-1.5 align-top",
                          !isLastRow && "border-border border-b",
                          !isLastCol && "border-border border-r",
                          // Pulse conflict cells escape row height constraint
                          density === "pulse" && day.shifts.some((s) => s.hasConflict)
                            ? "h-10"
                            : density === "cozy"
                              ? "h-[132px]"
                              : density === "default"
                                ? "h-[112px]"
                                : density === "compact"
                                  ? "h-[60px]"
                                  : "h-8",
                        )}
                      >
                        <DemoCell
                          tier={density}
                          shifts={day.shifts}
                          employeeInitials={employee.initials}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer notes */}
      <div className="text-muted-foreground mt-4 space-y-1 text-[11px]">
        <p>
          <span className="font-semibold">Konflikt-strip:</span> Rødt i alle 4 tetthetsnivåer
          (C2-krav). Pulse-konflikt rømmer til 40px mini-kort med rød strip og ring.
        </p>
        <p>
          <span className="font-semibold">Dobbel vakt (Ons/IS):</span> To kort stablet — ingen
          row-height blowup. Compact og Pulse håndterer stacking.
        </p>
        <p>
          <span className="font-semibold">Nattskift (Fre/SV 22–02):</span> formatTimeShort leverer
          &ldquo;22–02&rdquo; uten spesialtegn (V1-beslutning: ingen cross-midnight-markør).
        </p>
        <p className="text-muted-foreground/60">
          Sandbox-rute: /dashboard/schedule/__density-sandbox · Ingen Supabase · Ingen Server
          Actions · T5 live-integrasjon krever Pontus-godkjenning
        </p>
      </div>
    </div>
  );
}
