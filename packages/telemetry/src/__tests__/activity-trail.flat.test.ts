// S1.1 (2026-04-22) — Condition C-2 (Gate A): activity_trail must accept
// BOTH nested `props.entity` (legacy shape) AND flat
// `props.entity_type/_id/_label` (new FLAT convention, used by ADR-0175
// journey events). Prior behaviour silently returned on flat shape, which
// would have dropped every journey.* activity_trail write.
//
// These assertions guard the pure `resolveEntityRef()` helper so the
// regression cannot return without a visible test failure.

import { describe, test, expect, vi } from "vitest";
import { resolveEntityRef } from "../providers/activity-trail";

describe("activity-trail: resolveEntityRef accepts both shapes", () => {
  test("nested props.entity resolves (legacy)", () => {
    const resolved = resolveEntityRef({
      entity: {
        entity_type: "shift",
        entity_id: "shift-123",
        entity_label: "Tuesday 18:00 - Kitchen",
      },
      data: { name: "Test" },
    });

    expect(resolved).toEqual({
      entity_type: "shift",
      entity_id: "shift-123",
      entity_label: "Tuesday 18:00 - Kitchen",
    });
  });

  test("flat entity_type/entity_id/entity_label resolves (journey events, ADR-0175)", () => {
    const resolved = resolveEntityRef({
      journey_version_id: "jv-1",
      run_id: "run-abc",
      actor_id: "actor-1",
      workspace_id: "ws-1",
      capability: "journey.run_dev",
      surface: "dev",
      entity_type: "journey_run",
      entity_id: "run-abc",
      entity_label: "Dev run: onboarding",
    });

    expect(resolved).toEqual({
      entity_type: "journey_run",
      entity_id: "run-abc",
      entity_label: "Dev run: onboarding",
    });
  });

  test("nested block wins when both shapes are present", () => {
    const resolved = resolveEntityRef({
      entity: {
        entity_type: "shift",
        entity_id: "shift-nested",
        entity_label: "nested-wins",
      },
      entity_type: "journey_run",
      entity_id: "flat-loses",
      entity_label: "flat-loses",
    });

    expect(resolved?.entity_id).toBe("shift-nested");
    expect(resolved?.entity_type).toBe("shift");
  });

  test("missing both shapes returns null (will warn + reject in provider)", () => {
    const resolved = resolveEntityRef({ data: { note: "no entity anywhere" } });
    expect(resolved).toBeNull();
  });

  test("half-flat (only entity_type, missing entity_id) returns null", () => {
    const resolved = resolveEntityRef({ entity_type: "journey_run" });
    expect(resolved).toBeNull();
  });

  test("half-flat (only entity_id, missing entity_type) returns null", () => {
    const resolved = resolveEntityRef({ entity_id: "run-abc" });
    expect(resolved).toBeNull();
  });

  test("entity_label is optional in both shapes", () => {
    const fromNested = resolveEntityRef({
      entity: { entity_type: "journey_run", entity_id: "run-1" },
    });
    const fromFlat = resolveEntityRef({
      entity_type: "journey_run",
      entity_id: "run-1",
    });

    expect(fromNested).toEqual({
      entity_type: "journey_run",
      entity_id: "run-1",
      entity_label: undefined,
    });
    expect(fromFlat).toEqual({
      entity_type: "journey_run",
      entity_id: "run-1",
      entity_label: undefined,
    });
  });

  test("does not warn on successful flat-shape resolution", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const resolved = resolveEntityRef({
      entity_type: "journey_run",
      entity_id: "run-abc",
    });
    expect(resolved).not.toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
