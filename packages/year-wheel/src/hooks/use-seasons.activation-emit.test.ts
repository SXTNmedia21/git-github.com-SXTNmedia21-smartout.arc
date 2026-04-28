// B2 / ADR-0212 — Season status-change single-emit-source invariant.
//
// Asserts that `use-seasons.ts#activateSeason.onSuccess` does NOT call
// `emit({event: "season activated"})`. The DB trigger `trg_season_activated`
// (`20260428100001_season_activation_trigger.sql`) is the sole emitter for
// `season.status='active'` transitions — extending ADR-0187 from
// `department_session.status` to `season.status`.
//
// Re-introducing the application-layer emit creates dual emission with
// divergent event-names (`season.activated` dot from trigger vs
// `season activated` space from registry) and double-fires downstream
// consumers. This test fails if the inline emit comes back.
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

describe("ADR-0212 — season activation single-emit-source invariant", () => {
  test('use-seasons.ts contains no `emit({event: "season activated"})` call', () => {
    // Matches the full pattern — `event` key followed by the literal string
    // `"season activated"` (either quote style), allowing whitespace and
    // newlines between `event`, `:`, and the literal. Comments containing
    // the string are filtered out by stripping `//`-prefixed lines before
    // the match.
    const withoutLineComments = SOURCE.split("\n")
      .filter((line) => !/^\s*(?:\/\/|\*)/.test(line))
      .join("\n");
    // Also strip /* ... */ block comments (the hook contains a long
    // ADR-referencing comment block on the activation branch).
    const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, "");

    const pattern = /event\s*:\s*['"]season activated['"]/;
    expect(pattern.test(withoutBlockComments)).toBe(false);
  });

  test("use-seasons.ts still has the `activateSeason` mutation (not a false-positive from deletion)", () => {
    // Sanity: ensures we're testing the right file shape. If someone
    // deletes the entire mutation the previous test also passes, so this
    // pins the mutation is present.
    expect(SOURCE).toMatch(/const\s+activateSeason\s*=\s*useMutation/);
  });

  test("use-seasons.ts retains `emit` calls for non-status events (create/archive/update)", () => {
    // Guard against an over-eager refactor that wipes all emits.
    // `season created`, `season archived`, `season updated` are NOT backed
    // by DB triggers and MUST keep their application-layer emits per
    // ADR-0212 §"Scope of state-change events".
    expect(SOURCE).toMatch(/event\s*:\s*["']season created["']/);
    expect(SOURCE).toMatch(/event\s*:\s*["']season archived["']/);
    expect(SOURCE).toMatch(/event\s*:\s*["']season updated["']/);
  });
});
