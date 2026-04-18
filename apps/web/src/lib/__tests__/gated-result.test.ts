/**
 * gated-result.test.ts
 *
 * Contract tests for `handleGatedResult` — the three-branch dispatcher
 * consumers use to render gated Server Action outcomes.
 *
 * One test per branch:
 *   1. applied   — success toast + onApplied
 *   2. proposed  — info toast + onProposed(proposalId)
 *   3. denied    — error toast + onDenied(error)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// Import AFTER the mock registration so the module picks up the mocked toast.
import { handleGatedResult } from "../gated-result";

describe("handleGatedResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applied branch — fires success toast and onApplied callback", () => {
    const onApplied = vi.fn();
    const onProposed = vi.fn();
    const onDenied = vi.fn();

    handleGatedResult(
      { ok: true },
      {
        appliedMessage: "Rolle oppdatert",
        onApplied,
        onProposed,
        onDenied,
      },
    );

    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith("Rolle oppdatert");
    expect(toastMock.info).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onProposed).not.toHaveBeenCalled();
    expect(onDenied).not.toHaveBeenCalled();
  });

  it("proposed branch — fires info toast and onProposed with proposal id", () => {
    const onApplied = vi.fn();
    const onProposed = vi.fn();
    const onDenied = vi.fn();

    handleGatedResult(
      { ok: true, pendingProposal: "proposal-123" },
      {
        appliedMessage: "Rolle oppdatert",
        proposedMessage: "Rolleendring sendt til godkjenning",
        onApplied,
        onProposed,
        onDenied,
      },
    );

    expect(toastMock.info).toHaveBeenCalledTimes(1);
    expect(toastMock.info).toHaveBeenCalledWith("Rolleendring sendt til godkjenning", {
      description: "Endringen er sendt til godkjenning",
    });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(onProposed).toHaveBeenCalledTimes(1);
    expect(onProposed).toHaveBeenCalledWith("proposal-123");
    expect(onApplied).not.toHaveBeenCalled();
    expect(onDenied).not.toHaveBeenCalled();
  });

  it("proposed branch — falls back to default Norwegian copy when proposedMessage omitted", () => {
    handleGatedResult({ ok: true, pendingProposal: "proposal-456" }, { appliedMessage: "Applied" });

    expect(toastMock.info).toHaveBeenCalledWith("Krever godkjenning", {
      description: "Endringen er sendt til godkjenning",
    });
  });

  it("denied branch — fires error toast and onDenied with error string", () => {
    const onApplied = vi.fn();
    const onProposed = vi.fn();
    const onDenied = vi.fn();

    handleGatedResult(
      { ok: false, error: "Governance denied the update" },
      {
        appliedMessage: "Rolle oppdatert",
        onApplied,
        onProposed,
        onDenied,
      },
    );

    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(toastMock.error).toHaveBeenCalledWith("Governance denied the update");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.info).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(onDenied).toHaveBeenCalledWith("Governance denied the update");
    expect(onApplied).not.toHaveBeenCalled();
    expect(onProposed).not.toHaveBeenCalled();
  });

  it("denied branch — applies deniedMessage transform when provided", () => {
    handleGatedResult(
      { ok: false, error: "raw-error" },
      {
        appliedMessage: "Applied",
        deniedMessage: (err) => `Kunne ikke oppdatere rolle: ${err}`,
      },
    );

    expect(toastMock.error).toHaveBeenCalledWith("Kunne ikke oppdatere rolle: raw-error");
  });
});
