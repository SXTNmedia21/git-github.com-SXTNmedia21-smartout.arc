"use client";

/**
 * ManagerTimelineShell — full-page Gantt-down Manager Timeline shell.
 *
 * Layout: CSS grid with three rows
 *   topbar  (60px) — brand + date stepper + manager pill + Lukk-dagen CTA
 *   toolbar (52px) — view-mode segments + area chips + filter chips + zoom
 *   body    (1fr)  — ManagerTimelineChart (scrolls internally)
 *
 * Outer wrapper is 100dvh + overflow:hidden so the chart owns its own scroll.
 * Layout escape via apps/web/src/app/dashboard/oppgaver/layout.tsx.
 *
 * DomainChatOwnership: declares "oppgaver-timeline" so the global Botsson Orb
 * suppresses to passive mode per ADR-0238 — the page does NOT embed a chat
 * surface, but the user mental-model around a Gantt + AI Orb dual-surface is
 * ambiguous enough that we declare ownership defensively (L-0178 prevention).
 *
 * Subagent-driven plan tasks fill in TopBar (2.1), Toolbar (2.5), Chart (3.7),
 * Hooks (4.x), Tools-bridge (5.x), Modal (6.x).
 */
import { DomainChatOwnership } from "@/app/Botsson/_components/DomainChatOwnership";

export function ManagerTimelineShell() {
  return (
    <>
      <DomainChatOwnership reason="oppgaver-timeline" />
      <div
        className="bg-background grid h-[100dvh] grid-rows-[60px_52px_1fr] overflow-hidden"
        role="region"
        aria-label="Manager Timeline"
      >
        <div className="border-border bg-card border-b">
          {/* TopBar slot — Task 2.1 fills this in */}
        </div>
        <div className="border-border bg-card border-b">
          {/* Toolbar slot — Task 2.5 fills this in */}
        </div>
        <div className="overflow-y-auto">{/* Chart slot — Task 3.7 fills this in */}</div>
      </div>
    </>
  );
}
