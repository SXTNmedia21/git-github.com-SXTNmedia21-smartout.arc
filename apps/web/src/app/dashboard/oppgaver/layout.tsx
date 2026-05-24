/**
 * Manager Timeline (/dashboard/oppgaver) — layout escape.
 *
 * The dashboard's default layout applies a page-scroll wrapper that doesn't
 * suit the full-day Gantt chart. This layout owns its own 100dvh chrome with
 * outer overflow:hidden so the chart body can scroll internally.
 *
 * Spec: docs/domains/day-session/day-planner/project/Manager Timeline.html
 * ADR-0367: tri-layer D6 model anchors the chart's data shape.
 * ADR-0357: page-polish rule — site-map registration owns this route.
 */
import type { ReactNode } from "react";

export default function OppgaverLayout({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-hidden">{children}</div>;
}
