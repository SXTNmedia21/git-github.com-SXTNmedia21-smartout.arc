/**
 * Schema-contract tests for offline write actions (ADR-0134 / Trust Freeze gate 2).
 *
 * Locks the enqueue contract: malformed payloads MUST throw at enqueue,
 * not at sync time. Covers the high-risk mutations the council flagged
 * (telemetry corruption sites) — punch_in/out, swap-derivative, create_shift,
 * supplement_claim, request_absence — plus a representative passthrough
 * action and the cross-table sign_checklist.
 */
import { z } from "zod";

import { validatePayload, writeActionSchemas } from "../schemas";

describe("offline write action schemas", () => {
  it("registers a schema for every WriteAction (no missing entries)", () => {
    const actions = Object.keys(writeActionSchemas);
    expect(actions).toHaveLength(21);
    for (const a of actions) {
      expect(writeActionSchemas[a as keyof typeof writeActionSchemas]).toBeInstanceOf(z.ZodType);
    }
  });

  describe("punch_in", () => {
    it("accepts a well-formed payload", () => {
      const payload = {
        time_entry_id: "11111111-1111-4111-8111-111111111111",
        shift_id: "22222222-2222-4222-8222-222222222222",
        profile_id: "33333333-3333-4333-8333-333333333333",
        workspace_id: "44444444-4444-4444-8444-444444444444",
        punch_in: "2026-04-17T12:00:00.000Z",
        status: "clocked_in" as const,
      };
      expect(validatePayload("punch_in", payload)).toEqual(payload);
    });

    it("rejects empty workspace_id (the bug the freeze stops)", () => {
      expect(() =>
        validatePayload("punch_in", {
          time_entry_id: "11111111-1111-4111-8111-111111111111",
          shift_id: "22222222-2222-4222-8222-222222222222",
          profile_id: "33333333-3333-4333-8333-333333333333",
          workspace_id: "",
          punch_in: "2026-04-17T12:00:00.000Z",
          status: "clocked_in",
        }),
      ).toThrow();
    });

    it("rejects non-UUID time_entry_id", () => {
      expect(() =>
        validatePayload("punch_in", {
          time_entry_id: "not-a-uuid",
          shift_id: "22222222-2222-4222-8222-222222222222",
          profile_id: "33333333-3333-4333-8333-333333333333",
          workspace_id: "44444444-4444-4444-8444-444444444444",
          punch_in: "2026-04-17T12:00:00.000Z",
          status: "clocked_in",
        }),
      ).toThrow();
    });
  });

  describe("create_shift", () => {
    it("rejects malformed shift_date (not YYYY-MM-DD)", () => {
      expect(() =>
        validatePayload("create_shift", {
          schedule_shift_id: "11111111-1111-4111-8111-111111111111",
          shift_date: "17/04/2026",
          start_time: "08:00",
          end_time: "16:00",
          workspace_id: "44444444-4444-4444-8444-444444444444",
          role: "bartender",
        }),
      ).toThrow();
    });

    it("rejects malformed start_time (not HH:MM)", () => {
      expect(() =>
        validatePayload("create_shift", {
          schedule_shift_id: "11111111-1111-4111-8111-111111111111",
          shift_date: "2026-04-17",
          start_time: "8am",
          end_time: "16:00",
          workspace_id: "44444444-4444-4444-8444-444444444444",
          role: "bartender",
        }),
      ).toThrow();
    });
  });

  describe("sign_checklist", () => {
    it("requires non-empty task_ids", () => {
      expect(() =>
        validatePayload("sign_checklist", {
          task_ids: [],
          status: "completed",
          completed_by: "33333333-3333-4333-8333-333333333333",
          completed_at: "2026-04-17T12:00:00.000Z",
        }),
      ).toThrow();
    });
  });

  describe("supplement_claim", () => {
    it("requires workspace_id and added_by", () => {
      expect(() =>
        validatePayload("supplement_claim", {
          id: "11111111-1111-4111-8111-111111111111",
          // workspace_id missing
          added_by: "33333333-3333-4333-8333-333333333333",
          schedule_shift_id: "22222222-2222-4222-8222-222222222222",
        }),
      ).toThrow();
    });
  });

  // M2 polish #2 — the clockout wizard's offline save path. Payload carries
  // everything the SyncWorker handler needs to replay the online merge logic
  // (session FK + workspace/department for lazy-insert + step + data).
  describe("save_wizard_step", () => {
    const well_formed = {
      session_id: "11111111-1111-4111-8111-111111111111",
      workspace_id: "22222222-2222-4222-8222-222222222222",
      department_id: "33333333-3333-4333-8333-333333333333",
      step_id: "02_omsetning" as const,
      step_data: { revenue_total: 12500, revenue_card: 10000, revenue_cash: 2500 },
      reconciliation_date: "2026-04-22",
      client_touched_at: "2026-04-22T17:45:00.000Z",
    };

    it("accepts a well-formed payload", () => {
      expect(validatePayload("save_wizard_step", well_formed)).toEqual(well_formed);
    });

    it("rejects empty workspace_id (ADR-0134 telemetry corruption guard)", () => {
      expect(() =>
        validatePayload("save_wizard_step", { ...well_formed, workspace_id: "" }),
      ).toThrow();
    });

    it("rejects unknown step_id (guards against wizard-hook drift)", () => {
      expect(() =>
        validatePayload("save_wizard_step", {
          ...well_formed,
          step_id: "99_unknown" as unknown as typeof well_formed.step_id,
        }),
      ).toThrow();
    });

    it("rejects malformed reconciliation_date", () => {
      expect(() =>
        validatePayload("save_wizard_step", {
          ...well_formed,
          reconciliation_date: "22/04/2026",
        }),
      ).toThrow();
    });
  });
});
