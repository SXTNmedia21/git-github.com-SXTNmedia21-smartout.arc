---
title: "Local Journey Control Center — Implementation Plan"
status: draft
created: 2026-05-06
updated: 2026-05-06
module: journey-engine
tags: [plan, journey-engine, e2e, dashboard, speed-profiles, llm-compile]
---

# Local Journey Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standalone Next.js dashboard at port 3334 that lists every JourneyIR TS-file AND every markdown journey draft, lets Pontus pick any, compiles markdown→IR via Claude on demand, runs with 3 speed profiles (`full` / `normal` / `ai_companion`), and streams live progress to the browser.

**Architecture:** New `apps/journey-control/` Next.js 16 app. Reuses `apps/e2e/runners/protocol-runner.ts` core unchanged. Markdown→IR compile via Anthropic SDK (claude-sonnet-4-6) with structured output. SSE for live progress. shadcn/ui with Nordic Split tokens. Spawns Playwright child-process per run.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui, Anthropic SDK, Playwright, SSE, Vitest.

**Out of scope:**
- Markdown→IR template-based compile (LLM-only path A)
- DB-backed `journey_version` rows (file-based only per user choice 1a)
- Production deployment (local-only)
- Auth (local-only)
- Real-time pause/resume (worker-level, separate sortie)
- Mobile parity

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `apps/journey-control/package.json` | Next.js 16 app manifest |
| `apps/journey-control/next.config.ts` | Standalone config, port 3334 |
| `apps/journey-control/tsconfig.json` | Strict TS, extends base |
| `apps/journey-control/components.json` | shadcn/ui config (new-york) |
| `apps/journey-control/src/app/globals.css` | Tailwind v4 + Nordic Split tokens |
| `apps/journey-control/src/app/layout.tsx` | Root layout, font setup |
| `apps/journey-control/src/app/page.tsx` | Dashboard — journey list + run controls |
| `apps/journey-control/src/app/runs/[runId]/page.tsx` | Live run viewer |
| `apps/journey-control/src/app/api/journeys/route.ts` | GET — list compiled + draft journeys |
| `apps/journey-control/src/app/api/journeys/compile/route.ts` | POST — markdown→IR via Claude |
| `apps/journey-control/src/app/api/journeys/[slug]/run/route.ts` | POST — start Playwright run |
| `apps/journey-control/src/app/api/journeys/[slug]/stream/[runId]/route.ts` | GET — SSE progress stream |
| `apps/journey-control/src/components/journey-list.tsx` | Card grid, compiled vs draft sections |
| `apps/journey-control/src/components/journey-card.tsx` | Per-journey card with run button |
| `apps/journey-control/src/components/speed-picker.tsx` | 3-button speed profile selector |
| `apps/journey-control/src/components/run-viewer.tsx` | Live step list + screenshot viewer |
| `apps/journey-control/src/components/compile-dialog.tsx` | Markdown preview + compile trigger |
| `apps/journey-control/src/lib/journey-discovery.ts` | Scan `apps/e2e/protocols/` + `docs/journeys/` |
| `apps/journey-control/src/lib/journey-runner.ts` | Spawn Playwright child, manage active runs |
| `apps/journey-control/src/lib/journey-compiler.ts` | Anthropic SDK, markdown→IR with Zod-typed output |
| `apps/journey-control/src/lib/speed-profile.ts` | Profile→multiplier resolution |
| `apps/e2e/runners/speed-profile-env.ts` | Read `JOURNEY_SPEED_PROFILE` env var, expose multipliers |
| `apps/e2e/runners/__tests__/speed-profile.test.ts` | Unit tests for profile resolution |
| `packages/journey-ir/src/__tests__/speed-profile.test.ts` | Unit tests for IR speed-profile schema |
| `apps/journey-control/src/lib/__tests__/journey-discovery.test.ts` | Unit tests for filesystem scan |
| `apps/journey-control/src/lib/__tests__/journey-compiler.test.ts` | Unit tests for compile (mocked LLM) |
| `docs/decisions/0284-journey-speed-profiles.md` | ADR for speed profile convention |
| `docs/HANDOFF-journey-control-center.md` | Closure handoff |
| `docs/journeys/JOURNEY-journey-control-center.md` | User journey doc |

### Modified files

| File | Change |
|---|---|
| `packages/journey-ir/src/types.ts` | Add `SpeedProfile` type + optional `speed_profile` field on `JourneyIR` |
| `packages/journey-ir/src/schema.ts` | Add Zod mirror for `speed_profile` |
| `packages/journey-ir/src/index.ts` | Export `SpeedProfile`, `SPEED_PROFILES`, `resolveSpeedMultiplier` |
| `apps/e2e/runners/protocol-runner.ts` | Read speed profile, scale `RUNNER_CONFIG.settleDelay` |
| `apps/e2e/runners/gate-checker.ts` | Read speed profile, scale gate timeouts + retry intervals |
| `pnpm-workspace.yaml` | Add `apps/journey-control` workspace |
| `turbo.json` | Add `journey-control` build/dev pipeline |
| `docs/decisions/0000-decision-log.md` | Register ADR-0284 |
| `docs/INDEX.md` | Add this plan |
| `apps/web/src/components/journey/useFjernkontrollMachine.ts` | (Phase 6) Add `setSpeed` event, `playbackProfile` field |
| `apps/web/src/components/journey/FjernkontrollActions.tsx` | (Phase 6) Add 3-button speed picker |

---

## Phase 1: Speed Profile Foundation (in `packages/journey-ir/`)

Build the speed-profile primitive in the canonical IR package first. No app code yet. TDD.

### Task 1: Define SpeedProfile type + multipliers

**Files:**
- Modify: `packages/journey-ir/src/types.ts`
- Test: `packages/journey-ir/src/__tests__/speed-profile.test.ts` (new)

- [ ] **Step 1: Write failing test for speed profile resolution**

```ts
// packages/journey-ir/src/__tests__/speed-profile.test.ts
import { describe, it, expect } from "vitest";
import { SPEED_PROFILES, resolveSpeedMultiplier } from "../speed-profile";

describe("speed profile", () => {
  it("full profile = 1x multiplier", () => {
    expect(resolveSpeedMultiplier("full")).toEqual({
      settle: 1,
      retry: 1,
      timeout: 1,
    });
  });

  it("normal profile slows settle 3x", () => {
    expect(resolveSpeedMultiplier("normal").settle).toBe(3);
  });

  it("ai_companion profile slows settle 8x", () => {
    expect(resolveSpeedMultiplier("ai_companion").settle).toBe(8);
  });

  it("SPEED_PROFILES exposes 3 named profiles", () => {
    expect(Object.keys(SPEED_PROFILES)).toEqual(["full", "normal", "ai_companion"]);
  });

  it("undefined profile falls back to full", () => {
    expect(resolveSpeedMultiplier(undefined)).toEqual(resolveSpeedMultiplier("full"));
  });
});
```

- [ ] **Step 2: Run test, expect failure (module not found)**

Run: `pnpm --filter @smartout/journey-ir test speed-profile`
Expected: FAIL — `Cannot find module '../speed-profile'`

- [ ] **Step 3: Create speed-profile.ts**

```ts
// packages/journey-ir/src/speed-profile.ts
/**
 * Speed profile primitive for JourneyIR runner.
 *
 * Three named profiles, each maps to multipliers applied to the runner's
 * default delays and timeouts. The IR optionally pins one (`speed_profile`
 * field), and the runtime can override via env var (resolved in the runner,
 * not here — this module is pure).
 *
 * Multipliers are conservative — they SLOW the runner down. They never
 * speed it up below current defaults (which are CI-tuned).
 */

export type SpeedProfile = "full" | "normal" | "ai_companion";

export type SpeedMultiplier = {
  /** Multiplier for `RUNNER_CONFIG.settleDelay` between actions. */
  settle: number;
  /** Multiplier for gate retry intervals (db_record, ui_state, etc.). */
  retry: number;
  /** Multiplier for gate timeouts (so slower runs don't false-fail). */
  timeout: number;
};

export const SPEED_PROFILES: Record<SpeedProfile, SpeedMultiplier> = {
  full: { settle: 1, retry: 1, timeout: 1 },
  normal: { settle: 3, retry: 3, timeout: 2 },
  ai_companion: { settle: 8, retry: 6, timeout: 3 },
};

export function resolveSpeedMultiplier(profile: SpeedProfile | undefined): SpeedMultiplier {
  return SPEED_PROFILES[profile ?? "full"];
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @smartout/journey-ir test speed-profile`
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/journey-ir/src/speed-profile.ts packages/journey-ir/src/__tests__/speed-profile.test.ts
git commit -m "$(cat <<'EOF'
feat(journey-ir): add SpeedProfile primitive with 3 named profiles

Pure module exporting SpeedProfile type, SPEED_PROFILES constant
(full/normal/ai_companion), and resolveSpeedMultiplier() helper.
Runner integration lands in next phase.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: Add speed_profile field to JourneyIR type

**Files:**
- Modify: `packages/journey-ir/src/types.ts:215-228`
- Modify: `packages/journey-ir/src/schema.ts`
- Test: `packages/journey-ir/src/types.test.ts`

- [ ] **Step 1: Write failing test in existing types.test.ts**

```ts
// Append to packages/journey-ir/src/types.test.ts
describe("JourneyIR speed_profile (additive v2.1)", () => {
  it("accepts ir without speed_profile (default = full)", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "test",
      title: "Test",
      module: "test",
      steps: [],
    };
    expect(JourneyIRSchema.parse(ir).speed_profile).toBeUndefined();
  });

  it("accepts ir with speed_profile=normal", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "test",
      title: "Test",
      module: "test",
      steps: [],
      speed_profile: "normal",
    };
    expect(JourneyIRSchema.parse(ir).speed_profile).toBe("normal");
  });

  it("rejects unknown speed_profile value", () => {
    const ir = {
      version: "2.0.0",
      slug: "test",
      title: "Test",
      module: "test",
      steps: [],
      speed_profile: "turbo",
    };
    expect(() => JourneyIRSchema.parse(ir)).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @smartout/journey-ir test types`
Expected: FAIL — `speed_profile` not in schema

- [ ] **Step 3: Add field to types.ts**

```ts
// In packages/journey-ir/src/types.ts, add import:
import type { SpeedProfile } from "./speed-profile";

// In JourneyIR interface, AFTER `success_gate?: JourneyGate;` (around line 226):
  /**
   * Speed profile for the runner. Default `full` (CI speed).
   * Runtime override via JOURNEY_SPEED_PROFILE env var takes precedence.
   */
  speed_profile?: SpeedProfile;
```

- [ ] **Step 4: Add Zod mirror to schema.ts**

```ts
// In packages/journey-ir/src/schema.ts, AFTER success_gate:
  speed_profile: z.enum(["full", "normal", "ai_companion"]).optional(),
```

- [ ] **Step 5: Run, expect pass**

Run: `pnpm --filter @smartout/journey-ir test`
Expected: PASS — all existing + 3 new tests

- [ ] **Step 6: Commit**

```bash
git add packages/journey-ir/src/types.ts packages/journey-ir/src/schema.ts packages/journey-ir/src/types.test.ts
git commit -m "$(cat <<'EOF'
feat(journey-ir): add optional speed_profile field on JourneyIR

Additive — IRs without speed_profile parse unchanged. Schema enum
restricts to full/normal/ai_companion. Runner reads in next phase.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3: Export from journey-ir barrel

**Files:**
- Modify: `packages/journey-ir/src/index.ts`

- [ ] **Step 1: Add exports**

```ts
// In packages/journey-ir/src/index.ts:
export type { SpeedProfile, SpeedMultiplier } from "./speed-profile";
export { SPEED_PROFILES, resolveSpeedMultiplier } from "./speed-profile";
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @smartout/journey-ir typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/journey-ir/src/index.ts
git commit -m "$(cat <<'EOF'
chore(journey-ir): export SpeedProfile primitives from barrel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Runner integration (in `apps/e2e/runners/`)

Wire speed profile into protocol-runner + gate-checker. Env-var override > IR field > default `full`.

### Task 4: Speed profile env-var resolver

**Files:**
- Create: `apps/e2e/runners/speed-profile-env.ts`
- Test: `apps/e2e/runners/__tests__/speed-profile.test.ts` (new)

- [ ] **Step 1: Write failing test**

```ts
// apps/e2e/runners/__tests__/speed-profile.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveRuntimeSpeedProfile } from "../speed-profile-env";

describe("resolveRuntimeSpeedProfile", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.JOURNEY_SPEED_PROFILE;
    delete process.env.JOURNEY_SPEED_PROFILE;
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env.JOURNEY_SPEED_PROFILE = originalEnv;
  });

  it("env var wins over IR profile", () => {
    process.env.JOURNEY_SPEED_PROFILE = "normal";
    expect(resolveRuntimeSpeedProfile("ai_companion")).toBe("normal");
  });

  it("IR profile wins when no env var", () => {
    expect(resolveRuntimeSpeedProfile("ai_companion")).toBe("ai_companion");
  });

  it("falls back to full when neither set", () => {
    expect(resolveRuntimeSpeedProfile(undefined)).toBe("full");
  });

  it("ignores invalid env var, falls back to IR", () => {
    process.env.JOURNEY_SPEED_PROFILE = "turbo";
    expect(resolveRuntimeSpeedProfile("normal")).toBe("normal");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter e2e test speed-profile`
Expected: FAIL — module not found

- [ ] **Step 3: Implement resolver**

```ts
// apps/e2e/runners/speed-profile-env.ts
/**
 * Runtime speed-profile resolver for the protocol runner.
 *
 * Precedence: env var > IR field > "full".
 * Invalid env values are ignored (fall through to IR).
 */

import type { SpeedProfile } from "@smartout/journey-ir";

const VALID: ReadonlySet<SpeedProfile> = new Set(["full", "normal", "ai_companion"]);

export function resolveRuntimeSpeedProfile(irProfile: SpeedProfile | undefined): SpeedProfile {
  const envRaw = process.env.JOURNEY_SPEED_PROFILE;
  if (envRaw && VALID.has(envRaw as SpeedProfile)) {
    return envRaw as SpeedProfile;
  }
  return irProfile ?? "full";
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm --filter e2e test speed-profile`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/runners/speed-profile-env.ts apps/e2e/runners/__tests__/speed-profile.test.ts
git commit -m "$(cat <<'EOF'
feat(e2e): runtime speed-profile resolver with env-var override

JOURNEY_SPEED_PROFILE env var takes precedence over IR speed_profile
field. Invalid values fall through. Default = full.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Wire speed profile into protocol-runner.ts

**Files:**
- Modify: `apps/e2e/runners/protocol-runner.ts`

- [ ] **Step 1: Read current settle-delay site**

Run: `grep -n "settleDelay\|RUNNER_CONFIG\|page.waitForTimeout" apps/e2e/runners/protocol-runner.ts | head -20`

Note line numbers for the settle-delay reference (around line 393 per research).

- [ ] **Step 2: Add imports + multiplier read at top of runProtocol**

```ts
// At top of apps/e2e/runners/protocol-runner.ts, add imports:
import { resolveSpeedMultiplier } from "@smartout/journey-ir";
import { resolveRuntimeSpeedProfile } from "./speed-profile-env";

// Inside runProtocol(), AFTER `const startTime = ...` line, add:
const speedProfile = resolveRuntimeSpeedProfile(ir.speed_profile);
const speedMultiplier = resolveSpeedMultiplier(speedProfile);
console.log(`[runner] speed profile: ${speedProfile} (settle×${speedMultiplier.settle})`);
```

- [ ] **Step 3: Apply multiplier to settle delay**

Find the line near `await page.waitForTimeout(RUNNER_CONFIG.settleDelay)` and replace:

```ts
// Before:
await page.waitForTimeout(RUNNER_CONFIG.settleDelay);

// After:
await page.waitForTimeout(RUNNER_CONFIG.settleDelay * speedMultiplier.settle);
```

Also find any explicit `settle` action handler (search `case "settle":`) and apply multiplier:

```ts
case "settle":
  await page.waitForTimeout(action.ms * speedMultiplier.settle);
  break;
```

- [ ] **Step 4: Pass multiplier into checkGate calls**

Find `checkGate(...)` invocations and add multiplier as new param. First update the import path's receiver — see Task 6.

For now, commit the runner-side change as-is (gate-checker integration lands in Task 6).

- [ ] **Step 5: Run typecheck + existing tests**

Run: `pnpm --filter e2e typecheck`
Expected: PASS

Run: `pnpm --filter e2e test:protocol`
Expected: PASS — P-001 still runs (with default `full` profile, behavior unchanged)

- [ ] **Step 6: Commit**

```bash
git add apps/e2e/runners/protocol-runner.ts
git commit -m "$(cat <<'EOF'
feat(e2e): protocol-runner respects speed_profile

Reads IR speed_profile + JOURNEY_SPEED_PROFILE env var, scales settle
delay by multiplier. Default full = 1x = unchanged behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Wire speed profile into gate-checker.ts

**Files:**
- Modify: `apps/e2e/runners/gate-checker.ts`

- [ ] **Step 1: Add speed param to checkGate signature**

Find the exported `checkGate` function. Add `speedMultiplier` to the params:

```ts
import type { SpeedMultiplier } from "@smartout/journey-ir";

export async function checkGate(
  gate: JourneyGate,
  page: Page,
  supabase: SupabaseClient,
  speedMultiplier: SpeedMultiplier = { settle: 1, retry: 1, timeout: 1 },
): Promise<GateResult> {
  // ... existing body, but multiply timeouts + retry intervals
}
```

- [ ] **Step 2: Apply multipliers in each gate-type handler**

For each handler (`checkDbRecord`, `checkUiState`, `checkUrlMatch`, `checkTelemetry`):

```ts
// Before:
const timeout = gate.timeout_ms ?? DEFAULT_DB_RECORD_TIMEOUT_MS;
const interval = gate.retry_interval_ms ?? DEFAULT_RETRY_INTERVAL_MS;

// After:
const timeout = (gate.timeout_ms ?? DEFAULT_DB_RECORD_TIMEOUT_MS) * speedMultiplier.timeout;
const interval = (gate.retry_interval_ms ?? DEFAULT_RETRY_INTERVAL_MS) * speedMultiplier.retry;
```

Apply the same pattern to all four gate handlers in the file.

- [ ] **Step 3: Update protocol-runner.ts to pass multiplier**

In `apps/e2e/runners/protocol-runner.ts`, find `checkGate(` calls and append `speedMultiplier`:

```ts
const gateResult = await checkGate(step.gate, page, supabase, speedMultiplier);
```

- [ ] **Step 4: Run typecheck + tests**

Run: `pnpm --filter e2e typecheck`
Expected: PASS

Run: `pnpm --filter e2e test:protocol`
Expected: PASS — P-001 still passes

- [ ] **Step 5: Manual smoke — run with normal profile**

Run: `JOURNEY_SPEED_PROFILE=normal pnpm --filter e2e test:protocol`
Expected: PASS, observably slower (settle 1500ms→4500ms; total run ~3x longer)

- [ ] **Step 6: Commit**

```bash
git add apps/e2e/runners/gate-checker.ts apps/e2e/runners/protocol-runner.ts
git commit -m "$(cat <<'EOF'
feat(e2e): gate-checker respects speed multiplier

All four gate types (db_record, ui_state, url_match, telemetry) scale
timeouts + retry intervals by SpeedMultiplier. Smoke verified: normal
profile = 3x slower observable run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Standalone Next.js scaffold (`apps/journey-control/`)

### Task 7: Scaffold app + workspace registration

**Files:**
- Create: `apps/journey-control/package.json`
- Create: `apps/journey-control/next.config.ts`
- Create: `apps/journey-control/tsconfig.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`

- [ ] **Step 1: Read existing landing app for shape**

Run: `cat apps/landing/package.json`

- [ ] **Step 2: Write package.json**

```json
{
  "name": "@smartout/journey-control",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3334",
    "build": "next build",
    "start": "next start --port 3334",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.34.0",
    "@smartout/journey-ir": "workspace:*",
    "@smartout/ui": "workspace:*",
    "next": "16.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Write next.config.ts**

```ts
// apps/journey-control/next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@smartout/journey-ir", "@smartout/ui"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default config;
```

- [ ] **Step 4: Write tsconfig.json**

```json
{
  "extends": "@smartout/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts"],
  "exclude": ["node_modules", ".next"]
}
```

- [ ] **Step 5: Register in pnpm-workspace.yaml**

Add `apps/journey-control` to the `packages:` list (already present via `apps/*` glob — verify).

Run: `grep "apps/" pnpm-workspace.yaml`
Expected: `apps/*` glob already covers it. No edit needed.

- [ ] **Step 6: Add to turbo.json**

Find `"pipeline"` (or `"tasks"` in newer turbo) section. The existing `dev`/`build`/`typecheck` tasks should auto-include via wildcards. Verify:

Run: `grep -A2 '"dev"' turbo.json`

If a manual `dependsOn` list excludes journey-control, add it.

- [ ] **Step 7: Install + typecheck**

Run: `pnpm install`
Expected: workspace registered, deps installed.

Run: `pnpm --filter @smartout/journey-control typecheck`
Expected: PASS (no source files yet, vacuously)

- [ ] **Step 8: Commit**

```bash
git add apps/journey-control/package.json apps/journey-control/next.config.ts apps/journey-control/tsconfig.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml
git commit -m "$(cat <<'EOF'
feat(journey-control): scaffold standalone Next.js app on port 3334

Empty workspace package, depends on @smartout/journey-ir + @smartout/ui.
Source files land in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 8: Base layout + globals + Nordic Split tokens

**Files:**
- Create: `apps/journey-control/src/app/layout.tsx`
- Create: `apps/journey-control/src/app/globals.css`
- Create: `apps/journey-control/src/app/page.tsx` (placeholder)
- Create: `apps/journey-control/components.json`
- Create: `apps/journey-control/postcss.config.mjs`

- [ ] **Step 1: Copy globals.css from apps/web**

Run: `cat apps/web/src/app/globals.css | head -100`

Use as template. Create `apps/journey-control/src/app/globals.css` with same Tailwind v4 + Nordic Split tokens. Trim to essentials (no dashboard-specific classes).

- [ ] **Step 2: Write layout.tsx**

```tsx
// apps/journey-control/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Journey Control Center",
  description: "Local journey runner + speed control",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="bg-background text-foreground min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write placeholder page.tsx**

```tsx
// apps/journey-control/src/app/page.tsx
export default function Home() {
  return (
    <main className="container mx-auto py-12">
      <h1 className="font-heading text-4xl">Journey Control Center</h1>
      <p className="text-muted-foreground mt-2">Scaffold ready. UI lands next.</p>
    </main>
  );
}
```

- [ ] **Step 4: Write components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 5: Write postcss.config.mjs**

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 6: Smoke test dev server**

Run: `pnpm --filter @smartout/journey-control dev` (background)
Expected: Server starts on http://localhost:3334

Open browser to http://localhost:3334 — verify "Journey Control Center" heading renders with Instrument Serif. Kill server.

- [ ] **Step 7: Commit**

```bash
git add apps/journey-control/src apps/journey-control/components.json apps/journey-control/postcss.config.mjs
git commit -m "$(cat <<'EOF'
feat(journey-control): base layout + Nordic Split tokens + scaffold page

Tailwind v4 globals copied from apps/web pattern. Geist + Instrument
Serif fonts. Port 3334 verified.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Journey discovery (filesystem scan)

### Task 9: Discover compiled IR + markdown drafts

**Files:**
- Create: `apps/journey-control/src/lib/journey-discovery.ts`
- Test: `apps/journey-control/src/lib/__tests__/journey-discovery.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/journey-control/src/lib/__tests__/journey-discovery.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { listCompiledJourneys, listDraftJourneys } from "../journey-discovery";
import * as fs from "fs";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

describe("listCompiledJourneys", () => {
  it("finds at least P-001", async () => {
    const items = await listCompiledJourneys(REPO_ROOT);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.find((j) => j.slug === "P-001")).toBeDefined();
  });

  it("each item has slug + title + filePath", async () => {
    const items = await listCompiledJourneys(REPO_ROOT);
    for (const item of items) {
      expect(item.slug).toMatch(/^[A-Z0-9-]+$/);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.filePath).toContain("apps/e2e/protocols/");
    }
  });
});

describe("listDraftJourneys", () => {
  it("finds 200+ markdown drafts", async () => {
    const items = await listDraftJourneys(REPO_ROOT);
    expect(items.length).toBeGreaterThan(200);
  });

  it("each item has slug derived from filename + filePath", async () => {
    const items = await listDraftJourneys(REPO_ROOT);
    const sample = items[0];
    expect(sample.slug.length).toBeGreaterThan(0);
    expect(sample.filePath).toContain("docs/journeys/");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm --filter @smartout/journey-control test journey-discovery`
Expected: FAIL — module not found

- [ ] **Step 3: Implement discovery module**

```ts
// apps/journey-control/src/lib/journey-discovery.ts
/**
 * Filesystem scan for journeys.
 *
 * Compiled = .ts files in apps/e2e/protocols/ that export a const
 * matching JourneyIR shape. We don't import them (would require
 * compiling TS); we read the file + parse the title heuristically.
 *
 * Drafts = .md files in docs/journeys/ named JOURNEY-*.md.
 */

import * as fs from "fs/promises";
import * as path from "path";

export type CompiledJourney = {
  slug: string;
  title: string;
  filePath: string;
  module?: string;
};

export type DraftJourney = {
  slug: string;
  title: string;
  filePath: string;
};

const PROTOCOLS_DIR = "apps/e2e/protocols";
const JOURNEYS_DIR = "docs/journeys";

const RESERVED_FILES = new Set(["index.ts", "schema.ts", "types.ts"]);

export async function listCompiledJourneys(repoRoot: string): Promise<CompiledJourney[]> {
  const dir = path.join(repoRoot, PROTOCOLS_DIR);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const result: CompiledJourney[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".ts")) continue;
    if (RESERVED_FILES.has(entry)) continue;

    const filePath = path.join(dir, entry);
    const content = await fs.readFile(filePath, "utf8");

    const slugMatch = content.match(/slug:\s*["']([^"']+)["']/);
    const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
    const moduleMatch = content.match(/module:\s*["']([^"']+)["']/);

    if (!slugMatch || !titleMatch) continue;

    result.push({
      slug: slugMatch[1],
      title: titleMatch[1],
      filePath,
      module: moduleMatch?.[1],
    });
  }

  return result.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function listDraftJourneys(repoRoot: string): Promise<DraftJourney[]> {
  const dir = path.join(repoRoot, JOURNEYS_DIR);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const result: DraftJourney[] = [];

  for (const entry of entries) {
    if (!entry.startsWith("JOURNEY-") || !entry.endsWith(".md")) continue;

    const filePath = path.join(dir, entry);
    const slug = entry.replace(/^JOURNEY-/, "").replace(/\.md$/, "");

    // Read frontmatter title or first heading
    const content = await fs.readFile(filePath, "utf8");
    const titleMatch =
      content.match(/^title:\s*["']?([^"'\n]+)["']?$/m) ?? content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? slug;

    result.push({ slug, title, filePath });
  }

  return result.sort((a, b) => a.slug.localeCompare(b.slug));
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @smartout/journey-control test journey-discovery`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/journey-control/src/lib/journey-discovery.ts apps/journey-control/src/lib/__tests__/journey-discovery.test.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): filesystem scan for compiled IR + draft journeys

Pure async helpers, no DB. Reads apps/e2e/protocols/*.ts (heuristic
slug+title regex) and docs/journeys/JOURNEY-*.md (frontmatter or H1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: GET /api/journeys route

**Files:**
- Create: `apps/journey-control/src/app/api/journeys/route.ts`

- [ ] **Step 1: Implement route**

```ts
// apps/journey-control/src/app/api/journeys/route.ts
import { NextResponse } from "next/server";
import path from "path";
import { listCompiledJourneys, listDraftJourneys } from "@/lib/journey-discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const [compiled, drafts] = await Promise.all([
    listCompiledJourneys(repoRoot),
    listDraftJourneys(repoRoot),
  ]);
  return NextResponse.json({ compiled, drafts });
}
```

- [ ] **Step 2: Smoke test**

Run: `pnpm --filter @smartout/journey-control dev` (background)
Run: `curl http://localhost:3334/api/journeys | head -100`
Expected: JSON with `compiled` (1+ entries with P-001) and `drafts` (200+ entries).

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/app/api/journeys/route.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): GET /api/journeys returns compiled + drafts

Returns 1 compiled (P-001) and 235 draft markdown entries on first run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Run engine adapter

### Task 11: Spawn Playwright child process

**Files:**
- Create: `apps/journey-control/src/lib/journey-runner.ts`

- [ ] **Step 1: Implement runner module**

```ts
// apps/journey-control/src/lib/journey-runner.ts
/**
 * Journey runner — spawns Playwright child process for a given compiled
 * IR slug, captures stdout/stderr lines + progress JSON.
 *
 * Mirrors apps/web/src/app/api/platform-admin/e2e/run/route.ts pattern
 * (single concurrent run, 10-min safety timeout, 5-min cleanup) but
 * pinned to file-based protocol slugs and adds speed-profile env var.
 */

import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import type { SpeedProfile } from "@smartout/journey-ir";

export type ActiveRun = {
  runId: string;
  slug: string;
  speedProfile: SpeedProfile;
  process: ChildProcess;
  startedAt: number;
  lines: string[];
  done: boolean;
  exitCode: number | null;
};

export const activeRuns = new Map<string, ActiveRun>();

const SAFETY_TIMEOUT_MS = 10 * 60 * 1000;
const CLEANUP_DELAY_MS = 5 * 60 * 1000;

export type StartRunInput = {
  slug: string;
  speedProfile: SpeedProfile;
  repoRoot: string;
};

export type StartRunResult = { ok: true; runId: string } | { ok: false; error: string };

export function startRun(input: StartRunInput): StartRunResult {
  const existing = [...activeRuns.values()].find((r) => !r.done);
  if (existing) return { ok: false, error: `Run already active: ${existing.runId}` };

  const runId = randomUUID().slice(0, 8);
  const e2eDir = path.join(input.repoRoot, "apps/e2e");

  const child = spawn(
    "npx",
    [
      "playwright",
      "test",
      "tests/protocol.spec.ts",
      "--project=web",
      "--reporter=list",
    ],
    {
      cwd: e2eDir,
      env: {
        ...process.env,
        JOURNEY_SPEED_PROFILE: input.speedProfile,
        JOURNEY_PROTOCOL_SLUG: input.slug,
        SKIP_WEB_SERVER: "1",
        CI: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const run: ActiveRun = {
    runId,
    slug: input.slug,
    speedProfile: input.speedProfile,
    process: child,
    startedAt: Date.now(),
    lines: [],
    done: false,
    exitCode: null,
  };

  activeRuns.set(runId, run);

  child.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) run.lines.push(JSON.stringify({ type: "stdout", line }));
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) run.lines.push(JSON.stringify({ type: "stderr", line }));
    }
  });

  child.on("exit", (code) => {
    run.done = true;
    run.exitCode = code;
    run.lines.push(JSON.stringify({ type: "done", exitCode: code }));
    setTimeout(() => activeRuns.delete(runId), CLEANUP_DELAY_MS);
  });

  setTimeout(() => {
    if (!run.done) {
      child.kill("SIGKILL");
      run.lines.push(JSON.stringify({ type: "killed", reason: "safety_timeout" }));
    }
  }, SAFETY_TIMEOUT_MS);

  return { ok: true, runId };
}

export function abortRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.done) return false;
  run.process.kill("SIGTERM");
  return true;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @smartout/journey-control typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/lib/journey-runner.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): journey-runner spawns Playwright child process

Single-run model, 10-min safety timeout, 5-min cleanup. Passes
JOURNEY_SPEED_PROFILE + JOURNEY_PROTOCOL_SLUG env vars to runner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 12: Make protocol-runner respect JOURNEY_PROTOCOL_SLUG

**Files:**
- Modify: `apps/e2e/tests/protocol.spec.ts`
- Modify: `apps/e2e/protocols/index.ts`

- [ ] **Step 1: Read current protocol.spec.ts**

Run: `cat apps/e2e/tests/protocol.spec.ts`

Note current loading mechanism (likely hardcoded P-001 import).

- [ ] **Step 2: Update protocols/index.ts to expose registry**

```ts
// apps/e2e/protocols/index.ts — ensure exports look like:
import { P001_ADMIN_ONBOARDING } from "./P-001-admin-onboarding";

export const PROTOCOL_REGISTRY = {
  "P-001": P001_ADMIN_ONBOARDING,
} as const;

export type ProtocolSlug = keyof typeof PROTOCOL_REGISTRY;
```

- [ ] **Step 3: Update protocol.spec.ts to read env**

```ts
// apps/e2e/tests/protocol.spec.ts — add:
import { PROTOCOL_REGISTRY, type ProtocolSlug } from "../protocols";

const slug = (process.env.JOURNEY_PROTOCOL_SLUG ?? "P-001") as ProtocolSlug;
const ir = PROTOCOL_REGISTRY[slug];
if (!ir) {
  throw new Error(`Unknown protocol slug: ${slug}. Available: ${Object.keys(PROTOCOL_REGISTRY).join(", ")}`);
}

test(`runs protocol ${ir.slug}: ${ir.title}`, async ({ page }) => {
  // existing body, but use `ir` from above instead of hardcoded import
});
```

- [ ] **Step 4: Smoke test default + invalid slug**

Run: `pnpm --filter e2e test:protocol`
Expected: PASS — runs P-001 by default

Run: `JOURNEY_PROTOCOL_SLUG=P-999 pnpm --filter e2e test:protocol`
Expected: FAIL with "Unknown protocol slug: P-999"

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/protocols/index.ts apps/e2e/tests/protocol.spec.ts
git commit -m "$(cat <<'EOF'
feat(e2e): protocol.spec reads JOURNEY_PROTOCOL_SLUG env var

Registry-based dispatch enables journey-control to run any compiled
protocol by slug. Default = P-001 (CI compat).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 13: POST /api/journeys/[slug]/run

**Files:**
- Create: `apps/journey-control/src/app/api/journeys/[slug]/run/route.ts`

- [ ] **Step 1: Implement route**

```ts
// apps/journey-control/src/app/api/journeys/[slug]/run/route.ts
import { NextResponse, type NextRequest } from "next/server";
import path from "path";
import { z } from "zod";
import { startRun } from "@/lib/journey-runner";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  speed_profile: z.enum(["full", "normal", "ai_companion"]).default("full"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const repoRoot = path.resolve(process.cwd(), "../..");
  const result = startRun({
    slug,
    speedProfile: parsed.data.speed_profile,
    repoRoot,
  });

  if (!result.ok) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Smoke test**

Start dev server: `pnpm --filter @smartout/journey-control dev` (background)
Run: `curl -X POST http://localhost:3334/api/journeys/P-001/run -H 'Content-Type: application/json' -d '{"speed_profile":"normal"}'`
Expected: `{"ok":true,"runId":"..."}`

Wait 30s, run again — expect 409 conflict.

Kill dev server + Playwright child.

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/app/api/journeys/\[slug\]/run/route.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): POST /api/journeys/[slug]/run starts Playwright

Validates speed_profile via Zod, spawns single concurrent run, returns
runId. 409 on concurrent attempt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 14: SSE progress stream

**Files:**
- Create: `apps/journey-control/src/app/api/journeys/[slug]/stream/[runId]/route.ts`

- [ ] **Step 1: Implement stream route**

```ts
// apps/journey-control/src/app/api/journeys/[slug]/stream/[runId]/route.ts
import { type NextRequest } from "next/server";
import { activeRuns } from "@/lib/journey-runner";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; runId: string }> },
) {
  const { runId } = await ctx.params;
  const run = activeRuns.get(runId);
  if (!run) return new Response("Run not found", { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let cursor = 0;

      const interval = setInterval(() => {
        while (cursor < run.lines.length) {
          controller.enqueue(encoder.encode(`data: ${run.lines[cursor]}\n\n`));
          cursor++;
        }
        if (run.done && cursor >= run.lines.length) {
          clearInterval(interval);
          controller.close();
        }
      }, 200);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Smoke test**

Start dev: `pnpm --filter @smartout/journey-control dev` (background)
Start run: `curl -X POST http://localhost:3334/api/journeys/P-001/run -d '{"speed_profile":"full"}' -H 'Content-Type: application/json'`
Capture runId.
Stream: `curl -N http://localhost:3334/api/journeys/P-001/stream/<runId>`
Expected: SSE events streaming Playwright stdout/stderr lines + final `done` event.

Kill dev.

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/app/api/journeys/\[slug\]/stream/\[runId\]/route.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): SSE stream of Playwright run output

Polls activeRuns lines every 200ms, emits SSE data events, closes on
done. Mirrors platform-admin/e2e/stream pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Dashboard UI

### Task 15: Speed picker component

**Files:**
- Create: `apps/journey-control/src/components/speed-picker.tsx`
- Create: `apps/journey-control/src/lib/utils.ts` (cn helper)

- [ ] **Step 1: Add cn helper**

```ts
// apps/journey-control/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Add deps: `pnpm --filter @smartout/journey-control add clsx tailwind-merge`

- [ ] **Step 2: Implement SpeedPicker**

```tsx
// apps/journey-control/src/components/speed-picker.tsx
"use client";

import type { SpeedProfile } from "@smartout/journey-ir";
import { cn } from "@/lib/utils";

const PROFILES: Array<{ value: SpeedProfile; label: string; hint: string }> = [
  { value: "full", label: "Full", hint: "CI speed, no scaling" },
  { value: "normal", label: "Normal", hint: "Human-watch, ~3x slower" },
  { value: "ai_companion", label: "AI Companion", hint: "Botsson-narrate, ~8x slower" },
];

type Props = {
  value: SpeedProfile;
  onChange: (next: SpeedProfile) => void;
  disabled?: boolean;
};

export function SpeedPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="border-border bg-muted inline-flex rounded-lg border p-1" role="radiogroup">
      {PROFILES.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          disabled={disabled}
          onClick={() => onChange(p.value)}
          title={p.hint}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            value === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/journey-control typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/journey-control/src/components/speed-picker.tsx apps/journey-control/src/lib/utils.ts apps/journey-control/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(journey-control): SpeedPicker 3-button radiogroup

Nordic Split tokens, ARIA radiogroup, hover hints with profile descriptions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: Journey list + journey card

**Files:**
- Create: `apps/journey-control/src/components/journey-list.tsx`
- Create: `apps/journey-control/src/components/journey-card.tsx`

- [ ] **Step 1: Implement JourneyCard**

```tsx
// apps/journey-control/src/components/journey-card.tsx
"use client";

import { Play, FileCode, FileText } from "lucide-react";
import type { SpeedProfile } from "@smartout/journey-ir";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  title: string;
  kind: "compiled" | "draft";
  module?: string;
  selected: boolean;
  onSelect: () => void;
  onRun?: (speed: SpeedProfile) => void;
  onCompile?: () => void;
};

export function JourneyCard({ slug, title, kind, module, selected, onSelect, onRun, onCompile }: Props) {
  const Icon = kind === "compiled" ? FileCode : FileText;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "border-border bg-card text-card-foreground hover:bg-muted/50 flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        selected && "ring-foreground/20 ring-2",
      )}
    >
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs">{slug}</span>
          {module && <span className="text-muted-foreground text-xs">{module}</span>}
        </div>
        <div className="mt-1 truncate text-sm">{title}</div>
        <div className="text-muted-foreground mt-1 text-xs uppercase tracking-wide">{kind}</div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Implement JourneyList**

```tsx
// apps/journey-control/src/components/journey-list.tsx
"use client";

import { useEffect, useState } from "react";
import { JourneyCard } from "./journey-card";

type Compiled = { slug: string; title: string; filePath: string; module?: string };
type Draft = { slug: string; title: string; filePath: string };

type Props = {
  selectedSlug: string | null;
  onSelect: (slug: string, kind: "compiled" | "draft") => void;
};

export function JourneyList({ selectedSlug, onSelect }: Props) {
  const [compiled, setCompiled] = useState<Compiled[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/journeys")
      .then((r) => r.json())
      .then((d) => {
        setCompiled(d.compiled);
        setDrafts(d.drafts);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
          Compiled ({compiled.length})
        </h2>
        <div className="space-y-2">
          {compiled.map((j) => (
            <JourneyCard
              key={j.slug}
              slug={j.slug}
              title={j.title}
              kind="compiled"
              module={j.module}
              selected={selectedSlug === j.slug}
              onSelect={() => onSelect(j.slug, "compiled")}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
          Drafts ({drafts.length})
        </h2>
        <div className="space-y-2">
          {drafts.slice(0, 50).map((j) => (
            <JourneyCard
              key={j.slug}
              slug={j.slug}
              title={j.title}
              kind="draft"
              selected={selectedSlug === j.slug}
              onSelect={() => onSelect(j.slug, "draft")}
            />
          ))}
          {drafts.length > 50 && (
            <p className="text-muted-foreground text-xs">+ {drafts.length - 50} more (search TBD)</p>
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/journey-control typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/journey-control/src/components/journey-list.tsx apps/journey-control/src/components/journey-card.tsx
git commit -m "$(cat <<'EOF'
feat(journey-control): JourneyList + JourneyCard with kind discriminator

Two sections (compiled / drafts), card click selects, draft list capped
at 50 first render.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 17: Run viewer (live SSE consumer)

**Files:**
- Create: `apps/journey-control/src/components/run-viewer.tsx`

- [ ] **Step 1: Implement RunViewer**

```tsx
// apps/journey-control/src/components/run-viewer.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Line = { type: "stdout" | "stderr" | "done" | "killed"; line?: string; exitCode?: number; reason?: string };

type Props = { slug: string; runId: string };

export function RunViewer({ slug, runId }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState<Line | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/journeys/${slug}/stream/${runId}`);
    es.onmessage = (e) => {
      try {
        const msg: Line = JSON.parse(e.data);
        if (msg.type === "done" || msg.type === "killed") {
          setDone(msg);
          es.close();
        } else {
          setLines((prev) => [...prev.slice(-499), msg]);
        }
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [slug, runId]);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [lines]);

  return (
    <div className="border-border bg-card flex flex-col rounded-lg border">
      <div className="border-border flex items-center justify-between border-b p-3">
        <div className="font-mono text-sm">
          {slug} <span className="text-muted-foreground">{runId}</span>
        </div>
        {done && (
          <span
            className={
              done.type === "done" && done.exitCode === 0
                ? "text-green-500 text-xs"
                : "text-destructive text-xs"
            }
          >
            {done.type === "done" ? `exit ${done.exitCode}` : `killed: ${done.reason}`}
          </span>
        )}
      </div>
      <div ref={containerRef} className="bg-muted/30 max-h-96 overflow-auto p-3 font-mono text-xs">
        {lines.map((l, i) => (
          <div
            key={i}
            className={l.type === "stderr" ? "text-destructive/80" : "text-muted-foreground"}
          >
            {l.line}
          </div>
        ))}
        {lines.length === 0 && <div className="text-muted-foreground">Waiting for output…</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @smartout/journey-control typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/components/run-viewer.tsx
git commit -m "$(cat <<'EOF'
feat(journey-control): RunViewer SSE consumer with auto-scroll log

Caps at 500 lines, color-codes stderr, shows exit code + kill reason.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 18: Compose dashboard page

**Files:**
- Modify: `apps/journey-control/src/app/page.tsx`

- [ ] **Step 1: Replace placeholder page**

```tsx
// apps/journey-control/src/app/page.tsx
"use client";

import { useState } from "react";
import type { SpeedProfile } from "@smartout/journey-ir";
import { JourneyList } from "@/components/journey-list";
import { SpeedPicker } from "@/components/speed-picker";
import { RunViewer } from "@/components/run-viewer";

export default function Home() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<"compiled" | "draft" | null>(null);
  const [speedProfile, setSpeedProfile] = useState<SpeedProfile>("normal");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!selectedSlug) return;
    setError(null);
    setActiveRunId(null);
    const r = await fetch(`/api/journeys/${selectedSlug}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed_profile: speedProfile }),
    });
    const j = await r.json();
    if (j.ok) setActiveRunId(j.runId);
    else setError(j.error);
  }

  return (
    <main className="container mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-heading text-4xl">Journey Control Center</h1>
        <p className="text-muted-foreground mt-2 text-sm">Pick a journey, choose a speed, run it locally.</p>
      </header>

      <div className="grid grid-cols-[1fr_2fr] gap-6">
        <aside>
          <JourneyList
            selectedSlug={selectedSlug}
            onSelect={(slug, kind) => {
              setSelectedSlug(slug);
              setSelectedKind(kind);
              setActiveRunId(null);
            }}
          />
        </aside>

        <section className="space-y-4">
          {selectedSlug ? (
            <>
              <div className="border-border bg-card rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{selectedSlug}</div>
                    <div className="text-muted-foreground text-xs uppercase">{selectedKind}</div>
                  </div>
                  <SpeedPicker
                    value={speedProfile}
                    onChange={setSpeedProfile}
                    disabled={!!activeRunId}
                  />
                </div>
                <div className="flex gap-2">
                  {selectedKind === "compiled" ? (
                    <button
                      onClick={handleRun}
                      disabled={!!activeRunId}
                      className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
                    >
                      Run
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-muted text-muted-foreground rounded-md px-4 py-2 text-sm font-medium"
                      title="Compile lands in next phase"
                    >
                      Compile (TBD)
                    </button>
                  )}
                </div>
                {error && <p className="text-destructive mt-3 text-xs">{error}</p>}
              </div>

              {activeRunId && <RunViewer slug={selectedSlug} runId={activeRunId} />}
            </>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
              Pick a journey to begin
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `pnpm --filter @smartout/journey-control dev` (background)
Open http://localhost:3334
- Verify list loads (1 compiled, 235 drafts)
- Click P-001 → Run button enabled
- Pick "Normal" speed → click Run
- Verify SSE log streams Playwright stdout
- Wait for done event

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(journey-control): compose dashboard — list + speed picker + run viewer

Two-column grid: journey list (left), selected journey detail + live
viewer (right). Compiled journeys runnable; drafts disabled until
Phase 7 (compile).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7: Markdown→IR compile via Claude

### Task 19: Anthropic SDK compiler module

**Files:**
- Create: `apps/journey-control/src/lib/journey-compiler.ts`
- Create: `apps/journey-control/src/lib/__tests__/journey-compiler.test.ts`

- [ ] **Step 1: Write failing test (mocked LLM)**

```ts
// apps/journey-control/src/lib/__tests__/journey-compiler.test.ts
import { describe, it, expect, vi } from "vitest";
import { compileMarkdownToIR } from "../journey-compiler";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              version: "2.0.0",
              slug: "P-MOCK",
              title: "Mock Journey",
              module: "test",
              entry_url: "/",
              steps: [
                {
                  key: "1_navigate",
                  order: 1,
                  title: "Navigate",
                  action: "Open root",
                  assertion: "URL is /",
                  actions: [{ type: "navigate", url: "/" }],
                  gate: { type: "url_match", pattern: "/" },
                },
              ],
            }),
          },
        ],
      }),
    },
  })),
}));

describe("compileMarkdownToIR", () => {
  it("returns valid JourneyIR from mock LLM response", async () => {
    const result = await compileMarkdownToIR({
      markdown: "# Test Journey\n\nNavigate to root.",
      apiKey: "sk-mock",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir.version).toBe("2.0.0");
      expect(result.ir.slug).toBe("P-MOCK");
      expect(result.ir.steps.length).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm --filter @smartout/journey-control test journey-compiler`
Expected: FAIL — module not found

- [ ] **Step 3: Implement compiler**

```ts
// apps/journey-control/src/lib/journey-compiler.ts
/**
 * Markdown→IR compiler via Claude Sonnet 4.6.
 *
 * Reads a JOURNEY-X.md narrative, prompts Claude with the JourneyIR v2
 * schema + the markdown, asks for a single JSON response that validates
 * against the schema. Returns ok+ir or ok=false+error.
 *
 * Caller (API route) is responsible for writing the resulting IR to
 * apps/e2e/protocols/P-NNN-<slug>.ts via a small TS-emitter.
 */

import Anthropic from "@anthropic-ai/sdk";
import { JourneyIRSchema, type JourneyIR } from "@smartout/journey-ir";

export type CompileInput = {
  markdown: string;
  apiKey: string;
  desiredSlug?: string;
};

export type CompileResult =
  | { ok: true; ir: JourneyIR; rawText: string }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `You are a JourneyIR compiler. Given a markdown narrative describing a user journey, return a single JSON object that strictly matches the JourneyIR v2.0.0 schema.

REQUIRED top-level fields:
- version: "2.0.0"
- slug: short uppercase-kebab id (e.g. "P-002")
- title: short human title
- module: lowercase-kebab module slug
- steps: array of journey steps

Each step REQUIRES:
- key: snake_case_id
- order: 1-indexed integer
- title: human title
- action: short narrative description
- assertion: short narrative of expected outcome
- actions: array of typed runner actions: navigate/fill/click/click_text/wait_visible/wait_hidden/settle
- gate: ONE of db_record / ui_state / url_match / telemetry_event

OPTIONAL top-level: actor, platform, auth_profile, entry_url, success_gate, preconditions, speed_profile.

OPTIONAL per-step: timeoutMs, screenshot, description.

Action shapes:
- navigate: { type: "navigate", url: string }
- fill: { type: "fill", testid: string, value: string }
- click: { type: "click", testid: string }
- click_text: { type: "click_text", text: string }
- wait_visible: { type: "wait_visible", testid: string }
- wait_hidden: { type: "wait_hidden", testid: string }
- settle: { type: "settle", ms: number }

Gate shapes:
- url_match: { type: "url_match", pattern: string, timeout_ms?: number }
- ui_state: { type: "ui_state", testid: string, visible?: boolean, timeout_ms?: number }
- db_record: { type: "db_record", table: string, where: object, expect: object, timeout_ms?: number }
- telemetry_event: { type: "telemetry_event", event_name: string, timeout_ms?: number }

Output ONLY the JSON object. No commentary, no code fences, no explanation.`;

export async function compileMarkdownToIR(input: CompileInput): Promise<CompileResult> {
  const client = new Anthropic({ apiKey: input.apiKey });

  const userPrompt = input.desiredSlug
    ? `Use slug "${input.desiredSlug}".\n\nMarkdown:\n\n${input.markdown}`
    : `Markdown:\n\n${input.markdown}`;

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    return { ok: false, error: `Anthropic API error: ${(err as Error).message}` };
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "No text content in Claude response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return { ok: false, error: `Claude returned invalid JSON: ${textBlock.text.slice(0, 200)}` };
  }

  const validation = JourneyIRSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      ok: false,
      error: `IR schema validation failed: ${validation.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
    };
  }

  return { ok: true, ir: validation.data, rawText: textBlock.text };
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @smartout/journey-control test journey-compiler`
Expected: PASS — 1 test

- [ ] **Step 5: Commit**

```bash
git add apps/journey-control/src/lib/journey-compiler.ts apps/journey-control/src/lib/__tests__/journey-compiler.test.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): markdown→IR compiler via Claude Sonnet

System prompt encodes JourneyIR v2 schema verbatim. Validates response
with Zod schema. Returns CompileResult discriminated union.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 20: TS-file emitter for compiled IR

**Files:**
- Create: `apps/journey-control/src/lib/ir-ts-emitter.ts`
- Create: `apps/journey-control/src/lib/__tests__/ir-ts-emitter.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/journey-control/src/lib/__tests__/ir-ts-emitter.test.ts
import { describe, it, expect } from "vitest";
import { emitIRToTypescript } from "../ir-ts-emitter";
import type { JourneyIR } from "@smartout/journey-ir";

describe("emitIRToTypescript", () => {
  it("produces a valid TS module exporting the IR const", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "P-002",
      title: "Test",
      module: "test",
      steps: [],
    };
    const ts = emitIRToTypescript(ir);
    expect(ts).toContain('import type { JourneyIR } from "@smartout/journey-ir"');
    expect(ts).toContain("export const P002");
    expect(ts).toContain('"2.0.0"');
    expect(ts).toContain('"P-002"');
  });

  it("emits valid identifier for hyphenated slug", () => {
    const ir: JourneyIR = {
      version: "2.0.0",
      slug: "P-002",
      title: "Test",
      module: "test",
      steps: [],
    };
    const ts = emitIRToTypescript(ir);
    // Identifier must be P002 (no hyphen)
    expect(ts).toMatch(/export const P002[^_]/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm --filter @smartout/journey-control test ir-ts-emitter`
Expected: FAIL — module not found

- [ ] **Step 3: Implement emitter**

```ts
// apps/journey-control/src/lib/ir-ts-emitter.ts
/**
 * Emit a JourneyIR object as a TypeScript module that, when placed in
 * apps/e2e/protocols/, becomes a runnable protocol entry.
 *
 * Strategy: serialize as JSON, wrap in `as const satisfies JourneyIR`.
 * The exported const name is the slug with non-alphanumerics removed.
 */

import type { JourneyIR } from "@smartout/journey-ir";

export function emitIRToTypescript(ir: JourneyIR): string {
  const constName = ir.slug.replace(/[^A-Za-z0-9]/g, "");
  const json = JSON.stringify(ir, null, 2);

  return `import type { JourneyIR } from "@smartout/journey-ir";

/**
 * ${ir.slug}: ${ir.title}
 *
 * Module: ${ir.module}
 * Compiled by Journey Control Center.
 */
export const ${constName}: JourneyIR = ${json};
`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm --filter @smartout/journey-control test ir-ts-emitter`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add apps/journey-control/src/lib/ir-ts-emitter.ts apps/journey-control/src/lib/__tests__/ir-ts-emitter.test.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): TS-file emitter writes IR as runnable protocol

Outputs a TS module exporting a const named after the slug with
non-alphanumerics stripped. JSON-serialized body, JourneyIR-typed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 21: POST /api/journeys/compile route

**Files:**
- Create: `apps/journey-control/src/app/api/journeys/compile/route.ts`

- [ ] **Step 1: Implement compile route**

```ts
// apps/journey-control/src/app/api/journeys/compile/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { compileMarkdownToIR } from "@/lib/journey-compiler";
import { emitIRToTypescript } from "@/lib/ir-ts-emitter";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  draft_slug: z.string().min(1),
  desired_slug: z
    .string()
    .regex(/^[A-Z0-9-]+$/)
    .optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not set in environment" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const repoRoot = path.resolve(process.cwd(), "../..");
  const mdPath = path.join(repoRoot, "docs/journeys", `JOURNEY-${parsed.data.draft_slug}.md`);

  let markdown: string;
  try {
    markdown = await fs.readFile(mdPath, "utf8");
  } catch {
    return NextResponse.json(
      { ok: false, error: `Draft not found: ${mdPath}` },
      { status: 404 },
    );
  }

  const result = await compileMarkdownToIR({
    markdown,
    apiKey,
    desiredSlug: parsed.data.desired_slug,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  // Write the compiled TS file
  const tsContent = emitIRToTypescript(result.ir);
  const tsPath = path.join(repoRoot, "apps/e2e/protocols", `${result.ir.slug}-${parsed.data.draft_slug}.ts`);
  await fs.writeFile(tsPath, tsContent, "utf8");

  return NextResponse.json({
    ok: true,
    slug: result.ir.slug,
    title: result.ir.title,
    filePath: tsPath,
    note: "Remember to add to apps/e2e/protocols/index.ts PROTOCOL_REGISTRY before running.",
  });
}
```

- [ ] **Step 2: Smoke test (requires ANTHROPIC_API_KEY)**

Run: `op run --env-file=.env.template -- pnpm --filter @smartout/journey-control dev` (background)
Pick a small markdown, e.g. `JOURNEY-onboarding-mission.md`. Send:
```bash
curl -X POST http://localhost:3334/api/journeys/compile \
  -H 'Content-Type: application/json' \
  -d '{"draft_slug":"onboarding-mission","desired_slug":"P-002"}'
```

Expected: `{"ok":true,"slug":"P-002","filePath":"...","note":"..."}` and a new file in `apps/e2e/protocols/P-002-onboarding-mission.ts`.

Inspect file. If schema-fail, expect 422 with the validation error path.

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/app/api/journeys/compile/route.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): POST /api/journeys/compile route

Reads markdown draft, calls Claude compiler, writes TS file. Returns
slug + filePath + reminder to register in PROTOCOL_REGISTRY.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 22: Compile dialog UI

**Files:**
- Create: `apps/journey-control/src/components/compile-dialog.tsx`
- Modify: `apps/journey-control/src/app/page.tsx` to wire compile button to dialog

- [ ] **Step 1: Implement compile dialog**

```tsx
// apps/journey-control/src/components/compile-dialog.tsx
"use client";

import { useState } from "react";

type Props = {
  draftSlug: string;
  draftTitle: string;
  onClose: () => void;
  onCompiled: (newSlug: string) => void;
};

export function CompileDialog({ draftSlug, draftTitle, onClose, onCompiled }: Props) {
  const [desiredSlug, setDesiredSlug] = useState("P-");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompile() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/journeys/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_slug: draftSlug, desired_slug: desiredSlug || undefined }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.ok) onCompiled(j.slug);
    else setError(j.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border-border w-full max-w-md rounded-lg border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-xl">Compile draft</h3>
        <p className="text-muted-foreground mt-1 text-sm">{draftTitle}</p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">JOURNEY-{draftSlug}.md</p>

        <label className="mt-6 block">
          <span className="text-sm">Desired slug (e.g. P-002)</span>
          <input
            value={desiredSlug}
            onChange={(e) => setDesiredSlug(e.target.value.toUpperCase())}
            pattern="[A-Z0-9-]+"
            className="border-border bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
          />
        </label>

        {error && <p className="text-destructive mt-3 text-xs">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCompile}
            disabled={busy || !desiredSlug}
            className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
          >
            {busy ? "Compiling…" : "Compile via Claude"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into page.tsx**

In `apps/journey-control/src/app/page.tsx`, replace the disabled "Compile (TBD)" button with:

```tsx
import { CompileDialog } from "@/components/compile-dialog";

// In the component state:
const [compileFor, setCompileFor] = useState<{ slug: string; title: string } | null>(null);

// Replace the disabled button:
<button
  onClick={() => setCompileFor({ slug: selectedSlug, title: selectedTitle })}
  className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-4 py-2 text-sm font-medium"
>
  Compile via Claude
</button>

// At the bottom of <main>:
{compileFor && (
  <CompileDialog
    draftSlug={compileFor.slug}
    draftTitle={compileFor.title}
    onClose={() => setCompileFor(null)}
    onCompiled={(newSlug) => {
      setCompileFor(null);
      // Refresh list — user must manually register in PROTOCOL_REGISTRY
      alert(`Compiled to ${newSlug}. Register it in apps/e2e/protocols/index.ts before running.`);
    }}
  />
)}
```

Note: `selectedTitle` needs to be captured in `onSelect` — adjust JourneyList signature to also pass title.

- [ ] **Step 3: Smoke test**

Start dev. Pick a draft. Click compile. Confirm dialog. Verify file written + alert shown.

Kill dev.

- [ ] **Step 4: Commit**

```bash
git add apps/journey-control/src/components/compile-dialog.tsx apps/journey-control/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(journey-control): CompileDialog wires draft→IR via Claude

Modal with slug input + busy/error states. On success, alerts user to
manually register the new slug in PROTOCOL_REGISTRY (auto-registry
lands as a follow-up).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 23: Auto-register compiled IR in PROTOCOL_REGISTRY

**Files:**
- Modify: `apps/journey-control/src/app/api/journeys/compile/route.ts`

- [ ] **Step 1: Add registry-rewrite step**

After `fs.writeFile` for the new TS file, append a registry update:

```ts
// Append after fs.writeFile of the compiled IR:
const registryPath = path.join(repoRoot, "apps/e2e/protocols/index.ts");
const registryContent = await fs.readFile(registryPath, "utf8");

// Append import + registry entry. Idempotent.
const constName = result.ir.slug.replace(/[^A-Za-z0-9]/g, "");
const importLine = `import { ${constName} } from "./${result.ir.slug}-${parsed.data.draft_slug}";`;
const entryLine = `  "${result.ir.slug}": ${constName},`;

let next = registryContent;
if (!next.includes(importLine)) {
  // Insert import after last existing import line
  next = next.replace(/(import [\s\S]+?;\n)(?!import)/, (m) => m + importLine + "\n");
}
if (!next.includes(`"${result.ir.slug}":`)) {
  next = next.replace(/(PROTOCOL_REGISTRY\s*=\s*\{)/, `$1\n${entryLine}`);
}
await fs.writeFile(registryPath, next, "utf8");
```

- [ ] **Step 2: Smoke compile + run end-to-end**

Compile a fresh draft via UI. Verify:
- TS file written to `apps/e2e/protocols/`
- `index.ts` updated with import + registry entry
- The new slug appears in `GET /api/journeys` (hit refresh)
- Click new compiled card → click Run → SSE log streams Playwright

Kill dev.

- [ ] **Step 3: Commit**

```bash
git add apps/journey-control/src/app/api/journeys/compile/route.ts
git commit -m "$(cat <<'EOF'
feat(journey-control): auto-register compiled IR in PROTOCOL_REGISTRY

Idempotent insertion of import + registry entry into apps/e2e/
protocols/index.ts. End-to-end draft→IR→run flow now closed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8: Stop / abort + final polish

### Task 24: Abort run from UI

**Files:**
- Create: `apps/journey-control/src/app/api/journeys/[slug]/abort/[runId]/route.ts`
- Modify: `apps/journey-control/src/components/run-viewer.tsx` to add abort button
- Modify: `apps/journey-control/src/app/page.tsx` to wire abort

- [ ] **Step 1: Implement abort route**

```ts
// apps/journey-control/src/app/api/journeys/[slug]/abort/[runId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { abortRun } from "@/lib/journey-runner";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; runId: string }> },
) {
  const { runId } = await ctx.params;
  const ok = abortRun(runId);
  return NextResponse.json({ ok });
}
```

- [ ] **Step 2: Add abort button to RunViewer**

```tsx
// In run-viewer.tsx header, before the done badge:
{!done && (
  <button
    onClick={async () => {
      await fetch(`/api/journeys/${slug}/abort/${runId}`, { method: "POST" });
    }}
    className="text-destructive hover:text-destructive/80 text-xs"
  >
    Abort
  </button>
)}
```

- [ ] **Step 3: Smoke test**

Start a normal-speed run. Click abort. Verify Playwright child receives SIGTERM, exits, run-viewer shows "killed" or "exit X".

- [ ] **Step 4: Commit**

```bash
git add apps/journey-control/src/app/api/journeys/\[slug\]/abort/\[runId\]/route.ts apps/journey-control/src/components/run-viewer.tsx
git commit -m "$(cat <<'EOF'
feat(journey-control): abort button on RunViewer + abort API route

POST /api/journeys/[slug]/abort/[runId] sends SIGTERM. UI shows abort
during running state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 25: Search filter for drafts

**Files:**
- Modify: `apps/journey-control/src/components/journey-list.tsx`

- [ ] **Step 1: Add search input**

```tsx
// At top of JourneyList component body:
const [search, setSearch] = useState("");

const filteredDrafts = drafts.filter(
  (d) =>
    !search ||
    d.slug.toLowerCase().includes(search.toLowerCase()) ||
    d.title.toLowerCase().includes(search.toLowerCase()),
);

// Above drafts <section>, render:
<input
  placeholder="Search drafts…"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="border-border bg-background mb-3 w-full rounded-md border px-3 py-2 text-sm"
/>

// Replace `{drafts.slice(0, 50).map(...)}` with `{filteredDrafts.slice(0, 50).map(...)}`
// Replace count `{drafts.length}` with `{filteredDrafts.length}`
```

- [ ] **Step 2: Commit**

```bash
git add apps/journey-control/src/components/journey-list.tsx
git commit -m "$(cat <<'EOF'
feat(journey-control): search filter for 235 drafts

Case-insensitive slug + title contains. 50-item render cap survives.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9: Documentation + closure gates

### Task 26: ADR-0284 — Speed profile convention

**Files:**
- Create: `docs/decisions/0284-journey-speed-profiles.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write ADR**

Use `docs/templates/decision.md` as template. Title: "Journey speed profiles: full / normal / ai_companion". Status: `proposed`. Document:
- Context: runner needs scalable timing for human observation + AI narration
- Decision: 3 named profiles, IR `speed_profile` field optional, env-var override
- Multipliers: full=1x, normal=3x settle / 3x retry / 2x timeout, ai_companion=8x/6x/3x
- Consequences: backward-compatible (default full preserves CI behavior); slower runs require attention to gate timeouts
- Alternatives: free-form numeric multiplier (rejected — too fine-grained, no semantics)

- [ ] **Step 2: Register in decision-log**

Append to `docs/decisions/0000-decision-log.md` with proper formatting.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0284-journey-speed-profiles.md docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(adr-0284): journey speed profiles — full/normal/ai_companion

Records the 3-profile convention and the multiplier table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 27: User journey doc

**Files:**
- Create: `docs/journeys/JOURNEY-journey-control-center.md`

- [ ] **Step 1: Write journey doc**

Use the user-journey format from `docs/journeys/JOURNEY-onboarding-flow.md` as template. Document:

- Journey: Run a compiled journey at chosen speed
- Journey: Compile a draft markdown into runnable IR
- Journey: Abort a running journey mid-run
- Journey: Search drafts by slug or title

Each: Precondition / numbered steps / Postcondition / Error paths.

- [ ] **Step 2: Commit**

```bash
git add docs/journeys/JOURNEY-journey-control-center.md
git commit -m "$(cat <<'EOF'
docs(journey): JOURNEY-journey-control-center.md

4 user journeys: run, compile, abort, search.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 28: Handoff doc

**Files:**
- Create: `docs/HANDOFF-journey-control-center.md`

- [ ] **Step 1: Write handoff**

Sections:
- Summary: what was built (standalone Next.js dashboard, 3 speed profiles, markdown→IR via Claude, auto-register)
- Architecture: file map + data flow diagram
- Decisions: link to ADR-0284, key trade-offs (file-based vs DB-backed, LLM-only compile)
- Learnings: gotchas (e.g. registry rewrite is regex-based and fragile; production usage requires ANTHROPIC_API_KEY in env)
- Known issues: registry rewrite only handles single-line entries; large markdown drafts may hit Claude max_tokens limit
- Next steps: (Sortie B) port `/join` to JourneyIR; refresh P-001 against current `/onboarding`; add Fjernkontroll-style step indicator UI; add LLM-mediated worker for run-time pause/speed change

- [ ] **Step 2: Commit**

```bash
git add docs/HANDOFF-journey-control-center.md
git commit -m "$(cat <<'EOF'
docs(handoff): journey-control-center

Summary, architecture, decisions, learnings, known issues, next steps.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 29: Final typecheck + manual smoke

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: PASS — 0 errors

- [ ] **Step 2: Full test suite**

Run: `pnpm turbo test --filter @smartout/journey-ir --filter e2e --filter @smartout/journey-control`
Expected: PASS — all unit tests green

- [ ] **Step 3: End-to-end smoke**

1. Start dev: `op run --env-file=.env.template -- pnpm --filter @smartout/journey-control dev`
2. Open http://localhost:3334
3. Verify list loads (1 compiled, 235 drafts, search works)
4. Pick P-001 → Speed: Normal → Run → verify SSE log streams, exits 0 (or expected fail-state)
5. Pick a draft → Compile via Claude → enter slug → confirm new card appears as compiled
6. Run the new compiled journey
7. Abort a running journey mid-flight → verify SIGTERM ends it cleanly

If any step fails, fix and re-test before closure.

- [ ] **Step 4: Update DASHBOARD.md**

Run: `/status` to refresh `docs/DASHBOARD.md`.

- [ ] **Step 5: Final commit + ready for closure**

If any final adjustments, commit them. Then announce: "Sortie ready for `/close-feature`."

---

## Self-Review Checklist

After plan execution, the implementer should verify:

- [ ] **Spec coverage:** Every user-stated capability (local server, dashboard, list compiled + drafts, pick journey, compile draft, run with 3 speeds, watch live, full control) maps to a task.
- [ ] **No placeholders:** No "TODO", "TBD", "implement later" in committed code.
- [ ] **Type consistency:** `SpeedProfile` type used uniformly across `packages/journey-ir`, `apps/e2e/runners`, and `apps/journey-control`.
- [ ] **No new auth surface:** Local-only, no Supabase auth, no godmode coupling.
- [ ] **Existing P-001 unchanged:** P-001-admin-onboarding.ts not edited (other than via PROTOCOL_REGISTRY auto-registration which adds OTHER entries).
- [ ] **Speed profile multipliers documented:** ADR-0284 lists exact multipliers per profile.
- [ ] **Idempotent registry rewrite:** Compile twice on same draft = no duplicate registry entries.
- [ ] **Smoke verified:** All 7 E2E smoke steps in Task 29 passed.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Claude returns invalid JSON | Schema validates, returns 422 with error path. User retries. |
| Registry rewrite regex misses edge cases | Idempotency check prevents duplicates; manual fallback documented in handoff. |
| Playwright child hangs | 10-min safety timeout in journey-runner.ts kills it. |
| ANTHROPIC_API_KEY leaked in client | API route reads from server-side env only; never sent to browser. |
| Concurrent runs overwhelm server | Single-run lock returns 409. |
| Large markdown exceeds Claude max_tokens | max_tokens=8192 in compiler; document this in handoff; future task split-compile if needed. |
| New compiled file breaks typecheck | Smoke step 4 catches; user revises markdown + retries. |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-journey-control-center.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in current session with checkpoints for review.

Which approach?
