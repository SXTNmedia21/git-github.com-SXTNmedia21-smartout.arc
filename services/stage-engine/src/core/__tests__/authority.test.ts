// ============================================
// authority.test.ts
//
// Pure-reducer tests for `buildAuthorityConfig` — the ADR-0195 / L-0122 fix.
//
// WHY A PURE REDUCER: The original loader mixed I/O (Supabase) with the
// base-key fold logic. The fold was the defect: for `journey.*` rows it
// collapsed four seeded levels into one non-deterministic `levels["journey"]`
// entry, because `.select()` had no `ORDER BY`. Extracting a pure reducer
// lets us drive it with deliberately shuffled rows and assert determinism
// without mocking Supabase.
//
// SHORTCUT NOTE: We do NOT exercise the full `loadAuthorityConfig()` I/O
// path here. That's covered by the stage-engine integration smoke. The
// reducer is the only non-trivial logic — asserting the I/O wiring would
// duplicate Supabase's own `.eq()` / `.select()` surface.
// ============================================

import { describe, it, expect, vi } from "vitest";

// Stub out `../lib/supabase.js` so importing `authority.ts` doesn't trigger
// `config.ts`'s env-var Zod parse (which requires ENGINE_URL, SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — none of which are set in
// the test harness). The reducer under test never touches the client.
vi.mock("../../lib/supabase.js", () => ({
  supabaseAdmin: {},
  createUserClient: () => ({}),
}));

import {
  buildAuthorityConfig,
  type AuthorityConfigRow,
  type AuthorityLevel,
} from "../authority.js";

// The seeded journey rows per supabase/migrations/20260516000400_journey_authority_seed.sql
// (S1.3, ADR-0173 / ADR-0176). 3× suggest + 1× autonomous — that mismatch is
// the entire reason ADR-0195 exists. If the loader folds these into a single
// `levels["journey"]` entry, one of the four deliberate levels wins the race.
const journeySeed: AuthorityConfigRow[] = [
  { capability: "journey.run_dev", level: "suggest", min_role: "admin" },
  { capability: "journey.publish_mission", level: "suggest", min_role: "admin" },
  { capability: "journey.publish_guide", level: "suggest", min_role: "admin" },
  { capability: "journey.run_guided", level: "autonomous", min_role: "employee" },
];

/** Deterministic Fisher-Yates shuffle driven by a seed. */
function shuffled<T>(input: ReadonlyArray<T>, seed: number): T[] {
  const out = [...input];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

describe("buildAuthorityConfig — journey family (ADR-0195)", () => {
  it("preserves each journey.* level under its full dotted key", () => {
    const { levels } = buildAuthorityConfig(journeySeed);

    expect(levels["journey.run_dev"]).toBe("suggest");
    expect(levels["journey.publish_mission"]).toBe("suggest");
    expect(levels["journey.publish_guide"]).toBe("suggest");
    expect(levels["journey.run_guided"]).toBe("autonomous");
  });

  it("does NOT fold journey.* rows into a short `journey` key", () => {
    const { levels } = buildAuthorityConfig(journeySeed);

    // The ADR-0195 defect was `levels["journey"]` being populated with
    // whichever dotted row returned first. Post-fix, this key must be
    // absent so every consumer reads the dotted form instead.
    expect(levels).not.toHaveProperty("journey");
  });

  it("is deterministic across 10 shuffled row orders (no non-determinism)", () => {
    // The original Postgres `.select()` had no ORDER BY — row order was
    // undefined. Simulate that by shuffling seeds[0..3] 10× and asserting
    // the output never drifts. Run ALL 10 inside one test so a regression
    // is visible at a glance in CI.
    for (let i = 0; i < 10; i++) {
      const rows = shuffled(journeySeed, 17 + i * 31);
      const { levels } = buildAuthorityConfig(rows);

      expect(levels["journey.run_dev"]).toBe("suggest");
      expect(levels["journey.publish_mission"]).toBe("suggest");
      expect(levels["journey.publish_guide"]).toBe("suggest");
      expect(levels["journey.run_guided"]).toBe("autonomous");
      // And the short key is never synthesised regardless of order.
      expect(levels).not.toHaveProperty("journey");
    }
  });

  it("min_role follows each journey.* row without folding", () => {
    const { minRoles } = buildAuthorityConfig(journeySeed);

    expect(minRoles["journey.run_dev"]).toBe("admin");
    expect(minRoles["journey.publish_mission"]).toBe("admin");
    expect(minRoles["journey.publish_guide"]).toBe("admin");
    expect(minRoles["journey.run_guided"]).toBe("employee");
    // Short key must not exist — the ambiguous fold was the bug.
    expect(minRoles).not.toHaveProperty("journey");
  });
});

describe("buildAuthorityConfig — legacy non-journey fold", () => {
  // For capabilities like `session.*` / `shift.*` the historical behaviour
  // was "first dotted row's level wins the short key". Those capabilities
  // are not consumed via `authorityConfig[name]` lookup in tool-selector
  // today (they're called directly via `callGateAction`), so the fold is
  // a no-op for them — but we keep it to avoid broader blast radius.
  // This test documents that legacy behaviour explicitly.

  it("folds first dotted row's level into the base for non-journey families", () => {
    const rows: AuthorityConfigRow[] = [
      { capability: "session.open", level: "autonomous", min_role: "manager" },
      { capability: "session.signoff", level: "confirm", min_role: "admin" },
    ];
    const { levels, minRoles } = buildAuthorityConfig(rows);

    expect(levels["session.open"]).toBe("autonomous");
    expect(levels["session.signoff"]).toBe("confirm");
    // Legacy fold: first dotted row wins. Guarded path — if a regression
    // flips ordering it surfaces here rather than as a silent CVE-class
    // authority drift.
    expect(levels["session"]).toBe("autonomous");
    expect(minRoles["session"]).toBe("manager");
  });

  it("does not synthesise a short key when the row has no dot", () => {
    const rows: AuthorityConfigRow[] = [
      { capability: "schedule", level: "autonomous", min_role: "manager" },
    ];
    const { levels, minRoles } = buildAuthorityConfig(rows);

    expect(levels["schedule"]).toBe("autonomous");
    expect(minRoles["schedule"]).toBe("manager");
    // No phantom dotted keys synthesised.
    expect(Object.keys(levels)).toEqual(["schedule"]);
  });
});

describe("buildAuthorityConfig — mixed families", () => {
  it("handles journey + session + plain rows in the same workspace", () => {
    const rows: AuthorityConfigRow[] = [
      ...shuffled(journeySeed, 42),
      { capability: "session.open", level: "autonomous", min_role: "manager" },
      { capability: "schedule", level: "suggest", min_role: "employee" },
    ];
    const { levels } = buildAuthorityConfig(rows);

    // Journey: dotted preserved, short absent.
    expect(levels["journey.run_guided"]).toBe("autonomous");
    expect(levels["journey.publish_mission"]).toBe("suggest");
    expect(levels).not.toHaveProperty("journey");

    // Legacy: session dotted + short folded.
    expect(levels["session.open"]).toBe("autonomous");
    expect(levels["session"]).toBe("autonomous");

    // Plain: untouched.
    expect(levels["schedule"]).toBe("suggest");
  });
});

describe("buildAuthorityConfig — empty + degenerate inputs", () => {
  it("returns empty maps for empty input", () => {
    const { levels, minRoles } = buildAuthorityConfig([]);
    expect(levels).toEqual({});
    expect(minRoles).toEqual({});
  });

  it("ignores an empty-capability row by storing it verbatim (never folds)", () => {
    // Degenerate row — `""` has no dot. Should round-trip without
    // synthesising anything weird. Documents the edge so the reducer
    // stays predictable.
    const rows: AuthorityConfigRow[] = [
      { capability: "", level: "read_only" as AuthorityLevel, min_role: "employee" },
    ];
    const { levels } = buildAuthorityConfig(rows);
    expect(levels[""]).toBe("read_only");
    expect(Object.keys(levels)).toEqual([""]);
  });
});
