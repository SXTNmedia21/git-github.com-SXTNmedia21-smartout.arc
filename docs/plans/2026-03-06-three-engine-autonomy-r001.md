# Three-Engine Autonomy (R-001) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver one fully enforced, observable, and test-gated roadmap package for `R-001` (Admin onboarding) using System + Industry + Artificial Intelligence engines.

**Architecture:** Implement a vertical slice first: package gating in Journey status transitions, canonical event envelope emission, mission/license runtime checks, and control visibility for admin. Keep scope strictly to `R-001` for first release, then replicate to other roadmaps.

**Tech Stack:** Next.js App Router (`apps/web`), Supabase Postgres + migrations, Stage Engine (`services/stage-engine`), TypeScript + Zod, Vitest (`apps/web`), Playwright (`apps/e2e`), tsx e2e scripts (`services/stage-engine`).

---

## Preconditions

- Work in a dedicated worktree branch for this plan.
- Use TDD for each code task (write failing test first).
- Keep commits atomic (`feat|fix|refactor(scope): ...`).

---

### Task 1: Add Event Envelope DB and Type Contracts

**Files:**

- Create: `supabase/migrations/20260306120000_event_envelope_runtime.sql`
- Modify: `packages/types/src/journey.ts`
- Modify: `packages/types/src/enums.ts`
- Test: `apps/web/src/lib/journey/__tests__/event-envelope-schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { JourneyEventEnvelopeSchema } from "@smartout/types";

describe("JourneyEventEnvelopeSchema", () => {
  it("accepts canonical envelope with required fields", () => {
    const parsed = JourneyEventEnvelopeSchema.safeParse({
      event_id: crypto.randomUUID(),
      event_name: "step_completed",
      event_version: "1.0",
      occurred_at: new Date().toISOString(),
      workspace_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      source: { domain: "journey", service: "web", component: "OnboardingWizard" },
      actor: { type: "user", id: crypto.randomUUID(), role: "admin" },
      subject: { kind: "step", id: "R-001.step.business.confirm-company" },
      state: { from: "in_progress", to: "completed" },
      severity: "info",
      payload: {},
      tags: ["roadmap:R-001"],
      provenance: { channel: "ui", request_id: null, trace_id: null },
    });
    expect(parsed.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/lib/journey/__tests__/event-envelope-schema.test.ts`
Expected: FAIL with missing schema/type export.

**Step 3: Write minimal implementation**

- Add new enums/types/schema in `packages/types/src/enums.ts` and `packages/types/src/journey.ts`.
- Add migration for `event_envelope` table + indexes.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/lib/journey/__tests__/event-envelope-schema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/20260306120000_event_envelope_runtime.sql packages/types/src/enums.ts packages/types/src/journey.ts apps/web/src/lib/journey/__tests__/event-envelope-schema.test.ts
git commit -m "feat(journey): add canonical event envelope schema and storage"
```

---

### Task 2: Enforce Package Gates on Journey Status Transition API

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts`
- Modify: `apps/web/src/lib/journey/status-transitions.ts`
- Create: `apps/web/src/lib/journey/package-gates.ts`
- Test: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.test.ts`

**Step 1: Write the failing test**

```ts
it("blocks transition to ready_impl when mission/license are missing", async () => {
  const res = await POST(
    buildRequest({ newStatus: "ready_impl" }),
    buildParams(journeyIdWithoutPackage),
  );
  expect(res.status).toBe(422);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.test.ts`
Expected: FAIL because transition currently allows `defined -> ready_impl`.

**Step 3: Write minimal implementation**

- Add `validateJourneyPackageGates()` in `package-gates.ts`.
- Call gate validation in transition route before status update.
- Return structured failure payload with missing artifacts.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts apps/web/src/lib/journey/status-transitions.ts apps/web/src/lib/journey/package-gates.ts apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.test.ts
git commit -m "feat(journey): enforce package gates for status transitions"
```

---

### Task 3: Emit Canonical Envelope Events from Transition Route

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts`
- Create: `apps/web/src/lib/journey/event-envelope.ts`
- Test: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/envelope.test.ts`

**Step 1: Write the failing test**

```ts
it("writes canonical envelope event on status transition", async () => {
  await POST(buildRequest({ newStatus: "review" }), buildParams(validJourneyId));
  expect(mockInsertEventEnvelope).toHaveBeenCalledWith(
    expect.objectContaining({ event_name: "status_change", correlation_id: expect.any(String) }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/app/api/platform-admin/journeys/[id]/transition/envelope.test.ts`
Expected: FAIL because no envelope writer exists.

**Step 3: Write minimal implementation**

- Add `buildEventEnvelope()` helper.
- Write envelope row after journey status update.
- Keep old `journey_event` insert for compatibility during rollout.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/app/api/platform-admin/journeys/[id]/transition/envelope.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts apps/web/src/lib/journey/event-envelope.ts apps/web/src/app/api/platform-admin/journeys/[id]/transition/envelope.test.ts
git commit -m "feat(journey): emit canonical envelope events on transitions"
```

---

### Task 4: Wire Mission + Journey Step Gate Checks in Stage Engine

**Files:**

- Modify: `services/stage-engine/src/core/stage-manager.ts`
- Modify: `services/stage-engine/src/core/session-manager.ts`
- Modify: `services/stage-engine/src/types/session.ts`
- Test: `services/stage-engine/test/e2e.ts`

**Step 1: Write the failing test**

```ts
// In stage-engine e2e
assert.equal(result.errorCode, "LICENSE_GATE_FAILED");
assert.equal(result.canAdvance, false);
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @smartout/stage-engine test:e2e`
Expected: FAIL because stages do not yet call license gate checks.

**Step 3: Write minimal implementation**

- Add gate evaluation before stage advance.
- Return structured gate result (`pass|fail`, reasons, escalation).
- Emit runtime event for gate decision.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @smartout/stage-engine test:e2e`
Expected: PASS for gate pass/fail scenarios.

**Step 5: Commit**

```bash
git add services/stage-engine/src/core/stage-manager.ts services/stage-engine/src/core/session-manager.ts services/stage-engine/src/types/session.ts services/stage-engine/test/e2e.ts
git commit -m "feat(stage-engine): enforce mission and license gates before stage advance"
```

---

### Task 5: Add Onboarding Package Gate Data Model

**Files:**

- Create: `supabase/migrations/20260306123000_journey_package_gates.sql`
- Modify: `supabase/migrations/20260323200000_seed_onboarding_journey.sql`
- Test: `apps/web/src/lib/journey/__tests__/package-gates-db.test.ts`

**Step 1: Write the failing test**

```ts
it("returns missing gate for R-001 when mission artifact is absent", async () => {
  const status = await getJourneyPackageGateStatus(workspaceId, "J-ONBOARD-001");
  expect(status.missing).toContain("mission");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/lib/journey/__tests__/package-gates-db.test.ts`
Expected: FAIL because package gate table/query does not exist.

**Step 3: Write minimal implementation**

- Add `journey_package_artifact` and `journey_package_gate` tables.
- Seed `R-001` package IDs (`JP-R001-ADMIN-ONBOARDING`, `M-001`, `L-001`).

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/lib/journey/__tests__/package-gates-db.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/20260306123000_journey_package_gates.sql supabase/migrations/20260323200000_seed_onboarding_journey.sql apps/web/src/lib/journey/__tests__/package-gates-db.test.ts
git commit -m "feat(journey): add package artifact and gate persistence for R-001"
```

---

### Task 6: Expose Package Health in Platform Admin Journey Detail

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/[id]/_components/package-health-card.tsx`
- Modify: `apps/web/src/app/api/platform-admin/journeys/[id]/route.ts`
- Test: `apps/web/src/app/platform-admin/journeys/[id]/_components/package-health-card.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders missing package gates and blocks activation warning", () => {
  render(<PackageHealthCard gates={{ missing: ["license"], canActivate: false }} />);
  expect(screen.getByText(/license/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/app/platform-admin/journeys/[id]/_components/package-health-card.test.tsx`
Expected: FAIL because component does not exist.

**Step 3: Write minimal implementation**

- Add package health card component.
- Extend journey detail API response with package gate status.
- Render package health in journey detail UI.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/app/platform-admin/journeys/[id]/_components/package-health-card.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx apps/web/src/app/platform-admin/journeys/[id]/_components/package-health-card.tsx apps/web/src/app/api/platform-admin/journeys/[id]/route.ts apps/web/src/app/platform-admin/journeys/[id]/_components/package-health-card.test.tsx
git commit -m "feat(platform-admin): show journey package health and gate blockers"
```

---

### Task 7: Add R-001 Function Test and End-to-End Flow Assertions

**Files:**

- Modify: `apps/e2e/tests/onboarding.spec.ts`
- Create: `apps/e2e/tests/journey-r001-package.spec.ts`
- Test: `apps/e2e/tests/journey-r001-package.spec.ts`

**Step 1: Write the failing test**

```ts
test("R-001 package completes with required gates", async ({ page }) => {
  // execute onboarding flow
  // assert package status in admin journey detail
  await expect(page.getByText("JP-R001-ADMIN-ONBOARDING")).toBeVisible();
  await expect(page.getByText(/can activate/i)).toBeVisible();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter e2e test:e2e -- --grep "R-001 package"`
Expected: FAIL because package status is not yet surfaced end-to-end.

**Step 3: Write minimal implementation**

- Update selectors and asserts to match implemented package health UI.
- Validate mission/license/function gate visibility and state.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter e2e test:e2e -- --grep "R-001 package"`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/e2e/tests/onboarding.spec.ts apps/e2e/tests/journey-r001-package.spec.ts
git commit -m "test(e2e): add R-001 package completion and gate assertions"
```

---

### Task 8: Documentation and Rollout Controls

**Files:**

- Modify: `docs/engines/system-inteligence/10-implementation-and-gap-plan.md`
- Modify: `docs/modules/MODULE_0_ROADMAP.md`
- Modify: `docs/agents/framework/EVENT_MOTOR.md`
- Modify: `docs/SESSION.md`
- Test: `docs` verification via lint/typecheck commands

**Step 1: Write the failing doc checklist test (manual)**

Create checklist:

- Are all runtime gate contracts referenced from Event Motor?
- Is R-001 marked as first implemented package?
- Are rollout flags documented?

**Step 2: Run verification command**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS.

**Step 3: Write minimal doc updates**

- Mark completed first-slice implementation.
- Document rollout flag strategy for next roadmaps (`R-010`, `R-012`, `R-013`, `R-018`).

**Step 4: Re-run verification**

Run: `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter @smartout/stage-engine typecheck`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/engines/system-inteligence/10-implementation-and-gap-plan.md docs/modules/MODULE_0_ROADMAP.md docs/agents/framework/EVENT_MOTOR.md docs/SESSION.md
git commit -m "docs(module-0): finalize R-001 rollout notes and replication plan"
```

---

## Rollout Sequence After R-001

1. `R-010` Complete Protocol Training
2. `R-012` Daily Department Operation
3. `R-013` Daily Financial Close
4. `R-018` Process Engine Orchestration

Replicate the same package-gate + envelope + mission/license + test pattern for each roadmap, one at a time.

---

## Done Criteria for This Plan

- `R-001` cannot progress to `ready_impl` or `active` without package completeness.
- Transition and runtime hooks emit canonical event envelope records.
- Mission and license gates are enforced in stage advancement.
- Admin Journey detail shows package health and blockers.
- E2E proves package completion path.

---

## Skill References

- `@superpowers:test-driven-development`
- `@superpowers:verification-before-completion`
- `@superpowers:executing-plans`
- `@superpowers:subagent-driven-development`
