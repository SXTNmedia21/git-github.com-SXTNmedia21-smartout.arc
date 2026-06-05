---
title: "Handoff — audit-fmo-l0083-enforcement"
feature: audit-fmo-l0083-enforcement
status: ready-for-merge
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [handoff, audit, l-0083, mobile, eslint, ci, f-mo-01, f-mo-02, f-mo-03]
---

# Handoff — audit-fmo-l0083-enforcement

> Branch: `feat/audit-fmo-l0083-enforcement` | Worktree: `~/wsl/smartout.ai-wt-6` | Module: mobile

## Summary

L-0083 trap (empty-string fallback on identifier columns silently corrupts
`activity_trail` + `engine_event` routing) keeps re-introducing on mobile.
Three baseline findings (F-MO-01, F-MO-02, F-MO-03) have been open since
the 2026-05-10 audit baseline; the 2026-05-13 audit flagged the class as
"incurable without ESLint" (Synthesis §8 / Top Findings #4).

This sortie ships the ESLint rule, remediates all current sites, and adds a
CI guard so future regressions are blocked at PR-time. ADR-0134 Invariant 2
("`emit()` MUST receive non-null, non-empty `workspace_id` and `actor_id`")
is now enforceable, not just documented.

## What was built

### 1. ESLint rule (the enforcement)

`packages/eslint-config/plugins/smartout/rules/no-empty-string-identifier-fallback.mjs`

Detects `LogicalExpression` with operator `??` or `||` where the right side
is an empty-string literal AND the surrounding context names an identifier
column. Context detection walks the parent chain through five shapes:

1. Property value: `{ workspace_id: ... ?? "" }`
2. VariableDeclarator init: `const profileId = ... ?? ""`
3. AssignmentExpression target: `obj.workspaceId = ... ?? ""`
4. JSX attribute value: `<Foo profileId={... ?? ""} />`
5. Function-argument to a `setX` callback: `setWorkspaceId(... ?? "")`

Identifier match is:
- explicit allow-list of 30+ known names (`workspace_id`, `profile_id`,
  `actor_id`, `user_id`, `entity_id`, `session_id`, `time_entry_id`,
  `target_profile_id`, …), OR
- suffix `_id` (snake_case), OR
- suffix `Id` with lowercase preceding char (camelCase).

File-path allow-list:
- `**/*.test.{ts,tsx,mjs,js}` — RuleTester fixtures need invalid samples.
- `**/profile-context.ts` — self-documenting helper that bans the pattern.
- `**/test-fixtures/**` — fixture roots.

Wired into:
- `apps/mobile/eslint.config.mjs` at `error` severity (mobile-only).
- Plugin index at `packages/eslint-config/plugins/smartout/index.mjs`.

### 2. Vitest unit tests

`packages/eslint-config/test/no-empty-string-identifier-fallback.test.mjs`

Uses ESLint v9's built-in `RuleTester` inside a `describe`/`it` block so the
suite runs via `pnpm --filter @smartout/eslint-config test`. 13 invalid +
13 valid samples cover:

- Property-value, variable-declarator, JSX-attribute, setter-call contexts.
- `??` AND `||` operators.
- Display-only fallback (`display_name ?? ""`, `body ?? ""`, etc.) NOT
  flagged.
- File-path allow-list (test files, `profile-context.ts`).
- Non-empty-string fallback (`?? null`, `?? "missing"`) NOT flagged.

Vitest config + scripts added to `packages/eslint-config/package.json`.

### 3. CI workflow

`.github/workflows/eslint-mobile.yml` — runs on PR + push to
`development` / `preview` / `main` with path filter
`apps/mobile/**`, `packages/eslint-config/**`, `packages/training/**`.

Steps:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @smartout/eslint-config test` (rule unit tests)
3. `pnpm --filter @smartout/mobile lint` (rule + base lint)
4. Belt-and-braces grep guard — exits 1 if ANY `?? ""` lands adjacent to
   an identifier column name in `apps/mobile/src/`. Catches regressions
   even if the ESLint rule itself ever drifts.

### 4. Remediation (16 sites across 12 files)

Baseline + opportunistic identifier sites — all replaced with fail-fast or
null-preserving patterns per ADR-0134.

**Mobile app sites (12 files):**

| File | Before | After |
|---|---|---|
| `components/shift-clock/ShiftClockView.tsx` (L67-68) | `?? ""` on `shiftId` / `workspaceId` | `?? null`; `useSupplements` widened to accept null + gates internally |
| `components/shift-clock/ShiftClockView.tsx` (L240-243) | 4× `?? ""` on `time_entry_id` / `shift_id` / `profile_id` / `workspace_id` | Early-return on null `currentTimeEntry`; render placeholder until data lands |
| `components/shift-clock/ShiftClockView.tsx` (L317) | `profileId={profile?.profile_id ?? ""}` | Conditional render — `TaskFeed` only mounted when `profile.profile_id` is truthy |
| `components/shift/SwapRequestSheet.tsx` (L114) | `target_profile_id: selectedShift.employee_id ?? ""` | `if (!selectedShift.employee_id) { Alert.alert(...); return; }` before `initiateSwap` |
| `components/payroll/PayslipScreen.tsx` (L85) | `activeId = selectedId ?? payslips[0]?.period.id ?? ""` | `?? null`; `usePayslipDetail` widened to accept null |
| `components/task/ChecklistView.tsx` (L69) | `session_id: sortedTasks[0]!.session_id ?? ""` (in emit) | Skip emit when `firstTask.session_id` is falsy |
| `components/task/ChecklistView.tsx` (L96) | `sessionId: sortedTasks[0]!.session_id ?? ""` | Early-return guard on null `sessionId` |
| `components/task/HACCPForm.tsx` (L63) | `session_id: task.session_id ?? ""` | `?? null` (payload type is `string \| null`) |
| `hooks/mutations/use-log-haccp.ts` (L68) | `entity_id: payload.session_id ?? ""` (in emit) | Skip emit when `payload.session_id` is null |
| `hooks/mutations/use-punch.ts` (L104) | `shiftId = activeEntry?.shift_id ?? ""` | Throw when shift_id missing — shift_lifecycle_v1 entity_id contract requires real id |
| `hooks/mutations/use-recon-wizard.ts` (L185) | `reconciliation_id: prev?.reconciliation_id ?? ""` (optimistic cache) | `?? null`; `ReconRow.reconciliation_id` widened to `string \| null` |
| `hooks/mutations/use-submit-supplement.ts` (L84) | `supplement_rule_id: input.supplementRuleId ?? ""` (in emit) | Gate emit on `input.supplementRuleId` presence — ad-hoc claims write row but skip telemetry |
| `hooks/queries/use-my-queue.ts` (L66) | `channel_id: row.entity_id ?? ""` | `?? null`; `QueueTicket.channel_id` widened to `string \| null` |
| `hooks/queries/use-payslips.ts` (L145) | `usePayslipDetail(periodId: string)` | Accepts `string \| null`; query gated by `enabled: !!periodId` |
| `hooks/queries/use-swap-requests.ts` (L54) | `workspace_id: row.workspace_id ?? ""` | `?? null`; `SwapRequest.workspace_id` widened to `string \| null` |
| `hooks/queries/use-training-data.ts` (L134) | `workspaceId = profile?.workspace_id ?? ""` | `?? null`; training hooks widened to accept null |
| `hooks/shift-clock/useSupplements.ts` (signature) | `useSupplements(shiftId: string, workspaceId: string)` | Both args accept `string \| null \| undefined`; queries gated; `claimSupplement` throws on null `shiftId` |
| `hooks/use-voice-transcripts.ts` (L322, L381) | `session_id: ... ?? ""` (in 2 emits) | `?? livekitRoomId` (same stable fallback as `entity_id`) |

**Shared package widening (3 files):**

| File | Change |
|---|---|
| `packages/training/src/hooks/keys.ts` | `assignedProtocols` / `readiness` / `workspaceReadiness` accept `string \| null` |
| `packages/training/src/hooks/use-assigned-protocols.ts` | `workspaceId` widened to `string \| null \| undefined`; `enabled` gates on both ids |
| `packages/training/src/hooks/use-readiness-score.ts` | `workspaceId` widened to `string \| null \| undefined` |

## Decisions

### D1 — Rule severity: `error` on mobile, no global promotion yet

Decision: ship `smartout/no-empty-string-identifier-fallback` at `error`
severity in `apps/mobile/eslint.config.mjs`, but DO NOT add it to the
shared `base.mjs` rules block.

Why: the 2026-05-13 audit calls out L-0083 as mobile-specific
("incurable without ESLint" for mobile). Web has similar patterns but
their blast radius is smaller (BFF resolves identity server-side per
ADR-0151). Promoting globally would surface a few hundred warnings in
web/landing source today; that is a separate sortie. Mobile-only first,
global later when web sites are inventoried.

### D2 — `null` over throw for read-side mappings

Decision: where the value is a read-side projection (use-my-queue,
use-swap-requests, use-payslips, use-recon-wizard), widen the type to
`string | null` rather than throwing.

Why: the value is informational, not load-bearing. A throw on read would
break the UI for anyone who hits a transient null. Surfacing null lets
downstream consumers handle the absence explicitly (which is the
ADR-0134 R5.2-3 intent: "don't hide the null").

### D3 — Throw inside write-side mutations

Decision: `usePunch.punchOut`, `useSupplements.claimSupplement` (and
sibling mutations) throw on null identity.

Why: their downstream contracts (engine_event routing, process_state
matching) require a real id. Silently swallowing would corrupt the
process chain. Failing fast at the call site surfaces the bug
immediately rather than producing a phantom event.

### D4 — Skip emit when only the telemetry needs the id

Decision: `useLogHaccp`, `useSubmitSupplement`, `ChecklistView` "checklist
started" emit — gate the `emit()` on the identifier's presence rather
than throwing. The DB write still happens.

Why: `emit()` is observability, not the source of truth. Losing one
telemetry event is better than failing the user's HACCP log because the
session linkage hasn't hydrated yet. The write still gets audit coverage
via the row insert itself.

### D5 — Training package types widened, not duplicated

Decision: widen `useAssignedProtocols` / `useReadinessScore` /
`trainingKeys.*` to accept `string | null` in the shared package rather
than forcing every mobile caller to build a separate wrapper.

Why: web callers already pass real strings; the wider type is
backwards-compatible. The alternative (web sticks to `string`, mobile
keeps a parallel wrapper) duplicates the contract surface for no benefit.

## Learnings

### L1 — ESLint v9 RuleTester does not auto-pick parser

The default ESLint parser does not understand TypeScript or JSX. The
RuleTester block must wire `@typescript-eslint/parser` and
`ecmaFeatures.jsx` explicitly, or every `??` test case throws a parse
error before the rule fires. Mirrors the existing pattern in
`packages/eslint-config/base.mjs`.

### L2 — Vitest as runner, RuleTester as oracle

RuleTester is synchronous; vitest just adds the `describe`/`it` wrapper.
This avoids pulling in `@typescript-eslint/rule-tester` (not installed
in this repo). One `it("accepts safe patterns and rejects identifier
fallbacks")` block runs the entire suite as a single vitest case. Two
deps stay separate: vitest is the harness, ESLint is the engine.

### L3 — Display-only context is the false-positive risk

Initial drafts of the rule flagged every `?? ""`. That fires on
`display_name ?? ""`, `body ?? ""`, `comment ?? ""` — all legitimate
display-string fallbacks. The fix: walk the parent chain and require
the surrounding context (property key, variable name, JSX attr) to
name an identifier column. The rule never fires on a fallback whose
value is bound to a non-identifier name. Pattern-grep is a coarser
filter; AST is the right granularity here.

### L4 — Training key types ripple outward when widened

Widening `trainingKeys.assignedProtocols(profileId: string | null)`
required matching widening of both the hook param and the query enable
gate. Web callers were unaffected because they pass `string` (subtype
of `string | null`). Mobile callers no longer need the empty-string
mint. The "ripple" is one-way: widening doesn't break narrower
consumers.

### L5 — Mobile typecheck ≠ web typecheck cleanliness

`pnpm --filter @smartout/mobile typecheck` was green throughout. The
broader `pnpm --filter web typecheck` had ~200 pre-existing TS2307
errors due to stale package dists (`@smartout/types`,
`@smartout/ai/missions`, `@smartout/payroll-calculate`,
`@smartout/payroll-export`, `@smartout/journey-ir`,
`@smartout/contracts`). After rebuilding those dists, web typecheck is
clean. This matches the "subpath imports require @smartout/ai dist"
trap from MEMORY — the broader CI lane must rebuild dists before
typechecking web.

## Known issues / debt

### Out of scope (deferred, not blocking this sortie)

- **F-MO-05** — `use-recon-wizard` direct `daily_reconciliation` insert.
  ADR-0132 R5 says mobile mutations route through BFF. This sortie only
  fixed the cache-shape `?? ""` at line 185; the broader BFF-wrap is a
  separate sortie (track as `feat/mobile-reconciliation-bff-wrap` per
  synthesis §7).
- **F-MO-06** — `(me)/contract/complete-data.tsx` mobile-direct
  `supabase.rpc("submit_own_pii", { p_workspace_id, … })`. PII intake
  with body-supplied `workspace_id`. Highest-priority follow-up per
  synthesis §7.
- **F-MO-08** — 8 sync-queue handlers still write direct. Track as
  ADR-0298 follow-up.

### Global promotion candidate

The ESLint rule is mobile-only (severity `error`). Global promotion
(into `base.mjs`) waits on a web-side inventory + remediation. Tracked
in synthesis §7 ("Pattern: mobile-side ESLint rule …").

## Next steps

1. Pontus runs `close-feature.sh` to merge `feat/audit-fmo-l0083-enforcement`
   → development.
2. Cherry-pick into `campaign/payroll-mvp` if the campaign is still
   active — the rule and the remediated files don't conflict.
3. Open follow-up sortie for F-MO-05 (recon BFF-wrap).
4. After web-side L-0083 inventory: promote rule to `base.mjs` at `warn`
   first, then `error` once web call sites are migrated.

## References

- ADR-0134 (Mobile Telemetry Contract — Invariant 2: no empty-string
  fallback on `workspace_id` / `actor_id`).
- Audit baseline 2026-05-10:
  `docs/audits/2026-05-10-adr-contract-validation/05-mobile-surface.md`.
- Audit 2026-05-13 synthesis: `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`.
- Audit 2026-05-13 mobile slice: `docs/audits/2026-05-13-adr-contract-validation/05-mobile-surface.md`.
- Smoke summary annotation:
  `docs/audits/2026-05-13-adr-contract-validation-02/00-SUMMARY.md`
  (out-of-band closures section).
- Plan: `docs/plans/PLAN-audit-fmo-l0083-enforcement.md`.
- Journeys (all `status: verified`):
  - `docs/journeys/JOURNEY-audit-fmo-l0083-enforcement-eslint-rule-blocks-empty-string-fallback.md`
  - `docs/journeys/JOURNEY-audit-fmo-l0083-enforcement-three-baseline-sites-remediated.md`
  - `docs/journeys/JOURNEY-audit-fmo-l0083-enforcement-mobile-fail-fast-on-missing-identity.md`
- Memory anchor: L-0083 — see CLAUDE.md "What NOT To Do" §L-0177 (sibling
  bug class: silent fallback on body-supplied row reference) and
  ADR-0134 Invariant 2.
