---
title: "Protocol Verification Engine"
status: draft
updated: 2026-03-29
created: 2026-03-29
module: testing
tags: [protocol, verification, playwright, journey, mission, e2e, state-machine]
council_verdict: "APPROVE WITH CHANGES"
council_date: 2026-03-29
---

# Protocol Verification Engine — Design Spec

## 1. Purpose

Automate the validation, documentation, and mission generation for Smartout's Protokoll packages. Each Protokoll (Journey + Mission + Roadmap + License) represents an atomic user workflow — from admin onboarding to daily handover. Today these exist as markdown docs. This system makes them executable.

**One run produces 4 outputs:**

1. **Test** — Verified journey with per-step gate results
2. **Docs** — Screenshots + explanatory text per step (user guide)
3. **Mission** — Draft `engine_missions` + `engine_stages` records for Stage Engine
4. **UX Audit** — Friction report with improvement recommendations

## 2. Architecture — 3 Layers

```
Protokoll Package (docs/)          journey_step (DB, read-only)
        │                                    │
        ▼                                    ▼
┌────────────────────────────────────────────────┐
│  Layer 1: PROTOCOL DEFINITION                  │
│  Zod schema defining steps, actions, gates     │
│  Source: TypeScript definition files            │
│  in apps/e2e/protocols/                        │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│  Layer 2: PROTOCOL RUNNER (Playwright)         │
│  Deterministic executor. No LLM.              │
│  Navigates, fills, clicks, checks gates.      │
│  Takes screenshots. Measures timing.           │
│  Writes results to journey_test_run.test_output│
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│  Layer 3: OUTPUT GENERATOR (LLM, post-run)     │
│  Reads raw results + screenshots.             │
│  Produces: docs, mission draft, UX audit.      │
│  Mission → engine_missions + engine_stages     │
│  with status='draft' for human review.         │
└────────────────────────────────────────────────┘
```

### Council Decision: No `protocol.json` intermediate format

The council rejected a standalone `protocol.json` file format because it creates a dual source of truth with `journey_step` (DB, ADR-0031). Instead:

- **Protocol definitions** live as TypeScript files in `apps/e2e/protocols/` with full Zod validation
- **journey_step** remains the metadata registry (read-only input). Generator reads it, never writes it.
- **Protocol definitions** reference `journey_step.slug` for linkage but contain Playwright-specific execution details (selectors, actions, gates) that don't belong in the journey metadata.

## 3. Layer 1 — Protocol Definition

### File structure

```
apps/e2e/
├── protocols/
│   ├── schema.ts            ← Zod schemas for ProtocolDefinition
│   ├── P-001-admin-onboarding.ts
│   ├── P-002-training-confirmation.ts
│   ├── P-003-daily-control-round.ts
│   ├── P-004-new-employee-start.ts
│   └── P-005-daily-handover.ts
├── runners/
│   ├── protocol-runner.ts   ← Playwright executor
│   └── gate-checker.ts      ← DB/UI gate verification
├── generators/
│   ├── docs-generator.ts    ← Screenshot → markdown guide
│   ├── mission-generator.ts ← Results → engine_missions draft
│   └── audit-generator.ts   ← Timing/friction → UX report
└── tests/
    └── protocol.spec.ts     ← Playwright test that invokes runner
```

### Protocol Definition Schema

```typescript
import { z } from "zod";

const GateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("db_record"),
    table: z.string(),
    where: z.record(z.unknown()),
    expect: z.record(z.unknown()),
    timeout_ms: z.number().default(10_000),
    retry_interval_ms: z.number().default(500),
  }),
  z.object({
    type: z.literal("ui_state"),
    testid: z.string(), // data-testid value
    visible: z.boolean().default(true),
    timeout_ms: z.number().default(5_000),
  }),
  z.object({
    type: z.literal("url_match"),
    pattern: z.string(), // regex
    timeout_ms: z.number().default(10_000),
  }),
]);

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), url: z.string() }),
  z.object({ type: z.literal("fill"), testid: z.string(), value: z.string() }),
  z.object({ type: z.literal("click"), testid: z.string() }),
  z.object({ type: z.literal("click_text"), text: z.string() }),
  z.object({ type: z.literal("wait_visible"), testid: z.string() }),
  z.object({ type: z.literal("wait_hidden"), testid: z.string() }),
  z.object({ type: z.literal("settle"), ms: z.number().default(1500) }),
]);

const StepSchema = z.object({
  id: z.string(), // e.g. "1_registration"
  order: z.number(),
  title: z.string(), // Norwegian display name
  description: z.string(), // What this step does (for docs)
  journey_step_slug: z.string().optional(), // links to journey_step.slug
  actions: z.array(ActionSchema),
  gate: GateSchema,
  screenshot: z.boolean().default(true),
});

export const ProtocolDefinitionSchema = z.object({
  id: z.string(), // "P-001"
  package_id: z.string(), // "JP-R001-ADMIN-ONBOARDING"
  name: z.string(), // "Admin Onboarding"
  actor: z.enum(["owner", "admin", "manager", "employee"]),
  platform: z.enum(["web", "mobile"]),
  auth_profile: z.enum(["admin", "employee", "godmode"]),
  entry_url: z.string(),
  preconditions: z.object({
    db_state: z
      .array(
        z.object({
          table: z.string(),
          where: z.record(z.unknown()),
          expect: z.record(z.unknown()),
        }),
      )
      .default([]),
  }),
  steps: z.array(StepSchema),
  success_gate: GateSchema,
});

export type ProtocolDefinition = z.infer<typeof ProtocolDefinitionSchema>;
export type ProtocolStep = z.infer<typeof StepSchema>;
export type Gate = z.infer<typeof GateSchema>;
export type Action = z.infer<typeof ActionSchema>;
```

### Selector Strategy

**All selectors use `data-testid` exclusively.** No CSS selectors for user-visible elements. The `testid` field maps to `[data-testid="value"]` in the DOM. This makes selectors:

- Resilient to DOM restructuring
- Greppable across the codebase
- Decoupled from visual styling

**Exception:** `fill` actions on form inputs use testid on the input or its wrapping label. `click_text` uses visible text for buttons without testids (fallback).

### Variables

Protocol definitions support `{{variable}}` interpolation from fixture data:

- `{{auth.email}}`, `{{auth.password}}` — from auth fixture
- `{{fixture.workspace_id}}`, `{{fixture.department_id}}` — from seed fixture
- Interpolated at runtime by the runner before execution

## 4. Layer 2 — Protocol Runner

### Execution model

```
for each step in protocol.steps:
  1. EXECUTE actions (navigate, fill, click)
  2. SETTLE (wait 1500ms for spring animations)
  3. CHECK gate (poll DB or UI until pass or timeout)
  4. CAPTURE screenshot (if step.screenshot = true)
  5. RECORD timing + gate result
  if gate fails → STOP, record failure, persist partial results
```

### Gate Checker

```typescript
// Pseudocode for gate checking
async function checkGate(gate: Gate, supabase: SupabaseClient): Promise<GateResult> {
  const deadline = Date.now() + gate.timeout_ms;

  while (Date.now() < deadline) {
    if (gate.type === "db_record") {
      const { data } = await supabase.from(gate.table).select("*").match(gate.where).maybeSingle();

      if (gate.expect.exists === true && data) return { passed: true, data };
      if (gate.expect.exists === false && !data) return { passed: true, data: null };
      if (data && matchesExpect(data, gate.expect)) return { passed: true, data };
    }

    if (gate.type === "ui_state") {
      const visible = await page
        .getByTestId(gate.testid)
        .isVisible({ timeout: 100 })
        .catch(() => false);
      if (visible === gate.visible) return { passed: true };
    }

    if (gate.type === "url_match") {
      if (new RegExp(gate.pattern).test(page.url())) return { passed: true };
    }

    await page.waitForTimeout(gate.retry_interval_ms ?? 500);
  }

  return { passed: false, error: `Gate timeout after ${gate.timeout_ms}ms` };
}
```

### Result Storage

**Council decision: Use JSONB on `journey_test_run.test_output`.**

The runner writes to the existing `journey_test_run` table with `test_type = 'protocol'`. Per-step results go into `test_output` JSONB:

```typescript
type ProtocolTestOutput = {
  protocol_id: string;
  protocol_name: string;
  steps: Array<{
    step_id: string;
    step_order: number;
    title: string;
    status: "passed" | "failed" | "skipped" | "timeout";
    gate_type: string;
    gate_query: Record<string, unknown>;
    gate_result: Record<string, unknown>;
    screenshot_path: string | null;
    duration_ms: number;
    timing: {
      action_ms: number; // Time to execute actions
      settle_ms: number; // Animation settle time
      gate_ms: number; // Time gate took to pass
    };
  }>;
  friction_data: {
    total_duration_ms: number;
    slowest_step: string;
    failed_gates: string[];
    notes: string[]; // Auto-detected: slow loads, retries, etc.
  };
};
```

**Justification for JSONB vs new table:** Step results have no independent lifecycle — they are always queried in the context of a test run. JSONB avoids a new table with RLS, workspace_id, updated_at, indexes. The `test_output` column already stores structured data per the existing `JourneyReporter`.

**New enum value needed:** Add `'protocol'` to `journey_test_type` enum (currently `'automated' | 'manual'`).

### Migration

```sql
-- Add 'protocol' to journey_test_type enum
ALTER TYPE journey_test_type ADD VALUE IF NOT EXISTS 'protocol';
```

### Screenshots

- Stored in `apps/e2e/test-results/protocols/{protocol_id}/` during run
- Naming: `{protocol_id}_{actor}_{step_order}_{step_id}_{colorScheme}_{viewport}.png`
- Example: `P-001_admin_01_registration_light_1440x900.png`

### Runner Configuration

```typescript
const RUNNER_CONFIG = {
  viewport: { width: 1440, height: 900 },
  colorScheme: "light" as const,
  settleDelay: 1500, // ms, calibrated to spring profile
  screenshotDir: "./test-results/protocols",
  headless: true,
};
```

### Playwright Integration

The runner is invoked as a Playwright test:

```typescript
// apps/e2e/tests/protocol.spec.ts
import { test } from "../fixtures/base";
import { runProtocol } from "../runners/protocol-runner";
import { P001_ADMIN_ONBOARDING } from "../protocols/P-001-admin-onboarding";

test.describe("Protocol: Admin Onboarding", () => {
  test("P-001 full journey", async ({ page }) => {
    const result = await runProtocol(page, P001_ADMIN_ONBOARDING);
    expect(result.success).toBe(true);
    // Results persisted to journey_test_run by runner
  });
});
```

### Telemetry

Every protocol run emits via `@smartout/telemetry`:

- `protocol_run.started` — protocol_id, actor
- `protocol_run.step_passed` — protocol_id, step_id, duration_ms
- `protocol_run.step_failed` — protocol_id, step_id, gate_error
- `protocol_run.completed` — protocol_id, result, total_duration_ms

Register these in `packages/telemetry/src/registry.ts`.

## 5. Layer 3 — Output Generator

Post-run LLM processing. Invoked separately: `pnpm protocol:generate P-001`

### Input

- `journey_test_run` row with `test_output` JSONB (from Layer 2)
- Screenshots from `test-results/protocols/{protocol_id}/`
- Protokoll markdown docs: Journey.md, Mission.md, Roadmap.md, License.md

### Output 1: Documentation (User Guide)

```markdown
---
title: "Guide: Admin Onboarding"
protocol_id: P-001
generated: 2026-03-29
---

# Admin Onboarding — Steg-for-steg

## 1. Registrering

![Steg 1](./screenshots/P-001_admin_01_registration_light_1440x900.png)

Logg inn med e-post og passord. Systemet oppretter din brukerprofil automatisk.

## 2. Velg modus

![Steg 2](./screenshots/P-001_admin_02_hero_light_1440x900.png)

Velg mellom assistert oppsett (5 min med AI-guide) eller manuelt oppsett (10 min).
```

**Output path:** `docs/guides/GUIDE-{protocol_id}.md`

**Audience:** Internal first (QA/developer). If customer-facing, requires MDX rendering pipeline with Nordic Split typography (Instrument Serif headings, Geist Sans body).

### Output 2: Mission Draft

**Target:** `engine_missions` + `engine_stages` (database schema, not registry.ts)

The generator produces a "Generated Mission Package" validated by Zod:

```typescript
const GeneratedMissionPackageSchema = z.object({
  mission: z.object({
    name: z.string(),
    description: z.string(),
    system_prompt: z.string(),
    mode: z.enum(["sequential", "free", "hybrid"]).default("sequential"),
    language: z.enum(["no", "en", "sv"]).default("no"),
    is_active: z.literal(false), // Always draft
  }),
  stages: z.array(
    z.object({
      stage_order: z.number(),
      name: z.string(),
      goal: z.string(),
      instructions: z.string(),
      success_criteria: z.string(),
      escalation_instructions: z.string().optional(),
      creative_freedom: z.number().min(0).max(1).default(0.3),
      emotion_hint: z.string().optional(),
      is_required: z.boolean().default(true),
      journey_step_slug: z.string().optional(), // Links to journey_step
      tool_hints: z.array(z.string()).optional(), // Tool names observed during run
    }),
  ),
  guardrails: z.array(
    z.object({
      stage_order: z.number(),
      description: z.string(),
      source: z.enum(["license", "journey", "observed"]),
    }),
  ),
});
```

**Output path:** `docs/missions/MISSION-DRAFT-{protocol_id}.json`

**Integration:** A separate manual step converts the draft to a migration SQL file. Generated missions are NEVER auto-inserted into the database. Human review is mandatory — the LLM cannot produce production-ready systemPrompts.

**Council decision:** MissionIdSchema remains a closed Zod enum. New missions require a code change to `types.ts`. This is acceptable because human review is mandatory anyway, and compile-time validation prevents broken missions from entering the registry.

### Output 3: UX Audit

```typescript
type UXAuditReport = {
  protocol_id: string;
  generated_at: string;
  overall_friction_score: number; // 0-10 (LLM assessment)
  total_duration_ms: number;
  steps: Array<{
    step_id: string;
    friction_score: number;
    observations: string[]; // ["Page load 3.2s", "Label unclear"]
    recommendations: string[]; // ["Add loading indicator", "Rename button"]
  }>;
  top_improvements: string[]; // Top 5 prioritized
  accessibility_notes: string[];
};
```

**Output path:** `docs/audits/AUDIT-{protocol_id}-{date}.md`

**Note:** Friction scores are LLM opinions, not measured metrics. They are stored in the audit document, NOT in database columns. The database stores only measured data (timing, pass/fail).

## 6. Initial 5 Protocols

| ID    | Name                     | Actor          | Entry URL                                                          | Steps (est.) | Key Gates                                                                            |
| ----- | ------------------------ | -------------- | ------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------ |
| P-001 | Admin Onboarding         | owner          | `/onboarding`                                                      | 9            | workspace created, departments exist, onboarding_completed=true                      |
| P-002 | Opplæring og bekreftelse | admin+employee | `/dashboard/governance` → `/dashboard/my-training`                 | 12           | policy created, protocol assigned, steps completed, test passed, signature saved     |
| P-003 | Daglig kontrollrunde     | admin          | `/dashboard/hms`                                                   | 8            | session opened, procedure steps completed, deviations logged, session signed off     |
| P-004 | Ny ansatt starter        | admin+employee | `/dashboard/people` → `/invite/[token]` → `/dashboard/my-training` | 14           | invitation sent, profile created, trainee status, protocols assigned, readiness=100% |
| P-005 | Daglig overlevering      | admin          | `/dashboard/operations`                                            | 6            | session closed, reconciliation created, approval submitted                           |

### Priority

P-001 first (reference package already exists). Then P-004 (most complete journey), P-002, P-003, P-005.

## 7. Frontend Requirements

### data-testid Coverage

Before any protocol can run, the target pages need stable `data-testid` attributes on:

- Step/section root containers (e.g., `data-testid="onboarding-step-business"`)
- Primary CTA buttons (e.g., `data-testid="onboarding-next-btn"`)
- Form inputs by field purpose (e.g., `data-testid="input-company-name"`)
- Key landmarks (sidebar nav, user menu, page headings)

**Estimated additions:** ~30-40 testid attributes for P-001, ~20 per additional protocol.

### Animation Settle

All Smartout pages use spring physics (stiffness 30-45, damping 20-24, mass 2-2.5). These take 800-1200ms to visually settle. The runner inserts a 1500ms settle delay after every navigation and significant state change. This is a fixed delay, not a Playwright `waitForTimeout` assertion.

### Headless Rendering Verification

Before first production run, verify in headless Chromium:

- Orb radial-gradients render correctly
- Noise overlay (feTurbulence SVG filter) is visible
- `backdrop-filter: blur()` works (glassmorphism cards)
- Warm OKLCH colors are not desaturated

If any fail, add Chromium flags: `--enable-features=BackdropFilter`, `--force-color-profile=srgb`.

## 8. ADR Required

**ADR-XXXX: Protocol Verification Engine Architecture**

Decisions to document:

1. Generator targets `engine_missions` + `engine_stages`, not `AgentMission` registry
2. `journey_step` is read-only input — generator never writes to it
3. Step results stored as JSONB in `journey_test_run.test_output`, not a separate table
4. Generated missions are always drafts (`is_active: false`) requiring human review
5. Protocol definitions are TypeScript files in `apps/e2e/protocols/`, not JSON files
6. Relationship to ADR-0031 (journey system) and ADR-0038 (output generators): this system EXTENDS the existing journey testing capability, not replaces it

## 9. Event Engine Boundary

The Protocol Verification Engine is NOT a workflow engine. It is a test/observation tool.

- **Cascade pipeline** produces events → **Event Engine** consumes them → **Protocol Runner** observes and verifies
- The runner never triggers engine processes or creates engine states
- Gate checks are read-only DB queries, not workflow state mutations
- This is explicitly different from `engine_state` / `engine_state_step` which track live workflow instances

## 10. Implementation Sequence

| Phase | What                                           | Depends On           |
| ----- | ---------------------------------------------- | -------------------- |
| **0** | Write ADR                                      | Nothing              |
| **1** | Layer 1: Schema + P-001 definition             | ADR approved         |
| **2** | Layer 2: Runner + gate checker                 | Layer 1              |
| **3** | Migration: add 'protocol' to journey_test_type | Layer 2              |
| **4** | data-testid additions to onboarding components | Layer 2              |
| **5** | Run P-001 end-to-end                           | Layers 1-2 + testids |
| **6** | Layer 3: Output generators                     | Layer 2 results      |
| **7** | P-002 through P-005 definitions                | Layer 1 proven       |
| **8** | CI integration                                 | All layers stable    |

## 11. Out of Scope

- Modifying existing E2E tests
- Modifying `packages/ai/src/missions/registry.ts` or `types.ts`
- Creating new database tables (uses existing journey_test_run)
- Auto-inserting generated missions into the database
- Mobile protocol runs (desktop only for v1)
- Visual regression testing (screenshots are for documentation, not comparison)
- Runtime enforcement of License gates in Stage Engine
