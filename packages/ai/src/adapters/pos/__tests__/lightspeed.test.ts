/**
 * packages/ai/src/adapters/pos/__tests__/lightspeed.test.ts
 *
 * Vitest tests for the mock Lightspeed K-Series adapter (Task 1).
 *
 * Four tests per plan:
 *   1. Deterministic: same inputs → identical output.
 *   2. Returns array of SaleEvent with correct shape.
 *   3. Respects since filter (events before since are excluded).
 *   4. Handles null since (returns events going back 24 h).
 */

import { describe, it, expect } from "vitest";
import { pull } from "../lightspeed.js";
import type { PosAccount } from "../lightspeed.js";

const mockAccount: PosAccount = {
  pos_account_id: "aaaaaaaa-0000-0000-0000-000000000001",
  workspace_id: "b0000000-0000-0000-0000-000000000001",
  vendor: "lightspeed_kseries",
  external_account_id: "ls-test-account-1",
  credentials: "mock-token-v1", // resolved by caller; unused in mock
  sync_state: {},
  last_synced_at: null,
};

describe("lightspeed mock adapter", () => {
  it("is deterministic: same inputs produce identical output", async () => {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12h ago
    const syncRunId = "test-run-determinism-01";

    const run1 = await pull(mockAccount, since, syncRunId);
    const run2 = await pull(mockAccount, since, syncRunId);

    // Count must match.
    expect(run1.length).toBe(run2.length);

    // Every field must be identical across runs.
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]).toEqual(run2[i]);
    }
  });

  it("returns SaleEvent array with correct shape and value constraints", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const events = await pull(mockAccount, since, "test-run-shape-01");

    // Between 5 and 15 events.
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.length).toBeLessThanOrEqual(15);

    for (const e of events) {
      expect(e.vendor).toBe("lightspeed_kseries");
      expect(typeof e.external_event_id).toBe("string");
      expect(e.external_event_id.startsWith("lk-")).toBe(true);
      expect(typeof e.occurred_at).toBe("string");
      // Parseable ISO timestamp
      expect(Number.isNaN(new Date(e.occurred_at).getTime())).toBe(false);
      // Gross in [10000, 50000] (minor NOK = øre)
      expect(e.gross_amount_minor).toBeGreaterThanOrEqual(10000);
      expect(e.gross_amount_minor).toBeLessThanOrEqual(50000);
      // Net is 80% of gross (floored)
      expect(e.net_amount_minor).toBe(Math.floor(e.gross_amount_minor * 0.8));
      expect(e.currency).toBe("NOK");
      expect(e.item_count).toBeGreaterThanOrEqual(1);
      expect(e.item_count).toBeLessThanOrEqual(5);
      expect(e.raw_payload).toMatchObject({ mock: true });
    }
  });

  it("respects since filter: returned events have occurred_at >= since", async () => {
    // Use a very recent since (5 minutes ago) to test boundary.
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const sinceMs = new Date(since).getTime();

    const events = await pull(mockAccount, since, "test-run-since-filter-01");

    // All returned events must be at or after since.
    for (const e of events) {
      const occurredMs = new Date(e.occurred_at).getTime();
      expect(occurredMs).toBeGreaterThanOrEqual(sinceMs);
    }
  });

  it("handles null since: returns events with occurred_at in last 24 h", async () => {
    const before = Date.now();
    const events = await pull(mockAccount, null, "test-run-null-since-01");

    // Should still return 5–15 events.
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.length).toBeLessThanOrEqual(15);

    const twentyFourHoursAgoMs = before - 24 * 60 * 60 * 1000;
    for (const e of events) {
      const occurredMs = new Date(e.occurred_at).getTime();
      // Events should be within the last 24 h window (±1 s tolerance for test timing).
      expect(occurredMs).toBeGreaterThanOrEqual(twentyFourHoursAgoMs - 1000);
      expect(occurredMs).toBeLessThanOrEqual(before + 1000);
    }
  });
});
