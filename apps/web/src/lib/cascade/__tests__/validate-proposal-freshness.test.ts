import { describe, it, expect } from "vitest";
import { validateProposalFreshness, computeStateHash } from "../validate-proposal-freshness";
import type { ChangeProposalRow } from "../types";

describe("computeStateHash", () => {
  it("produces consistent SHA-256 hash for same input", async () => {
    const state = { hours: [{ id: "1", open: "10:00" }], shifts: [] };
    const hash1 = await computeStateHash(state);
    const hash2 = await computeStateHash(state);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("produces different hash for different input", async () => {
    const state1 = { hours: [{ id: "1", open: "10:00" }] };
    const state2 = { hours: [{ id: "1", open: "11:00" }] };
    const hash1 = await computeStateHash(state1);
    const hash2 = await computeStateHash(state2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("validateProposalFreshness", () => {
  it("returns fresh when hashes match", async () => {
    const state = { hours: [{ id: "1", open: "10:00" }] };
    const hash = await computeStateHash(state);
    const proposal: ChangeProposalRow = {
      changeProposalId: "p1",
      inputStateHash: hash,
      status: "pending",
      createdAt: "2026-04-07T10:00:00Z",
    };

    const result = validateProposalFreshness(proposal, hash);
    expect(result.fresh).toBe(true);
    expect(result.staleFields).toHaveLength(0);
  });

  it("returns stale when hashes differ", async () => {
    const hash = await computeStateHash({ hours: [{ id: "1", open: "10:00" }] });
    const proposal: ChangeProposalRow = {
      changeProposalId: "p1",
      inputStateHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "pending",
      createdAt: "2026-04-07T10:00:00Z",
    };

    const result = validateProposalFreshness(proposal, hash);
    expect(result.fresh).toBe(false);
    expect(result.staleFields.length).toBeGreaterThan(0);
  });

  it("returns stale when proposal has no hash", async () => {
    const hash = await computeStateHash({ any: "state" });
    const proposal: ChangeProposalRow = {
      changeProposalId: "p1",
      inputStateHash: null,
      status: "pending",
      createdAt: "2026-04-07T10:00:00Z",
    };

    const result = validateProposalFreshness(proposal, hash);
    expect(result.fresh).toBe(false);
  });
});
