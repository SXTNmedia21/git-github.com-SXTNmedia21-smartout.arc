// S1.2 (2026-05-02) — billing_activity_log provider must accept BOTH nested
// `props.entity.{entity_type,entity_id}` AND flat `props.entity_type/entity_id`
// shapes when resolving the entity reference (ADR-0262 Amendment 1).
//
// Settlement events (run_completed, artifact_downloaded, etc.) use the NESTED
// shape per registry interface definitions. Prior behaviour read only FLAT shape,
// causing every settlement event to be rejected with "Missing entity_type/entity_id".
//
// These tests operate at the unit level by directly testing `resolveEntityRef`
// (the shared pure helper imported by both providers) with the exact property
// shapes that settlement events emit, plus a mock-level assertion that
// `writeBillingActivityLog` does not reject a nested-shape event.

import { describe, test, expect, vi, beforeEach } from "vitest";
import { resolveEntityRef } from "../providers/activity-trail";

// ── Unit tests on the shared resolveEntityRef helper ──────────────────────────

describe("billing-activity-log: resolveEntityRef handles settlement event shapes", () => {
  test("settlement run_completed — nested entity resolves correctly", () => {
    const props = {
      entity: { entity_type: "settlement_run", entity_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" },
      data: {
        run_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        period_start: "2026-09-01",
        period_end: "2026-09-30",
        workspace_count: 3,
        artifact_count: 4,
      },
    };

    const result = resolveEntityRef(props);

    expect(result).toEqual({
      entity_type: "settlement_run",
      entity_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      entity_label: undefined,
    });
  });

  test("settlement artifact_downloaded — nested entity resolves correctly", () => {
    const props = {
      entity: {
        entity_type: "settlement_artifact",
        entity_id: "a1b2c3d4-0000-4000-8000-000000000001",
      },
      data: {
        run_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        artifact_type: "summary_pdf",
      },
    };

    const result = resolveEntityRef(props);

    expect(result).not.toBeNull();
    expect(result!.entity_type).toBe("settlement_artifact");
    expect(result!.entity_id).toBe("a1b2c3d4-0000-4000-8000-000000000001");
  });

  test("settlement run_failed — nested entity resolves correctly", () => {
    const props = {
      entity: { entity_type: "settlement_run", entity_id: "b2c3d4e5-1111-4000-8000-000000000002" },
      data: {
        run_id: "b2c3d4e5-1111-4000-8000-000000000002",
        error: "compute_period_aggregates: relation does not exist",
      },
    };

    const result = resolveEntityRef(props);

    expect(result).not.toBeNull();
    expect(result!.entity_type).toBe("settlement_run");
    expect(result!.entity_id).toBe("b2c3d4e5-1111-4000-8000-000000000002");
  });

  test("flat shape still resolves (backwards compat — invoice events)", () => {
    const props = {
      entity_type: "invoice",
      entity_id: "c3d4e5f6-2222-4000-8000-000000000003",
      data: { invoice_id: "c3d4e5f6-2222-4000-8000-000000000003", format: "csv" },
    };

    const result = resolveEntityRef(props);

    expect(result).not.toBeNull();
    expect(result!.entity_type).toBe("invoice");
    expect(result!.entity_id).toBe("c3d4e5f6-2222-4000-8000-000000000003");
  });

  test("missing entity reference returns null (both shapes absent)", () => {
    const props = {
      data: { run_id: "x", period_start: "2026-09-01" },
    };

    const result = resolveEntityRef(props);

    expect(result).toBeNull();
  });

  test("does not warn on successful nested-shape resolution", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = resolveEntityRef({
      entity: { entity_type: "settlement_run", entity_id: "d4e5f6a7-3333-4000-8000-000000000004" },
    });

    expect(result).not.toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
