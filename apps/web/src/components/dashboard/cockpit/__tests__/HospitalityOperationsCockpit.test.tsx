/**
 * Focused render test for the V1 hospitality cockpit.
 *
 * Validates that all four required slices render from the composed
 * HospitalityOperationsCockpit component when first-screen data is available.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HospitalityOperationsCockpit } from "../HospitalityOperationsCockpit";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue("/dashboard"),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

vi.mock("@/components/dashboard/cockpit/CockpitPrepStrip", () => ({
  CockpitPrepStrip: () => <div data-testid="cockpit-top-strip" />,
}));

vi.mock("@/components/dashboard/cockpit/CockpitOnDutyProgress", () => ({
  CockpitOnDutyProgress: () => <div data-testid="cockpit-on-duty-progress" />,
}));

vi.mock("@/components/dashboard/cockpit/CockpitRiskQueues", () => ({
  CockpitRiskQueues: () => <div data-testid="cockpit-risk-queues" />,
}));

vi.mock("@/components/dashboard/cockpit/CockpitActionRail", () => ({
  CockpitActionRail: () => <div data-testid="cockpit-action-rail" />,
}));

// CockpitQuickActions renders DailyNoteSheet, which needs WorkspaceProvider.
// CockpitDateAnchor touches DashboardContext. Mock both to keep this a pure
// render-composition test.
vi.mock("@/components/dashboard/cockpit/CockpitQuickActions", () => ({
  CockpitQuickActions: () => <div data-testid="cockpit-quick-actions" />,
}));

vi.mock("@/components/dashboard/cockpit/CockpitDateAnchor", () => ({
  CockpitDateAnchor: () => <div data-testid="cockpit-date-anchor" />,
}));

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
        upcomingTasks: 0,
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
  it("renders all four V1 slices", () => {
    const html = renderToStaticMarkup(<HospitalityOperationsCockpit />);

    expect(html).toContain('data-testid="cockpit-top-strip"');
    expect(html).toContain('data-testid="cockpit-risk-queues"');
    expect(html).toContain('data-testid="cockpit-on-duty-progress"');
    expect(html).toContain('data-testid="cockpit-action-rail"');
    // cockpit-activity-feed was removed from the cockpit in a prior refactor
  });
});
