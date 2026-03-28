/**
 * Focused render test for the V1 hospitality cockpit.
 *
 * Validates that all five required slices render from the composed
 * HospitalityOperationsCockpit component when first-screen data is available.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HospitalityOperationsCockpit } from "../HospitalityOperationsCockpit";

vi.mock("@/app/dashboard/_hooks/use-cockpit-first-screen", () => ({
  useCockpitFirstScreen: () => ({
    staffingQueue: [
      {
        id: "staffing-1",
        severity: "critical",
        uncoveredShifts: 2,
        affectedTeams: 1,
        occurredAt: "2026-03-28T08:00:00.000Z",
      },
    ],
    operationalQueue: [
      {
        id: "ops-1",
        severity: "warning",
        blockingDeviations: 0,
        overdueTasks: 3,
        occurredAt: "2026-03-28T08:05:00.000Z",
      },
    ],
    onDutyEntries: [
      {
        shiftId: "shift-1",
        employeeName: "Alex Nord",
        initials: "AN",
        role: "Server",
        status: "clocked_in",
        duration: "2h 5m",
      },
    ],
    feed: [
      {
        id: "feed-1",
        source: "human",
        sessionMode: "none",
        severity: "info",
        eventType: "task.updated",
        summary: "Alex Nord updated opening checklist",
        occurredAt: "2026-03-28T08:10:00.000Z",
      },
    ],
    operations: undefined,
    isLoading: false,
    isError: false,
  }),
}));

describe("HospitalityOperationsCockpit", () => {
  it("renders all five V1 slices", () => {
    const html = renderToStaticMarkup(<HospitalityOperationsCockpit />);

    expect(html).toContain('data-testid="cockpit-top-strip"');
    expect(html).toContain('data-testid="cockpit-risk-queues"');
    expect(html).toContain('data-testid="cockpit-on-duty-progress"');
    expect(html).toContain('data-testid="cockpit-action-rail"');
    expect(html).toContain('data-testid="cockpit-activity-feed"');
  });
});
