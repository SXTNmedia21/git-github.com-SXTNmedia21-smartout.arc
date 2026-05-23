---
id: L-0340
title: Telemetry event registered without matching emit() call-site — 3rd occurrence — promote to standing pre-merge grep
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: governance
council_refs: [council-2026-05-23-tidslinje-surface-boundary]
tags: [learnings, telemetry, registry, emit, phantom-contract, council-protocol]
---

# L-0340 — Telemetry-registered without emit() — 3rd occurrence

## Context

Pattern: developer adds entry to `packages/telemetry/src/registry.ts` (event name, properties shape, routing destinations) but never wires a matching `emit()` call-site in `apps/` or `services/`. Registry entry becomes a phantom contract — PostHog + activity_trail + engine_event consumers receive zero data despite TypeScript compiling.

Structurally undetectable at type level: the registry export is referenced via string keys, not symbol imports. Only grep catches the missing call-sites.

Occurrence log:
1. **2026-05-17 HMS R1** — 4 HMS events registered (`packages/telemetry/src/registry.ts:2598-2638,13723-13738`), zero `emit()` call-sites. Fixed forward in sortie G1 (4 emit-sites with useRef+useEffect+L-0177 fail-fast). Sibling pattern to L-0176 (docstring drift) + L-0177 (silent fallback).
2. **2026-05-17 ui-shell R1 PM** — `deviation_viewed` + `handbook_chapter_opened` registered, zero `emit()` sites. ADR-0358 promoted in same window codifying Phase 3 mandatory grep.
3. **2026-05-23 Tidslinje surface boundary (this council)** — flagged as forward risk for Sortie 2: `tidslinje_tab_opened` + `tidslinje_filter_changed` events scheduled to be added to registry. Council Trust Gate explicitly demanded `emit()` grep on PR review before merge.

## Discovery

Two emit-wiring failures in 6 days on different surfaces was enough for ADR-0358 promotion. The 3rd occurrence (forward risk) on 2026-05-23 confirms the pattern is institutional — not specific to any team or sortie. Phase 3 council reviewers reading registry diffs default to "trust the registration" because the diff looks declarative; they do not naturally grep for the consumer side.

**Standing pre-merge grep rule (codified from ADR-0358, restated here for L-NEW capture):**

When a PR diff touches `packages/telemetry/src/registry.ts`, the reviewer MUST execute:

```bash
# For each event name in registry.ts diff:
grep -rE 'emit\(\s*["'"'"']<event_name>["'"'"']' apps/ services/
# Must return ≥1 hit per event. 0 hits = hard reject blocker.
```

This grep is mandatory both at:
- **Phase 3 council review** (Steward mandate per ADR-0358) — before APPROVE on a topic touching registry
- **PR review** (any reviewer touching the diff) — before merge approval

## Impact

- 3rd-occurrence promotion: rule moves from "Phase 3 mandate when registry in diff" (ADR-0358) to **standing pre-merge gate applicable to ALL PRs touching the registry**, regardless of council involvement.
- Sortie 2 (P10) in `docs/domains/day-session/ROADMAP.md` carries explicit Gate 2 deliverable: emit-grep verification before TidslinjeTab merge.
- Sibling failure-mode family now has 3 named occurrences: L-0176 docstring drift, L-0177 silent ID fallback, L-0340 telemetry-without-emit. All three share root cause: declarative-looking surface (docstring / registry entry / fallback default) that fails silently at runtime when the consumer side drifts.
- **Pre-commit hook proposal:** if recurring beyond 3 occurrences, add `pnpm check:telemetry-emit-coverage` to `lint-staged` running the grep automatically. Track in domain GAPS as toolchain debt if a 4th occurrence lands.

## References

- ADR-0358 — Telemetry-contract Phase 3 council mandate (2026-05-17, post-HMS R1 + ui-shell R1)
- L-0176 — Docstring drift (sibling pattern)
- L-0177 — Silent ID fallback (sibling pattern)
- Council session 2026-05-23 — `docs/council/COUNCIL-LOG.md` (forward-risk flag)
- HMS R1 2026-05-17 (1st occurrence)
- ui-shell R1 2026-05-17 (2nd occurrence)

---

> Registered in `docs/learnings/0000-learning-log.md`.
