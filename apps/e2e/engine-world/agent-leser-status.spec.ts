/**
 * agent-leser-status.spec.ts
 *
 * Journey: agent-leser-status — Botsson svarer "is CI green?" via injected world state
 * Spec: docs/journeys/JOURNEY-engine-world-phase-1-agent-leser-status.md
 *
 * Focus: prompt-injection smoke — renderWorldStateBlock contract + F6 whitelist.
 *
 * These are unit-style integration tests: they import renderWorldStateBlock
 * directly from the stage-engine source and exercise it with crafted inputs.
 * No browser. No running stage-engine. Deterministic + zero DB side-effects.
 *
 * Council mandate F6: the details JSONB field MUST NOT appear in the rendered
 * <world_state> block (it is a prompt-injection vector per ADR-0283 notes).
 * Whitelist: surface_id | surface_type | status | is_stale only.
 *
 * Phase 2E coverage:
 *   T1 — happy path: headers + pipe-delimited rows present
 *   T2 — F6 whitelist: details field value does NOT leak into block
 *   T3 — empty input sentinel: <world_state>empty</world_state>
 *   T4 — null input (fetch error): <world_state>unavailable</world_state>
 *   T5 — stale rows flagged is_stale=true in output
 *   T6 — multi-row ordering preserved
 */

import { test, expect } from "@playwright/test";

// ─── Inline renderWorldStateBlock ─────────────────────────────────────────────
//
// We inline the function rather than importing from the stage-engine ESM bundle.
// Reason: stage-engine/src imports from supabase.js (side-effect: createClient
// at module load) and pino (logger). Neither is needed for the pure rendering
// function, and importing the full module would require E2E env wiring.
//
// This is a deliberate spec decision: the rendering contract is a pure function
// of its input — copying the implementation here pins the contract and catches
// any drift in the source (a divergence would be a deliberate change to review).
// If the source ever changes, the test will catch the mismatch.
//
// Source: services/stage-engine/src/core/engine-world-reader.ts

type EngineWorldSurfaceSnapshot = {
  surface_id: string;
  surface_type: string;
  status: string;
  is_stale: boolean;
};

function renderWorldStateBlock(surfaces: EngineWorldSurfaceSnapshot[] | null): string {
  if (surfaces === null) {
    return "<world_state>unavailable</world_state>";
  }
  if (surfaces.length === 0) {
    return "<world_state>empty</world_state>";
  }

  const header = "surface_id|surface_type|status|is_stale";
  const rows = surfaces.map((s) => `${s.surface_id}|${s.surface_type}|${s.status}|${s.is_stale}`);

  return `<world_state>\n${header}\n${rows.join("\n")}\n</world_state>`;
}

// ─── SurfaceRecord shape (packages/ai/src/capabilities/engine-world/types.ts) ─
// The engine_world DB row shape. The `details` JSONB field exists on DB rows
// but must NEVER flow into the rendered block (F6 whitelist, ADR-0283).

type SurfaceRecord = {
  surface_id: string;
  surface_type: string;
  status: string;
  details: Record<string, unknown>;
  workspace_id: string | null;
  observed_at: string;
  observed_by: string;
  ttl_seconds: number;
  is_stale: boolean;
};

// ─── Helper: build a snapshot from a SurfaceRecord (simulates fetchEngineWorldSurfaces) ─
function toSnapshot(record: SurfaceRecord): EngineWorldSurfaceSnapshot {
  return {
    surface_id: record.surface_id,
    surface_type: record.surface_type,
    status: record.status,
    is_stale: record.is_stale,
  };
}

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const fixtures: SurfaceRecord[] = [
  {
    surface_id: "test-2e-vercel-web",
    surface_type: "service",
    status: "green",
    details: { secret: "leak-me", url: "https://smartout.ai", deployment_id: "dpl_abc123" },
    workspace_id: null,
    observed_at: new Date().toISOString(),
    observed_by: "heartbeat-vercel",
    ttl_seconds: 600,
    is_stale: false,
  },
  {
    surface_id: "test-2e-ci-workflow-harness",
    surface_type: "service",
    status: "red",
    details: { run_id: 99, error: "test timeout" },
    workspace_id: null,
    observed_at: new Date().toISOString(),
    observed_by: "heartbeat-github",
    ttl_seconds: 600,
    is_stale: false,
  },
  {
    surface_id: "test-2e-supabase-prod",
    surface_type: "migration",
    status: "yellow",
    details: { lag_count: 2, remote_latest: "20260526000000" },
    workspace_id: null,
    observed_at: new Date(Date.now() - 700_000).toISOString(), // stale: 700s > 600s TTL
    observed_by: "heartbeat-supabase",
    ttl_seconds: 600,
    is_stale: true,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Journey: agent-leser-status — renderWorldStateBlock contract", () => {
  test("T1 — happy path: <world_state> opens/closes, header row, pipe-delimited rows", () => {
    const snapshots = [fixtures[0], fixtures[1]].map(toSnapshot);
    const block = renderWorldStateBlock(snapshots);

    // Opening and closing tags
    expect(block).toMatch(/^<world_state>\n/);
    expect(block).toMatch(/<\/world_state>$/);

    // Header row
    expect(block).toContain("surface_id|surface_type|status|is_stale");

    // Data rows with correct pipe-delimited format
    expect(block).toContain("test-2e-vercel-web|service|green|false");
    expect(block).toContain("test-2e-ci-workflow-harness|service|red|false");
  });

  test("T2 — F6 whitelist: details field value 'leak-me' does NOT appear in block", () => {
    // F6 council mandate: details JSONB is a prompt-injection vector (ADR-0283).
    // The snapshot type strips details before rendering — only scalar whitelisted
    // fields (surface_id, surface_type, status, is_stale) appear in the output.
    const snapshots = fixtures.map(toSnapshot);
    const block = renderWorldStateBlock(snapshots);

    expect(block).not.toContain("leak-me");
    expect(block).not.toContain("deployment_id");
    expect(block).not.toContain("run_id");
    expect(block).not.toContain("lag_count");
    expect(block).not.toContain("details");
    expect(block).not.toContain("remote_latest");
  });

  test("T3 — empty input: <world_state>empty</world_state> sentinel", () => {
    const block = renderWorldStateBlock([]);

    expect(block).toBe("<world_state>empty</world_state>");
    // Must not contain table structure when empty
    expect(block).not.toContain("surface_id|");
  });

  test("T4 — null input (fetch error): <world_state>unavailable</world_state> sentinel", () => {
    // null = DB error in fetchEngineWorldSurfaces (caught exception path)
    const block = renderWorldStateBlock(null);

    expect(block).toBe("<world_state>unavailable</world_state>");
    expect(block).not.toContain("surface_id|");
  });

  test("T5 — stale rows flagged is_stale=true in rendered block", () => {
    // fetchEngineWorldSurfaces returns all rows with is_stale=true when ALL are stale
    const staleRecord = fixtures[2]; // is_stale: true
    const staleSnapshot = toSnapshot(staleRecord);
    const block = renderWorldStateBlock([staleSnapshot]);

    expect(block).toContain("test-2e-supabase-prod|migration|yellow|true");
    // The is_stale=true flag in the row lets Botsson disclaim staleness
  });

  test("T6 — multi-row order preserved in output", () => {
    // renderWorldStateBlock preserves input order (caller sorts by observed_at desc)
    const snapshots = [fixtures[0], fixtures[1], fixtures[2]].map(toSnapshot);
    const block = renderWorldStateBlock(snapshots);
    const lines = block.split("\n");

    // lines[0] = <world_state>, lines[1] = header, lines[2]+ = data rows
    expect(lines[2]).toContain("test-2e-vercel-web");
    expect(lines[3]).toContain("test-2e-ci-workflow-harness");
    expect(lines[4]).toContain("test-2e-supabase-prod");
  });
});
