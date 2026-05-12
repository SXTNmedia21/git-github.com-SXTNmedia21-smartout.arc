import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

/**
 * Cascade Bootstrap Verification
 *
 * Verifies I1 bootstrap artifacts exist for the HQ seed workspace.
 *
 * K1a Platform Data — seeded by migrations (framework, rules, triggers, platform tariffs)
 * Workspace Data — seeded by seed.sql (day_factor, hour_factor, framework_binding)
 * Engine Wiring — seeded by migrations (engine_process, engine_trigger for cascade)
 */

const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

// ── K1a Platform Data (from migrations) ─────────────────────────────────

test.describe("Cascade K1a — Platform Framework", () => {
  test("regulatory_framework exists for hospitality", async () => {
    const { data, error } = await supabase
      .from("regulatory_framework")
      .select("framework_id, code, name, version")
      .eq("code", "hospitality.no.default.v1");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
    expect(data![0]!.version).toBeTruthy();
  });

  test("framework has 18+ rules seeded", async () => {
    const { data: fwks } = await supabase
      .from("regulatory_framework")
      .select("framework_id")
      .eq("code", "hospitality.no.default.v1")
      .limit(1);

    expect(fwks).not.toBeNull();
    expect(fwks!.length).toBeGreaterThanOrEqual(1);
    const frameworkId = fwks![0]!.framework_id;

    const { data: rules, error } = await supabase
      .from("framework_rule")
      .select("rule_id, code, category")
      .eq("framework_id", frameworkId);

    expect(error).toBeNull();
    expect(rules!.length).toBeGreaterThanOrEqual(18);

    const categories = new Set(rules!.map((r) => r.category));
    expect(categories.has("working_time")).toBe(true);
    expect(categories.has("rest")).toBe(true);
    expect(categories.has("compensation")).toBe(true);
  });

  test("framework has 7 triggers seeded", async () => {
    const { data: fwks } = await supabase
      .from("regulatory_framework")
      .select("framework_id")
      .eq("code", "hospitality.no.default.v1")
      .limit(1);

    expect(fwks).not.toBeNull();
    expect(fwks!.length).toBeGreaterThanOrEqual(1);
    const frameworkId = fwks![0]!.framework_id;

    const { data: triggers, error } = await supabase
      .from("framework_trigger")
      .select("trigger_id, code, trigger_mode")
      .eq("framework_id", frameworkId);

    expect(error).toBeNull();
    expect(triggers!.length).toBeGreaterThanOrEqual(7);

    const codes = new Set(triggers!.map((t) => t.code));
    expect(codes.has("trigger.shift_created")).toBe(true);
    expect(codes.has("trigger.shift_published")).toBe(true);
    expect(codes.has("trigger.shift_completed")).toBe(true);
  });

  test("platform tariff rates seeded (NULL workspace_id)", async () => {
    // Pin to 2025-04-01 rows (Riksavtalen mellomoppgjør) — both 2024 and 2025 rows
    // coexist after migration 20260527101400 capped 2024 rows at 2025-03-31.
    // Without effective_from filter, .find() returns whichever row Supabase
    // returns first (indeterminate order), causing flaky assertions.
    const { data, error } = await supabase
      .from("tariff_rate_table")
      .select("id, rate_type, amount, unit, effective_from")
      .is("workspace_id", null)
      .eq("effective_from", "2025-04-01");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(3);

    // Riksavtalen 2025-mellomoppgjør rates (effective 2025-04-01)
    const kveld = data!.find((r) => r.rate_type === "kveldstillegg");
    expect(kveld).toBeTruthy();
    expect(kveld!.amount).toBe(16.01);
    expect(kveld!.unit).toBe("kr/t");

    const helg = data!.find((r) => r.rate_type === "helgetillegg");
    expect(helg).toBeTruthy();
    expect(helg!.amount).toBe(30.42);
  });
});

// ── Workspace Data (from seed.sql) ──────────────────────────────────────

test.describe("Cascade Workspace — HQ Seed Data", () => {
  test("workspace_framework_binding exists and is active", async () => {
    const { data, error } = await supabase
      .from("workspace_framework_binding")
      .select("id, framework_id, is_active")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("is_active", true);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  test("day_factor has 7 entries (Mon-Sun)", async () => {
    const { data, error } = await supabase
      .from("day_factor")
      .select("day_factor_id, weekday, factor")
      .eq("workspace_id", HQ_WORKSPACE_ID);

    expect(error).toBeNull();
    expect(data!.length).toBe(7);

    const weekdays = new Set(data!.map((d) => d.weekday));
    for (let i = 0; i <= 6; i++) {
      expect(weekdays.has(i)).toBe(true);
    }
  });

  test("hour_factor entries exist", async () => {
    const { data, error } = await supabase
      .from("hour_factor")
      .select("hour_factor_id, hour, factor")
      .eq("workspace_id", HQ_WORKSPACE_ID);

    expect(error).toBeNull();
    // Seed provides 12 entries (peak hours); bootstrap fills all 24.
    // Verify at least the seed data is present.
    expect(data!.length).toBeGreaterThanOrEqual(12);

    for (const d of data!) {
      expect(d.hour).toBeGreaterThanOrEqual(0);
      expect(d.hour).toBeLessThanOrEqual(23);
      expect(d.factor).toBeGreaterThan(0);
    }
  });
});

// ── Engine Wiring (from cascade migrations) ─────────────────────────────

test.describe("Cascade Engine — Process & Trigger Wiring", () => {
  test("engine process definitions exist for cascade", async () => {
    const { data, error } = await supabase
      .from("engine_process")
      .select("id, name")
      .in("id", ["cascade_cost_snapshot", "cascade_budget_propagation"]);

    expect(error).toBeNull();
    expect(data!.length).toBe(2);
  });

  test("engine triggers wired for shift.published and shift.completed", async () => {
    const { data, error } = await supabase
      .from("engine_trigger")
      .select("id, event_type, process_id")
      .eq("process_id", "cascade_cost_snapshot");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(2);

    const events = new Set(data!.map((t) => t.event_type));
    expect(events.has("shift.published")).toBe(true);
    expect(events.has("shift.completed")).toBe(true);
  });

  test("engine triggers wired for budget propagation", async () => {
    const { data, error } = await supabase
      .from("engine_trigger")
      .select("id, event_type, process_id")
      .eq("process_id", "cascade_budget_propagation");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(2);

    const events = new Set(data!.map((t) => t.event_type));
    expect(events.has("season_budget.updated")).toBe(true);
    expect(events.has("day_factors.updated")).toBe(true);
  });
});
