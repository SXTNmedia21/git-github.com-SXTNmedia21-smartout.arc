---
id: ADR-0377
title: "Telemetry registry entries require emit() call-sites — toothless event ban"
status: proposed
layer: decision
created: 2026-05-17
updated: 2026-05-17
council: campaign-ui-shell-shippability-r1
supersedes: []
amends: []
related: [ADR-0134, L-0176, L-0177]
tags: [telemetry, observability, contract, anti-pattern]
---

# ADR-0377: Telemetry registry entries require emit() call-sites — toothless event ban

## Context and Problem Statement

Two occurrences in two consecutive days (2026-05-17 AM HMS R1 council + 2026-05-17 PM ui-shell R1 council) revealed the same structural failure: an event is registered in `packages/telemetry/src/registry.ts` but no matching `emit({event: "..."})` call-site exists anywhere in the codebase. PostHog, activity_trail, and engine_event downstream consumers receive zero data — a silent observability hole that is undetectable without explicit grep.

**Occurrence 1 — HMS R1 PM (2026-05-17):** 4 HMS-cluster events registered in `packages/telemetry/src/registry.ts:2598-2638,13723-13738`; zero `emit()` call-sites. Identified by HMS R1 council fixup sortie; 4 emit-sites wired as G1 (using `useRef` + `useEffect` + L-0177 fail-fast guards).

**Occurrence 2 — ui-shell R1 PM (2026-05-17):** `deviation_viewed` + `handbook_chapter_opened` events registered for the ui-shell campaign tip; zero matching emit() call-sites found during council Phase 3 telemetry audit. Classified as hard blocker B2 by the ui-shell shippability council.

Both occurrences share identical failure anatomy:
1. Developer adds registry entry (compiles cleanly, no type error).
2. Developer declares telemetry done in HANDOFF / commit message.
3. Downstream consumers (PostHog analytics, `activity_trail` audit, `engine_event` workflow) receive zero events.
4. No runtime error surfaces. The silence is indistinguishable from "event hasn't fired yet" from a monitoring perspective.

Pattern class: sibling of L-0176 (docstring claims ADR compliance but body doesn't implement it) and L-0177 (silent workspace-id fallback). Both share "the artifact looks correct but the execution path is broken."

The 2-occurrence threshold in two consecutive days — with identical anatomy and identical silent failure mode — meets the ADR-grade promotion threshold for a cross-session recurring pattern.

## Decision Drivers

- Registry entries without emit() call-sites are not merely incomplete — they are actively misleading: they teach downstream consumers (PostHog dashboards, monitoring alerts, ADR audit scripts) to expect data that will never arrive.
- The failure is structurally undetectable without an explicit grep: TypeScript compiles, linter passes, CI is green.
- Two occurrences in two consecutive days on different surfaces (HMS vs ui-shell) demonstrates the pattern is systemic, not incidental.
- `emit()` is already mandated per ADR-0134 and CLAUDE.md ("No mutation without emit"). The same mandate must apply to the registry side: no registry entry without a corresponding emit site.

## Considered Options

1. **Author discipline only** — trust that developers will wire emit() alongside registry entries. Rejected: 2 failures in 2 days on different features by different sub-sortie builders demonstrates discipline-only is insufficient.

2. **Runtime check** — detect at render/boot time whether registered events have been emitted. Rejected: no runtime visibility into "intended but never wired" coverage — only into "wired but never called." The failure mode is structural, not runtime-observable.

3. **Automated static enforcement** — grep gate in pre-commit + CI that iterates registry entries and verifies matching `emit(` call-sites exist in `apps/`. Selected: catches the structural gap before merge; complements TypeScript type-checking which cannot cross the registry/callsite boundary.

## Decision Outcome

Chosen option: **Automated static enforcement via grep gate.**

Any PR that adds entries to `packages/telemetry/src/registry.ts` MUST include matching `emit({event: "..."})` call-site(s) in the same PR. The matching call-site must appear in `apps/` or `services/` (not inside `packages/telemetry/` itself).

Enforcement mechanism: script `scripts/check-telemetry-emit-coverage.ts` — iterates all event names in registry.ts and greps `apps/` + `services/` for `emit\(["']<event_name>` per entry. Any registry entry with 0 matching call-sites causes the script to exit non-zero. Script is invoked:
- Pre-commit hook (fast check on staged diff — only checks newly-added registry entries)
- CI gate on every push to `feat/*` and `campaign/*` branches (full check)

## Rules & Consequences

- **Good, because** no silent observability holes can survive a merge. Authors are forced to wire emit() in the same PR as the registry entry — the two artifacts stay synchronized.
- **Good, because** the enforcement script is purely additive: it only requires correlation between two existing artifacts, not a new coding pattern.
- **Good, because** catches the L-0176 docstring-drift sibling pattern at the registry level: a registry entry is a "contract claim" just as a docstring is; both must be backed by implementation.
- **Bad, because** the grep gate on event name strings is case-sensitive and requires exact string matching — if an event name is constructed dynamically (e.g. template literals), the grep will false-negative. Mitigation: registry entries MUST use string literals; dynamic event names are a separate anti-pattern.
- **Bad, because** adds ~2-5s to pre-commit on large repos. Mitigated by scoping pre-commit to staged diff only (new registry entries), not full scan.
- **Agent Impact:** Before committing a registry entry, developers must verify `grep -r 'emit.*event_name_here' apps/ services/` returns at least 1 result. The enforcement script provides a canonical check; manual verification is the developer's responsibility.

## Implementation Plan

### Phase 1 — Enforcement script (follow-up sortie, ~30 min)

File: `scripts/check-telemetry-emit-coverage.ts`

```
// Pseudocode
const registry = readFile("packages/telemetry/src/registry.ts")
const eventNames = extractEventNames(registry)  // parse string literals after `event:` in registry entries
const missing: string[] = []
for (const eventName of eventNames) {
  const hits = grepRecursive(`emit.*["']${eventName}["']`, ["apps/", "services/"])
  if (hits.length === 0) missing.push(eventName)
}
if (missing.length > 0) {
  console.error(`TELEMETRY COVERAGE FAILURE: ${missing.length} events with 0 emit() call-sites:`)
  missing.forEach(e => console.error(`  - ${e}`))
  process.exit(1)
}
```

### Phase 2 — Pre-commit hook integration

Add to `.husky/pre-commit`:

```bash
# Check telemetry registry entries have matching emit() call-sites (ADR-0377)
if git diff --cached --name-only | grep -q "packages/telemetry/src/registry.ts"; then
  pnpm ts-node scripts/check-telemetry-emit-coverage.ts --staged-only
fi
```

### Phase 3 — CI gate integration

Add to `.github/workflows/ci.yml` (or equivalent): `pnpm ts-node scripts/check-telemetry-emit-coverage.ts`

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
