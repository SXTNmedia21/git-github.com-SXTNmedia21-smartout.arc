---
title: HANDOFF — SS-5 Wave 2B Lint Closure (tools/)
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena
tags: [campaign-botsson, gate-action, cascade-gate-write, adr-0091, adr-0099, adr-0196, adr-0204, orchestrator, composition, lint-closure, tools]
---

# HANDOFF — SS-5 Wave 2B Lint Closure (`packages/ai/src/tools/`)

Sub-sortie of `campaign/botsson-arena`. Fifth and final B1 sub-sortie per Council 2026-04-23 (ADR-0203 + ADR-0204). Ran **in parallel with SS-4** (disjoint files).

Branch: `feat/botsson-arena-ss5-wave-2b-lint-closure` (rebased onto `campaign/botsson-arena` post-SS-4 landing, tip `f70e83de`).

## Summary

Closed every `smartout/no-direct-supabase-write` warning in `packages/ai/src/tools/` by routing each mutation through the `gatedMutation()` composition orchestrator landed in SS-3 (ADR-0204). Six tool files migrated, three context types (`ReportToolContext`, `SeasonToolContext`, `JourneyToolContext`) extended with optional `profileId` and `channel` fields, one BFF route (`apps/web/src/app/api/journey-agent/route.ts`) updated to thread `adminId` → `profileId` and `channel: "chat"`.

**Invariant 13 (ADR-0196)** — every mutation in `packages/ai/src/tools/` is now preceded by `gatedMutation()`, which evaluates Pathway A (`gate_action`) and Pathway B (`cascade_gate_write`) in the right order before the domain write runs.

## Surprises — read first

### 1. Actual baseline was 34 warnings, not 33

Task brief stated "33 warnings in `packages/ai/src/tools/{report,season}/*.ts`". Running `pnpm --filter @smartout/ai lint` on the campaign tip returned **34 total warnings** across 11 files — only **9 of those 34** are actually in `packages/ai/src/tools/`:

- `tools/report/delete-report.ts` — 1
- `tools/report/save-report.ts` — 1
- `tools/season/create-season.ts` — 4
- `tools/season/save-playbook.ts` — 1
- `tools/season/set-revenue.ts` — 1
- `tools/journey/save-draft.ts` — 1

The other 25 warnings are in `packages/ai/src/capabilities/*/tools.ts` (20) and `packages/ai/src/{context/memory-writer,session-context}.ts` (4). Those are explicitly out of SS-5 scope per the task's disjoint-files directive (SS-4 owns `capabilities/*/gate.ts`; `tools.ts` files + `session-context.ts` are for a future sortie).

### 2. Acceptance gate #7 expectation ≤1 is unreachable from SS-5 alone

Task gate #7 says "warnings drop from 34 to ≤1 (memory-writer may have 1 legitimate direct write pre-gate)". That's only achievable if capabilities/*/tools.ts warnings also close — but SS-4 (the concurrent sortie) migrated the per-cap `gate.ts` wrappers, NOT the `tools.ts` bodies. A later sub-sortie must migrate each capability's `tools.ts` through `gatedMutation()` (presumably delegating via the gate.ts wrappers SS-4 just built). After SS-5 the lint count is **25**; closing the rest needs follow-up work.

### 3. The `reports`, `season`, `journey_wizard` capabilities have no authority seed

None of the three capability strings I introduced appear in `capability_default_registry` or `engine_authority_config`. `gate_action` RPC will fall through to the ADR-0189 warned default-allow branch. This matches current behaviour (pre-gate) so no functional regression, but future work should add seeds — OR document that these tools are admin-only and rely on higher-layer auth (reports → workspace membership, journey wizard → godmode, season → dead code).

### 4. `SEASON_TOOLS` is dead code

`packages/ai/src/tools/season/index.ts` exports `SEASON_TOOLS` but no BFF route or agent runner imports it (`grep -rn SEASON_TOOLS apps services packages` returns only the export + in-file re-import). Migration still matters for correctness when a future caller lands, but the runtime blast radius of this part of SS-5 is effectively zero today. The tools fail closed when `ctx.profileId` is absent, so silent-bypass is impossible.

### 5. Orchestrator feature flag is ON post-SS-4

SS-4 flipped `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` default to TRUE. My migrations consume `gatedMutation()` directly; they work the moment SS-4 lands and I rebase. Pre-SS-4 call would have hit the `not_implemented:` throw — caught in the rebase step (none of my commits depended on pre-SS-4 behaviour).

### 6. ESLint rule trips inside `gatedMutation().execute` callbacks

The `smartout/no-direct-supabase-write` rule is purely AST-shaped: it sees `.from(...).insert/update/delete(...)` regardless of surrounding context. Placing the write inside `gatedMutation().execute` still flags. The canonical pattern from `gatedMutation.ts` line 532 is an `eslint-disable-next-line` with an ADR-0204 §3 justification — I reused that exact shape. **All disable comments survived lint-staged + prettier** (verified per commit).

### 7. Post-formatter verification caught nothing, but I looked

Per global CLAUDE.md rule: `grep "eslint-disable" packages/ai/src/tools/**/*.ts` confirms 9 comments across the 6 migrated files. No formatter reversions.

## What shipped

### Commits (3)

| SHA | Title | Files | +/− |
|---|---|---|---|
| `6fbf8cdf` | feat(gate): migrate report tools to gatedMutation (SS-5 part 1) | 3 | +121/-22 |
| `9c21b6f8` | feat(gate): migrate season tools to gatedMutation (SS-5 part 2) | 4 | +298/-62 |
| `6ea96254` | feat(gate): migrate journey wizard save-draft tool to gatedMutation (SS-5 part 3) | 3 | +65/-6 |

Total: 10 files changed, +489/−90.

### Files modified

| Path | Mutation sites migrated | Notes |
|---|---|---|
| `packages/ai/src/tools/report/delete-report.ts` | 1 DELETE | `custom_report` — feeds `current_data` from pre-check into Pathway B |
| `packages/ai/src/tools/report/save-report.ts` | 1 INSERT | `custom_report` — select-after-insert preserved inside execute callback |
| `packages/ai/src/tools/report/types.ts` | — | Added optional `channel?: SessionChannel` |
| `packages/ai/src/tools/season/create-season.ts` | 4 INSERTs | `season` + `season_budget` + `day_factor` (batch) + `hour_factor` (batch). Each a distinct orchestrator call so proposals can intercept any step. |
| `packages/ai/src/tools/season/save-playbook.ts` | 1 UPDATE | `season.description` append. `current_data` = pre-fetched season row. |
| `packages/ai/src/tools/season/set-revenue.ts` | 1 UPDATE | `season_budget`. New: pre-fetches current budget row so Pathway B can diff old→new revenue targets. |
| `packages/ai/src/tools/season/types.ts` | — | Added optional `profileId?` + `channel?` |
| `packages/ai/src/tools/journey/save-draft.ts` | 1 UPDATE | `wizard_session`. Capability = `"journey_wizard"` (distinct from runtime `journey.*` set). |
| `packages/ai/src/tools/journey/types.ts` | — | Added optional `profileId?` + `channel?` |
| `apps/web/src/app/api/journey-agent/route.ts` | — | Threads `adminId` → `ctx.profileId`, `"chat"` → `ctx.channel` |

Mutation-site count: 9 (matches the closed lint-warning count).

## Inventory — every warning site

| # | File:line (pre-migration) | Mutation | Capability | action_type | entity_type | action | Post-SS-5 warning? |
|---|---|---|---|---|---|---|---|
| 1 | `tools/report/delete-report.ts:36` | DELETE | `reports` | `delete` | `custom_report` | `delete` | NO |
| 2 | `tools/report/save-report.ts:33` | INSERT | `reports` | `save` | `custom_report` | `create` | NO |
| 3 | `tools/season/create-season.ts:49` | INSERT season | `season` | `create` | `season` | `create` | NO |
| 4 | `tools/season/create-season.ts:69` | INSERT season_budget | `season` | `create` | `season_budget` | `create` | NO |
| 5 | `tools/season/create-season.ts:94` | INSERT day_factor × 7 | `season` | `create` | `day_factor` | `create` | NO |
| 6 | `tools/season/create-season.ts:104` | INSERT hour_factor × 24 | `season` | `create` | `hour_factor` | `create` | NO |
| 7 | `tools/season/save-playbook.ts:46` | UPDATE | `season` | `save_playbook` | `season` | `update` | NO |
| 8 | `tools/season/set-revenue.ts:51` | UPDATE | `season` | `set_revenue` | `season_budget` | `update` | NO |
| 9 | `tools/journey/save-draft.ts:38` | UPDATE | `journey_wizard` | `save_draft` / `advance_phase` | `wizard_session` | `update` | NO |

All 9 closed. No site was left unmigrated. No site had legitimate-direct-write exceptions — every warning was a true orchestrator-eligible mutation.

## Acceptance evidence — 8-row falsifiable table

| # | Criterion | Verification | Evidence |
|---|---|---|---|
| 1 | Zero `no-direct-supabase-write` in `packages/ai/src/tools/` | `cd packages/ai && npx eslint src/tools/ 2>&1 \| wc -l` | PASS — returns `0` (no output) |
| 2 | All migrated files call `gatedMutation` | `grep -c gatedMutation packages/ai/src/tools/{report,season,journey}/*.ts` | PASS — 5 / 5 / 11 / 4 / 4 / 4 references across the 6 migrated files |
| 3 | Zero ungated direct writes in `tools/` | ESLint rule is the proxy; also confirmed all surviving `.insert/.update/.delete` are inside `gatedMutation().execute` callbacks with ADR-0204 §3 disable comments | PASS — see `grep eslint-disable-next-line.*no-direct-supabase-write packages/ai/src/tools` → 9 sites matching 9 migrated writes |
| 4 | Tool tests pass (pre-existing set) | `pnpm --filter @smartout/ai test` — no tool-specific tests exist in the tools I migrated; full suite runs as the superset check | PASS (see row 5) |
| 5 | Full `@smartout/ai` suite | `pnpm --filter @smartout/ai test` | PASS — 290 tests across 33 files, 0 failures, 5.42 s |
| 6 | Scoped typecheck | `pnpm --filter @smartout/ai typecheck` | PASS — 0 errors |
| 7 | Lint warning count drops | `pnpm --filter @smartout/ai lint` — was 34, now 25 | PARTIAL — dropped 9 (all in scope). Remaining 25 are in `capabilities/*/tools.ts` (20) + `context/memory-writer.ts` (1) + `session-context.ts` (3 + 1 in this file already, all pre-existing out-of-scope sites). Task gate #7's ≤1 target is a multi-sortie goal; SS-5 closes its share. |
| 8 | Invariant 13 — every mutation preceded by `gatedMutation` | Per-file walk in Inventory table above | PASS — 9/9 sites |

Additional evidence:

- Web typecheck clean: `pnpm --filter web typecheck` returns 0 (after `@smartout/ai build`). BFF-route change to `journey-agent` does not break callers.
- `gatedMutation` orchestrator tests unchanged and passing (8/8).
- Post-rebase branch diverges from campaign tip by exactly 3 commits, 10 files, +489/−90 — no cross-campaign leakage, no SS-4 file overlap.

## Decisions made

### D1 — Migrate to `gatedMutation()` with eslint-disable inside execute callback

Alternative considered: use `gatedInsert`/`gatedUpdate`/`gatedDelete` from `@smartout/supabase` (the ESLint-rule's preferred fix). Rejected because those only wrap Pathway B — Invariant 13 explicitly requires Pathway A (`gate_action`) **first**. `gatedMutation()` is the only primitive that satisfies ADR-0196 Invariants 11 & 13 together.

The eslint-disable-next-line comment with ADR-0204 §3 justification is the same pattern the orchestrator itself uses for its internal `gate_evaluation` correlation stamp (`packages/ai/src/gate/gatedMutation.ts:532`). It's the documented escape hatch for the one legal composition call site.

### D2 — Extend contexts with optional `profileId` + `channel`, not required

`ReportToolContext` already had `profileId`; only needed `channel` (optional, defaults to `"chat"` in the tool — report builder is admin UI). `SeasonToolContext` and `JourneyToolContext` were missing both. Making them required would cascade type-breaking changes into every legacy caller; making them optional with fail-closed tool-level defaults preserves compile surface.

Trade-off: a future caller that forgets to supply `profileId` hits a fail-closed deny with a clear message instead of a type error. Acceptable because (a) the alternative is a breaking change across 2+ BFF routes and 0 existing non-BFF callers, and (b) the journey BFF route was updated in the same commit that made `JourneyToolContext.profileId` optional.

### D3 — `reports`, `season`, `journey_wizard` as capability strings

None of these exist in the `CapabilityName` union or `capability_default_registry`. `gate_action` falls through to the ADR-0189 warned default-allow branch. Chosen over:

- **Reuse an existing capability** (e.g. `journey.run_dev` for the wizard) — wrong semantic: those govern runtime mission execution, not authoring. Mixing would confuse future seed migrations.
- **Skip the gate entirely for these tools** — violates Invariant 13.
- **Add the capabilities to the union + seed migration in this PR** — scope creep; out of the "9-line closure" brief. Flagged for follow-up.

### D4 — Season dead-code tools still migrated

`SEASON_TOOLS` is exported but unreferenced by any runner today. Migrated anyway so that when a future consumer wires it up, the gate is already in place. Fail-closed on missing `profileId` means a consumer that forgets the plumbing learns about it immediately, not in a CVE post-mortem.

### D5 — Pre-fetch `current_data` on UPDATE sites

`save-playbook.ts` already pre-fetched the season row to compute the new description. `set-revenue.ts` did NOT pre-fetch before SS-5; I added a `.maybeSingle()` lookup of the budget row so Pathway B can diff. This is necessary because `cascade_gate_write` uses `current_data` vs `proposed_data` to evaluate framework-trigger diffs. Omitting `current_data` on an UPDATE would silently defeat any trigger that checks "has revenue target changed by >20%".

### D6 — `create-season.ts` creates 4 orchestrator calls, not 1 atomic one

Alternative considered: wrap the entire season+budget+factors sequence in a single `gatedMutation()` call, since they're conceptually one operation. Rejected because:

- `gatedMutation()` evaluates Pathway B per-row-type. Framework triggers on `day_factor` may differ from triggers on `season`. A single call would conflate them and pick the wrong entity_type.
- Each step can independently land a `change_proposal` (e.g. workspace policy requires approval on budget setup). A single-call design would lose that granularity.
- Partial-failure behaviour is now explicit: if day_factor seeding fails after season+budget succeed, we return a clear "Season created but day_factor seeding failed" message. The caller (or future UX) can retry just the failed step.

Trade-off: 4 orchestrator audit rows per `create_season` call instead of 1. Acceptable — `gate_evaluation` rows are cheap and correlation_id groups them for dashboards.

## Learnings

### L-0127 (proposed) — ESLint AST rules don't recognise composition primitives

`smartout/no-direct-supabase-write` is pure-AST: `.from().insert/update/delete(...)` is always flagged, regardless of whether it's inside `gatedMutation().execute`. The escape hatch — `eslint-disable-next-line` with ADR-0204 §3 justification — is the canonical pattern and must be copied verbatim across all orchestrator-enclosed writes. Extending the rule to recognise execute-callback scope would require dataflow analysis; not worth the complexity. Learning: the disable-comment is the contract.

### L-0128 (proposed) — Parallel sub-sorties must rebase before final gate

My branch forked from `fb27ab56`. SS-4 landed at `daa50c06` and then a follow-up merge at `f70e83de`. Pre-rebase `git diff` showed a huge cross-campaign leak because of divergent history. Post-rebase `git diff` showed only my 10 files. **Always rebase onto the campaign tip before writing the handoff** — the stat block is part of the acceptance evidence and pre-rebase numbers are misleading.

### L-0129 (proposed) — Context extensions need corresponding BFF plumbing in the same commit

I extended `JourneyToolContext.profileId` to optional in the same commit that populated it from `adminId` in the BFF route. Doing it across two commits would have left the type extended-but-unpopulated, making `save_draft` fail-closed in production until the route PR landed. Learning: when a tool depends on a new ctx field, the BFF populating the field goes in the same commit.

### L-0130 (proposed) — Task-brief warning counts can drift from real-time lint

Task said "33 warnings". Actual count was 34, with 9 in scope and 25 out of scope. Briefs written hours or days before execution are snapshot-in-time; always re-lint at execution start and build inventory from lint output, not the brief. Supports L-0094 / L-0120 (phantom claims need falsifiable grounding).

## Open threads for the next sortie

1. **`packages/ai/src/capabilities/*/tools.ts` — 20 warnings remain.** SS-4 migrated per-cap `gate.ts` wrappers to delegate to `gatedMutation()`, but the `tools.ts` bodies still hit `.insert/.update/.delete` directly after calling `callGateAction()` (Pathway A only). A follow-up sortie should re-shape each capability tool to use `gatedMutation()` end-to-end, removing the dual-path.
2. **`packages/ai/src/context/memory-writer.ts:128` — 1 warning.** This file is a pure helper (callers own the gate per SS-1 design). Task brief noted it as "legitimate pre-gate". If the design stays, add an eslint-disable-next-line with a pointer to the module docstring.
3. **`packages/ai/src/session-context.ts:58,78,107` — 3 warnings.** Non-tool, non-capability module. Owner: ambiguous (stage-engine? session state?). Needs triage.
4. **Authority seeds for `reports`, `season`, `journey_wizard`.** Today: default-allow fall-through. Future: add rows to `capability_default_registry` + CapabilityName union. Not urgent (behaviour is unchanged), but leaves the tools outside C4 governance.
5. **`SEASON_TOOLS` wiring.** Dead code today. Either (a) wire it up to a season-agent runner + BFF route, or (b) delete. Half-alive code rots.
6. **Add tool-level tests.** None exist for `report/*`, `season/*`, or `journey/save-draft.ts`. A minimal test that asserts `gatedMutation` is invoked with the right args (L-0125 spirit) would lock the contract against future regressions.

## Next steps

- Coordinate with `campaign/botsson-arena` maintainer on PR title — this closes the SS-5 slice of B1.
- No migration or ADR updates required from SS-5 itself (no schema changes, no new ADRs).
- On merge: update `docs/plans/CAMPAIGN-botsson-arena.md` B1 row with SS-5 evidence (lint count 34→25, tools/ zero) and link this handoff.
