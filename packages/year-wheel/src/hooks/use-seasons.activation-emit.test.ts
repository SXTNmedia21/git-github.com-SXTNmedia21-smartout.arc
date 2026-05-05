// B2 / ADR-0212 — Season status-change single-emit-source invariant.
//
// Asserts that `use-seasons.ts` does NOT call `emit({event: "season activated"})`.
// The DB trigger `trg_season_activated` (`20260428100001_season_activation_trigger.sql`)
// is the sole emitter for `season.status='active'` transitions — extending ADR-0187
// from `department_session.status` to `season.status`.
//
// Re-introducing the application-layer emit creates dual emission with
// divergent event-names (`season.activated` dot from trigger vs
// `season activated` space from registry) and double-fires downstream
// consumers. This test fails if the inline emit comes back.
//
// Updated 2026-04-29: per ADR-0200 §Cutover (L-0098 flip) the `activateSeason`
// client-side mutation was deleted; callers invoke `activateSeasonAction` Server
// Action directly. Per M5.3 cleanup the `archiveSeason` client mutation was also
// deleted; callers invoke `archiveSeasonAction` Server Action (which emits
// `season archived` server-side at archive-season-action.ts:89). Test no longer
// pins those mutations as present in the hook — instead pins the static shape:
// (a) NO `season activated` emit anywhere in hook, (b) NO `season archived` emit
// in hook (moved to Server Action — re-introducing it would create dual emission
// like ADR-0212 closed for activation), (c) hook retains client-side emits that
// DID stay (`season created`, `season updated`).
//
// Static-analysis shape (matching `registry.journey.test.ts` convention):
// vitest-node cannot render a React hook without `@testing-library/react`
// + happy-dom — both are not dev deps of `@smartout/year-wheel` and
// adding them for one assertion is out of scope for B2. Reading the
// source file and asserting on its textual shape is the cheapest
// deterministic gate and mirrors how the telemetry-registry contract
// tests work.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect } from "vitest";

const HOOK_PATH = resolve(__dirname, "use-seasons.ts");
const SOURCE = readFileSync(HOOK_PATH, "utf-8");

// Strip both line comments and block comments so emits inside ADR-referencing
// comment blocks don't trip the regex (the hook contains long //-prefixed and
// /* ... */ ADR notes on the deleted mutations).
const STRIPPED = (() => {
  const noLine = SOURCE.split("\n")
    .filter((line) => !/^\s*(?:\/\/|\*)/.test(line))
    .join("\n");
  return noLine.replace(/\/\*[\s\S]*?\*\//g, "");
})();

describe("ADR-0212 — season activation single-emit-source invariant", () => {
  test('use-seasons.ts contains no `emit({event: "season activated"})` call', () => {
    const pattern = /event\s*:\s*['"]season activated['"]/;
    expect(pattern.test(STRIPPED)).toBe(false);
  });

  test('use-seasons.ts contains no `emit({event: "season archived"})` call (moved to archiveSeasonAction Server Action per M5.3)', () => {
    // Per M5.3 cleanup the `archiveSeason` client mutation was deleted because
    // it bypassed `gateAction` (ADR-0099/0196 violation). The single canonical
    // emit lives at apps/web/src/app/dashboard/_actions/archive-season-action.ts:89.
    // Re-introducing the inline emit here would create dual emission like
    // ADR-0212 closed for `season activated`.
    const pattern = /event\s*:\s*['"]season archived['"]/;
    expect(pattern.test(STRIPPED)).toBe(false);
  });

  test("use-seasons.ts retains `emit` calls for non-status client mutations (create/update)", () => {
    // Guard against an over-eager refactor that wipes all emits.
    // `season created` and `season updated` are NOT backed by DB triggers AND
    // their mutations stayed client-side — they MUST keep their application-layer
    // emits per ADR-0212 §"Scope of state-change events".
    expect(STRIPPED).toMatch(/event\s*:\s*["']season created["']/);
    expect(STRIPPED).toMatch(/event\s*:\s*["']season updated["']/);
  });
});
