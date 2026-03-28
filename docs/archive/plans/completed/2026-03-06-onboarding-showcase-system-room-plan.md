---
title: "Onboarding Showcase System Room Plan"
status: draft
updated: 2026-04-10
created: 2026-03-06
module: meta
tags: []
---

# Onboarding Showcase System Room Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `/onboarding/showcase` into an interactive Smartout “system room” that is aligned with context, information, and agent capabilities while staying sandbox-only.

**Architecture:** Keep all implementation scoped to `apps/web/src/app/onboarding/showcase/`. Extract journey logic, policy logic, and scrape normalization into local `lib/` modules with unit tests. Keep the page as the orchestration shell and UI renderer using onboarding visual language. No cross-app or system-agnostic refactors.

**Tech Stack:** Next.js App Router (client page), TypeScript strict, Framer Motion, Supabase functions invoke, Vitest (`pnpm --filter web test`), ESLint, `pnpm --filter web typecheck`.

---

### Task 1: Build Journey Telemetry Domain (scoring, progress, profiling)

**Files:**

- Create: `apps/web/src/app/onboarding/showcase/lib/showcase-journey.ts`
- Test: `apps/web/src/app/onboarding/showcase/__tests__/showcase-journey.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  computeJourneyProgress,
  computeUnderstandingScore,
  inferUserProfile,
  formatDuration,
} from "../lib/showcase-journey";

describe("showcase journey domain", () => {
  it("computes progress from step + checkpoints", () => {
    expect(
      computeJourneyProgress({
        stepIndex: 2,
        totalSteps: 3,
        scrapeSuccesses: 1,
        hasQuizAnswer: true,
      }),
    ).toBeGreaterThan(70);
  });

  it("computes understanding score with bounded cap", () => {
    const score = computeUnderstandingScore({
      quizCorrect: 2,
      questionsAsked: 4,
      scrapeSuccesses: 2,
      interactionCount: 40,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(0);
  });

  it("infers profile label from behavior", () => {
    expect(inferUserProfile({ scrapeAttempts: 1, questionsAsked: 2, interactionCount: 8 })).toBe(
      "Data-drevet utforsker",
    );
  });

  it("formats durations consistently", () => {
    expect(formatDuration(3200)).toBe("3s");
    expect(formatDuration(65000)).toBe("1m 5s");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/showcase-journey.test.ts`
Expected: FAIL with missing module/functions.

**Step 3: Write minimal implementation**

```ts
export function computeJourneyProgress(input: {
  stepIndex: number;
  totalSteps: number;
  scrapeSuccesses: number;
  hasQuizAnswer: boolean;
}) {
  const stepProgress = ((input.stepIndex + 1) / Math.max(1, input.totalSteps)) * 70;
  const scrapeProgress = Math.min(20, input.scrapeSuccesses * 20);
  const quizProgress = input.hasQuizAnswer ? 10 : 0;
  return Math.min(100, Math.round(stepProgress + scrapeProgress + quizProgress));
}

export function computeUnderstandingScore(input: {
  quizCorrect: number;
  questionsAsked: number;
  scrapeSuccesses: number;
  interactionCount: number;
}) {
  return Math.min(
    100,
    Math.round(
      Math.min(40, input.quizCorrect * 20) +
        Math.min(24, input.questionsAsked * 6) +
        Math.min(24, input.scrapeSuccesses * 12) +
        Math.min(12, input.interactionCount / 2),
    ),
  );
}

export function inferUserProfile(input: {
  scrapeAttempts: number;
  questionsAsked: number;
  interactionCount: number;
}) {
  if (input.scrapeAttempts > 0 && input.questionsAsked > 0) return "Data-drevet utforsker";
  if (input.questionsAsked > 1) return "Nysgjerrig bruker";
  if (input.interactionCount > 10) return "Hands-on tester";
  return "Tidlig i journey";
}

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/showcase-journey.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/showcase/lib/showcase-journey.ts apps/web/src/app/onboarding/showcase/__tests__/showcase-journey.test.ts
git commit -m "feat(onboarding-showcase): add journey telemetry domain and tests"
```

---

### Task 2: Add Agent Policy Domain (manual speech + capability gates)

**Files:**

- Create: `apps/web/src/app/onboarding/showcase/lib/showcase-policy.ts`
- Test: `apps/web/src/app/onboarding/showcase/__tests__/showcase-policy.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { canSpeak, getCapabilityState, getPolicySummary } from "../lib/showcase-policy";

describe("showcase policy", () => {
  it("blocks speech when manual toggle is off", () => {
    expect(canSpeak({ voiceEnabled: false, hasManualTrigger: true })).toBe(false);
  });

  it("allows speech only with manual trigger", () => {
    expect(canSpeak({ voiceEnabled: true, hasManualTrigger: true })).toBe(true);
    expect(canSpeak({ voiceEnabled: true, hasManualTrigger: false })).toBe(false);
  });

  it("returns capability state map", () => {
    const state = getCapabilityState({ hasScrapeUrl: true, manualSpeech: true });
    expect(state.fetch).toBe("enabled");
    expect(state.speech).toBe("manual");
  });

  it("creates policy summary for UI", () => {
    expect(getPolicySummary({ manualSpeech: true })).toContain("manual");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/showcase-policy.test.ts`
Expected: FAIL with missing module/functions.

**Step 3: Write minimal implementation**

```ts
export function canSpeak(input: { voiceEnabled: boolean; hasManualTrigger: boolean }) {
  return input.voiceEnabled && input.hasManualTrigger;
}

export function getCapabilityState(input: { hasScrapeUrl: boolean; manualSpeech: boolean }) {
  return {
    navigate: "enabled",
    fill: "enabled",
    highlight: "enabled",
    fetch: input.hasScrapeUrl ? "enabled" : "idle",
    speech: input.manualSpeech ? "manual" : "disabled",
  } as const;
}

export function getPolicySummary(input: { manualSpeech: boolean }) {
  return input.manualSpeech
    ? "Speech policy: manual-only trigger."
    : "Speech policy: disabled until manually enabled.";
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/showcase-policy.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/showcase/lib/showcase-policy.ts apps/web/src/app/onboarding/showcase/__tests__/showcase-policy.test.ts
git commit -m "feat(onboarding-showcase): add agent policy guards and tests"
```

---

### Task 3: Add Scrape Normalizer Domain for input module hydration

**Files:**

- Create: `apps/web/src/app/onboarding/showcase/lib/showcase-scrape.ts`
- Test: `apps/web/src/app/onboarding/showcase/__tests__/showcase-scrape.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeScrapeData } from "../lib/showcase-scrape";

describe("showcase scrape normalizer", () => {
  it("normalizes missing fields safely", () => {
    const result = normalizeScrapeData(null);
    expect(result.summary).toBe("");
    expect(result.locations).toEqual([]);
  });

  it("normalizes known scraped payload", () => {
    const result = normalizeScrapeData({
      summary: "Test",
      email: "x@y.no",
      phone: "123",
      locations: [{ name: "Kjokken" }, { name: "" }],
    });
    expect(result.locations).toEqual(["Kjokken", "Ukjent lokasjon"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/showcase-scrape.test.ts`
Expected: FAIL with missing module/functions.

**Step 3: Write minimal implementation**

```ts
type RawScrape = {
  summary?: string;
  email?: string;
  phone?: string;
  locations?: Array<{ name?: string }>;
} | null;

export function normalizeScrapeData(raw: RawScrape) {
  if (!raw) {
    return { summary: "", email: "", phone: "", locations: [] as string[] };
  }

  return {
    summary: raw.summary ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    locations: (raw.locations ?? []).map((loc) => loc.name || "Ukjent lokasjon"),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/showcase-scrape.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/showcase/lib/showcase-scrape.ts apps/web/src/app/onboarding/showcase/__tests__/showcase-scrape.test.ts
git commit -m "feat(onboarding-showcase): add scrape normalization domain with tests"
```

---

### Task 4: Upgrade page into “System Room” (context, capabilities, event timeline, telemetry)

**Files:**

- Modify: `apps/web/src/app/onboarding/showcase/page.tsx`
- Reuse: `apps/web/src/app/onboarding/showcase/lib/showcase-journey.ts`
- Reuse: `apps/web/src/app/onboarding/showcase/lib/showcase-policy.ts`
- Reuse: `apps/web/src/app/onboarding/showcase/lib/showcase-scrape.ts`

**Step 1: Add failing behavior expectations as comments/checklist in test scope**

```ts
// Add assertions in domain tests for:
// - progress increases after manuscript/scrape/quiz transitions
// - policy state reflects manual-only speech
// - scrape normalization is applied before render
```

**Step 2: Run focused tests**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/`
Expected: PASS (green baseline before page integration).

**Step 3: Implement minimal page integration**

```tsx
// In page.tsx integrate:
// - journey progress bar + understanding score
// - context panel (session age, inferred user profile)
// - capability panel (navigate/fill/fetch/speech state)
// - structured event timeline list (tool action, result, timestamp)
// - animated module color regime that changes by active module
```

**Step 4: Validate app-level checks**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/ && pnpm --filter web lint apps/web/src/app/onboarding/showcase/page.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/showcase/page.tsx
git commit -m "feat(onboarding-showcase): upgrade sandbox into interactive system room"
```

---

### Task 5: Final verification, docs note, and handoff

**Files:**

- Modify: `docs/plans/2026-03-06-board-onboarding-communication-layer.md`
- Optional note: `docs/worklogs/WORKLOG-onboarding-mission.md` (if team uses this as current stream)

**Step 1: Add concise showcase verification note**

```md
- Showcase system room now includes: context panel, capability panel, timeline, telemetry score.
- Speech remains manual-only by policy.
```

**Step 2: Run full relevant checks**

Run: `pnpm --filter web test apps/web/src/app/onboarding/showcase/__tests__/ && pnpm --filter web typecheck && pnpm --filter web lint`
Expected: PASS.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-06-board-onboarding-communication-layer.md docs/worklogs/WORKLOG-onboarding-mission.md
git commit -m "docs(onboarding-showcase): add system room verification and rollout notes"
```

---

## Guardrails for this plan

- Scope lock: only `apps/web/src/app/onboarding/showcase/` + minimal docs updates.
- No system-agnostic refactors or global architecture changes.
- Keep speech manual-only; never autoplay TTS.
- Reuse existing onboarding visual language and motion patterns.
- Keep each task DRY, YAGNI, TDD-first, with small commits.

## Skill references

- `@superpowers:executing-plans`
- `@superpowers:test-driven-development`
- `@superpowers:verification-before-completion`
- `@superpowers:subagent-driven-development`
