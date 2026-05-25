/**
 * TidslinjeTab source-contract tests.
 *
 * Path B (static source check) pattern per T13 convention — vitest node env,
 * no @testing-library/react / jsdom. Assertions run against the raw source
 * file to enforce structural invariants that would otherwise only surface at
 * runtime or in a Gate 2 CI grep.
 *
 * Critical invariants verified:
 *   1. L-0340 — both telemetry event literals visible to external grep
 *   2. L-0177 — emitNonEmpty wrapper with fail-fast guards present
 *   3. Read-only V1 — no useMutation / mutateAsync (T19 preview guard)
 *   4. Component wires required design primitives (TidslinjeChipBar + TidslinjeRow)
 *   5. ADR-0361 — no hardcoded palette tokens (zinc-*, orange-*, gray-*)
 *   6. ADR-0366 — no OKLCH literals in arbitrary values
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TAB_SOURCE = readFileSync(resolve(__dirname, "..", "TidslinjeTab.tsx"), "utf-8");

describe("TidslinjeTab source contract", () => {
  // ── L-0340: both event names must appear as literals ───────────────────
  // The Gate 2 CI grep pattern is: emit(NonEmpty)?\(\s*["']<event>["']
  // Our wrapper delegates to emit({ event: "..." }) — the literal must still
  // appear in the file so the CI grep hits. We assert the event: "..." form.
  it("contains tidslinje_tab_opened as literal string (L-0340 grep visibility)", () => {
    expect(TAB_SOURCE).toMatch(/["']tidslinje_tab_opened["']/);
  });

  it("contains tidslinje_filter_changed as literal string (L-0340 grep visibility)", () => {
    expect(TAB_SOURCE).toMatch(/["']tidslinje_filter_changed["']/);
  });

  // ── L-0177: fail-fast guard wrapper ────────────────────────────────────
  it("uses L-0177 fail-fast guard (emitNonEmpty wrapper exists)", () => {
    expect(TAB_SOURCE).toMatch(/function emitNonEmpty/);
  });

  it("emitNonEmpty checks wsId.length === 0 (fail-fast on empty workspace_id)", () => {
    expect(TAB_SOURCE).toMatch(/wsId\.length === 0/);
  });

  it("emitNonEmpty checks profId.length === 0 (fail-fast on empty profile_id)", () => {
    expect(TAB_SOURCE).toMatch(/profId\.length === 0/);
  });

  // ── L-0340: literal event names in emit({ event: "..." }) calls ─────────
  it("has tidslinje_tab_opened literal inside emit block (L-0340 secondary check)", () => {
    expect(TAB_SOURCE).toMatch(/event:\s*["']tidslinje_tab_opened["']/);
  });

  it("has tidslinje_filter_changed literal inside emit block (L-0340 secondary check)", () => {
    expect(TAB_SOURCE).toMatch(/event:\s*["']tidslinje_filter_changed["']/);
  });

  // ── Read-only V1 invariant (T19 preview guard) ──────────────────────────
  it("does NOT use useMutation (read-only V1 invariant)", () => {
    expect(TAB_SOURCE).not.toMatch(/\buseMutation\b/);
  });

  it("does NOT use mutateAsync (read-only V1 invariant)", () => {
    expect(TAB_SOURCE).not.toMatch(/\bmutateAsync\b/);
  });

  // ── Required design primitives ──────────────────────────────────────────
  it("imports TidslinjeChipBar", () => {
    expect(TAB_SOURCE).toMatch(/TidslinjeChipBar/);
  });

  it("imports TidslinjeRow", () => {
    expect(TAB_SOURCE).toMatch(/TidslinjeRow/);
  });

  // ── ADR-0361: no hardcoded palette tokens ───────────────────────────────
  it("uses only CSS-variable utility classes — no hardcoded palette tokens (ADR-0361)", () => {
    expect(TAB_SOURCE).not.toMatch(/\btext-zinc-\d/);
    expect(TAB_SOURCE).not.toMatch(/\bbg-zinc-\d/);
    expect(TAB_SOURCE).not.toMatch(/\bbg-orange-\d/);
    expect(TAB_SOURCE).not.toMatch(/\btext-orange-\d/);
    expect(TAB_SOURCE).not.toMatch(/\bborder-gray-\d/);
  });

  // ── ADR-0366: no OKLCH literals ─────────────────────────────────────────
  it("does not contain OKLCH literals (ADR-0366)", () => {
    expect(TAB_SOURCE).not.toContain("oklch(");
  });

  // ── T7 session-resolution pattern (two-query approach) ─────────────────
  it("uses two useQuery calls for department + session resolution (T7 replica pattern)", () => {
    const queryMatches = TAB_SOURCE.match(/useQuery\(/g) ?? [];
    expect(queryMatches.length).toBeGreaterThanOrEqual(2);
  });

  // ── EntityDrawer integration ────────────────────────────────────────────
  it("imports useEntityDrawerOptional for drawer integration", () => {
    expect(TAB_SOURCE).toMatch(/useEntityDrawerOptional/);
  });
});
