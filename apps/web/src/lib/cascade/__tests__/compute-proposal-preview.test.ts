import { describe, it, expect } from "vitest";
import { computeProposalPreview } from "../compute-proposal-preview";
import type { ProposalPreviewInput } from "../compute-proposal-preview";

function makeInput(overrides: Partial<ProposalPreviewInput> = {}): ProposalPreviewInput {
  return {
    changeType: "workspace_hours",
    proposedChange: {
      dayOfWeek: 0,
      openTime: "10:00",
      closeTime: "22:00",
    },
    departments: [],
    futureSessions: [],
    futureShifts: [],
    ...overrides,
  };
}

describe("computeProposalPreview", () => {
  it("returns empty preview when no departments affected", () => {
    const result = computeProposalPreview(makeInput());
    expect(result.affectedDepartments).toHaveLength(0);
    expect(result.affectedSessions).toHaveLength(0);
    expect(result.autoAdjustShifts).toHaveLength(0);
    expect(result.impactedConfirmedShifts).toHaveLength(0);
  });

  it("lists derived departments as affected on workspace hours change", () => {
    const result = computeProposalPreview(
      makeInput({
        departments: [
          {
            departmentId: "d1",
            name: "Kjøkken",
            departmentType: "operational",
            isDerived: true,
            openOffsetMinutes: -120,
            closeOffsetMinutes: 0,
          },
          {
            departmentId: "d2",
            name: "Kontor",
            departmentType: "administrative",
            isDerived: false,
            openOffsetMinutes: 0,
            closeOffsetMinutes: 0,
          },
        ],
      }),
    );

    expect(result.affectedDepartments).toHaveLength(1);
    expect(result.affectedDepartments[0].departmentId).toBe("d1");
  });

  it("lists affected future sessions", () => {
    const result = computeProposalPreview(
      makeInput({
        departments: [
          {
            departmentId: "d1",
            name: "Sal",
            departmentType: "operational",
            isDerived: true,
            openOffsetMinutes: -60,
            closeOffsetMinutes: 0,
          },
        ],
        futureSessions: [
          { sessionId: "s1", departmentId: "d1", sessionDate: "2026-04-01", status: "upcoming" },
          { sessionId: "s2", departmentId: "d1", sessionDate: "2026-04-02", status: "upcoming" },
          { sessionId: "s3", departmentId: "d2", sessionDate: "2026-04-01", status: "upcoming" },
        ],
      }),
    );

    expect(result.affectedSessions).toHaveLength(2);
  });

  it("separates auto-adjust shifts from impacted confirmed shifts", () => {
    const result = computeProposalPreview(
      makeInput({
        departments: [
          {
            departmentId: "d1",
            name: "Bar",
            departmentType: "operational",
            isDerived: true,
            openOffsetMinutes: 0,
            closeOffsetMinutes: 0,
          },
        ],
        futureShifts: [
          { shiftId: "sh1", departmentId: "d1", status: "created", date: "2026-04-01" },
          { shiftId: "sh2", departmentId: "d1", status: "assigned", date: "2026-04-01" },
          { shiftId: "sh3", departmentId: "d1", status: "confirmed", date: "2026-04-01" },
          { shiftId: "sh4", departmentId: "d1", status: "published", date: "2026-04-01" },
        ],
      }),
    );

    expect(result.autoAdjustShifts).toHaveLength(2); // created + assigned
    expect(result.impactedConfirmedShifts).toHaveLength(2); // confirmed + published
  });

  it("does not include past sessions", () => {
    const result = computeProposalPreview(
      makeInput({
        departments: [
          {
            departmentId: "d1",
            name: "Sal",
            departmentType: "operational",
            isDerived: true,
            openOffsetMinutes: 0,
            closeOffsetMinutes: 0,
          },
        ],
        futureSessions: [
          { sessionId: "s1", departmentId: "d1", sessionDate: "2026-04-01", status: "upcoming" },
          { sessionId: "s2", departmentId: "d1", sessionDate: "2026-04-01", status: "closed" },
        ],
      }),
    );

    expect(result.affectedSessions).toHaveLength(1);
  });
});
