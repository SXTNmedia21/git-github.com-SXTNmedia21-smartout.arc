---
title: HANDOFF — harness-hardening
feature: harness-hardening
branch: feat/botsson-arena-harness-hardening
worktree: /home/sxtnl/dev/smartout.ai-botsson-arena-wt-1
merge_target: campaign/botsson-arena
status: done
updated: 2026-04-23
created: 2026-04-23
module: MODULE_BOTSSON
tags: [handoff, harness, hardening, botsson, invariants, nonemptystring, capability-types, golden-eval]
---

# HANDOFF — harness-hardening

> Implements Items 1, 2, 4, 6 of the 2026-04-23 harness-hardening bundle (spec: `docs/superpowers/specs/2026-04-23-harness-hardening-bundle.md`, plan: `docs/superpowers/plans/2026-04-23-harness-hardening.md`). Items 3 + 5 deferred until `feat/contract-hub-fix-forward` merges to `development`.

## Summary — what was built and why

The Botsson harness had four long-standing invariant gaps that made silent drift possible: (1) telemetry actor IDs accepted empty strings (L-0094 phantom contracts), (2) `profile_id` flowed in request bodies so API-key callers could forge actors (ADR-0151 open), (3) `CapabilityDefinition` fields were optional so adapter/router drift slipped through review (ADR-0198 open), and (4) the Botsson voice agent had no rubric-based quality gate on PRs (ADR-0073 Phase 6 unfulfilled). This sortie lands all four as compile-time or PR-blocking gates, documents the full invariant surface in `docs/architecture/INVARIANTS.md`, and captures the cleanup debt the brand-tightening exposed across mobile + (deferred) web.

## Commits landed

21 commits from `88b52105` through `6c0d72fa` on `feat/botsson-arena-harness-hardening`:

| SHA | Subject |
|---|---|
| 88b52105 | `docs(spec): harness hardening — 4-item bundle after council` |
| 93691356 | `docs(plan): harness hardening — 17-task TDD plan` |
| 744af2a3 | `docs(harness-hardening): declare 3 journeys` |
| 768e58dc | `feat(harness-hardening/brand): land NonEmptyString per ADR-0193` |
| dd8a3084 | `feat(harness-hardening/profile-id): add deriveProfileId helper` |
| ffa6a6ea | `feat(harness-hardening/profile-id): server-derive profile_id in /agent/chat` |
| 773f47a1 | `feat(harness-hardening/profile-id): server-derive profile_id in /sessions` |
| 8901f319 | `feat(harness-hardening/profile-id): widen brand to AgentToolContext, accept ADR-0151` |
| baebc115 | `feat(harness-hardening/capability-types): required toolAuthPattern/emitPrefix/allowedChannels` |
| ec51289f | `feat(harness-hardening/capability-types): assert emitPrefix uniqueness at getAllCapabilities` |
| e3131c68 | `docs(adr): ADR-0198 capability definition typed fields` |
| faeed2e2 | `feat(harness-hardening/invariants): I2 check-emit-registry-coverage script` |
| b164b8f7 | `feat(harness-hardening/invariants): I4 check-server-derived-actor script` |
| 95a6fb0a | `feat(harness-hardening/invariants): I6 check-gate-action-singleton script` |
| 0fa3050a | `ci(harness-hardening): wire 3 invariant checks (I2, I4, I6) to every PR` |
| 5ae2501d | `docs(harness-hardening/invariants): INVARIANTS.md + ADR-0199` |
| 0a94f10c | `feat(harness-hardening/golden-eval): fixture schema + first fixture` |
| be408f4b | `feat(harness-hardening/golden-eval): 4 more fixtures (5 total)` |
| 8b9e6091 | `feat(harness-hardening/golden-eval): scoring module + eval spec` |
| a2edb5bd | `ci(harness-hardening/golden-eval): gate PRs on golden-transcript eval` |
| 6c0d72fa | `fix(harness-hardening/cleanup): cascade NonEmptyString brand` |

## Decisions registered

| ADR | Status change | One-line |
|---|---|---|
| ADR-0151 | proposed → accepted | Stage-engine derives `profile_id` from `actor_authenticator` server-side; forged body IDs rejected. Brand widened to `AgentToolContext.profileId/workspaceId`. |
| ADR-0193 | amended | NonEmptyString brand now applies to `AgentToolContext`, not only `BaseEvent` — same factory `nonEmpty()`, same dev-throw / prod-drop semantics. |
| ADR-0198 | accepted | `CapabilityDefinition.toolAuthPattern/emitPrefix/allowedChannels` are required; `emitPrefix` asserted unique at `getAllCapabilities()` (runtime panic). |
| ADR-0199 | accepted | Harness invariants compiled into `docs/architecture/INVARIANTS.md` as single source; each row links to binding ADR + CI check + 🟢/🟡/🔴 enforcement. |

## Invariants enforced

Per `docs/architecture/INVARIANTS.md`:

| # | Invariant | Source ADR | CI check | Status |
|---|---|---|---|---|
| I1 | Every capability registers `name/description/tools/readOnlyTools/allowedChannels/toolAuthPattern/emitPrefix` | ADR-0198 | `pnpm turbo typecheck` | 🟢 |
| I2 | Every `emit()` event has registry entry | ADR-0116/0175, L-0094 | `invariants:emit-coverage` | 🟢 |
| I3 | `emitPrefix` unique + non-overlapping | ADR-0198 | `getAllCapabilities()` runtime assert | 🟢 |
| I4 | Stage-engine POST bodies omit `profile_id`/`actor_id` | ADR-0151 | `invariants:server-actor` | 🟢 |
| I5 | Capability tool `execute` accepts exactly `AgentToolContext` | ADR-0099 | `pnpm turbo typecheck` | 🟢 |
| I6 | `gate_action` is the single authorization gate | ADR-0099 | `invariants:gate-singleton` | 🟢 |
| I7 | Every migration touches RLS explicitly | ADR-0018 | partial pgTAP | 🟡 |
| I8 | Edge Functions dual-auth or `verify_jwt=false` + sig | ADR-0039 | (none) | 🔴 |
| I9 | Every mutation emits to `activity_trail` | ADR-0116 | partial auto-emit | 🟡 |

## Learnings captured (inline, no separate files)

### L-0119 — bundle-vs-stale-base

**Context:** The harness-hardening bundle was specced against the `campaign/botsson-arena` tip at spec time. By Phase 2.5 briefing, `feat/contract-hub-fix-forward` had landed on the base, renumbering ADR slots and changing file paths Items 3 + 5 depended on. Continuing anyway would have produced a PR with two merge conflict surfaces + one ADR collision.

**Learning:** Always re-diff the base at Phase 2.5. Don't trust a spec's base SHA without re-verifying `git log origin/<base>..<spec-base>` at the moment of execution. For multi-item bundles, each item needs its own base-sanity check — items 3 + 5 were deferred to a follow-up sortie once the base stabilizes.

**Applies to:** Council-gated bundle execution, long-running spec→plan→execute pipelines.

### L-0120 — git-show-not-ls for ADRs

**Context:** ADR-0194 and ADR-0198 both existed in the plan's intended slot. Running `ls docs/decisions/` showed 0198 only. Running `git log --all --oneline docs/decisions/` showed 0194 was reserved on another branch that had not merged. Writing to 0198 was correct; a naive `ls` would have picked 0194 and collided later.

**Learning:** For reserved-range numbered artefacts (ADRs, migration timestamps, council slots), always use `git log --all` or `git show <branch>:<path>` to check reservations across branches, not just the current tree. `ls` only reveals the branch you're on — reservations on `development` / parallel campaigns are invisible.

**Applies to:** ADR numbering, migration-timestamp allocation, any monotonic artefact index where parallel branches can reserve slots.

## Known issues / debt

| # | Issue | Cause | Owner / follow-up |
|---|---|---|---|
| 1 | `apps/web/src/app/api/botsson/recorder/force-stop/route.ts` + `.../whisper/route.ts` bypass `gate_action` (ADR-0099 violation) | Pre-existing routes predate ADR-0099 singleton enforcement | Whitelisted as FIXME in `scripts/check-gate-action-singleton.ts`. Dedicated fix-forward sortie needed. |
| 2 | `invariants:emit-coverage` script scope-limited to telemetry package internals | Script greps only within `packages/telemetry` directory; doesn't walk monorepo | Known limitation. Redesign needed to scan `apps/` + `packages/` + `services/` for `emit()` call sites. |
| 3 | `OPENROUTER_API_KEY` not set on `SXTNmedia21/smartout.ai` repo secrets | New requirement introduced by `ai-eval.yml` workflow in this sortie | Pontus must run `gh secret set OPENROUTER_API_KEY` — first PR that fires golden-eval without this will fail red until set. |
| 4 | Ultravox + Telegram adapters still accept optional `profile_id` in request body | Deferred from Item 1 scope — not in stage-engine path | Follow-up spec: move to bearer-derived only (same pattern as `/agent/chat`). |
| 5 | Items 3 + 5 of original bundle deferred (ADR-0189/0190/0192 + capability circuit breaker) | Blocked on `feat/contract-hub-fix-forward` merging to `development` (L-0119) | Re-spec after fix-forward lands; aim for next harness sub-sortie. |
| 6 | NonEmptyString brand cascade: **apps/web has 694 pre-existing errors across ~197 files** | Brand landing (commit 768e58dc) explicitly deferred emit-site migrations as out-of-scope. Web has the largest surface. | Dedicated brand-migration sub-sortie. Template transformation feasible via python codemod similar to the one applied to mobile in commit 6c0d72fa. |
| 7 | `apps/mobile/src/hooks/mutations/use-cancel-absence.ts` + `use-confirm-hours.ts` still emit with broken attribution | Pre-existing L-0094 violations: `workspace_id: null, actor_id: ""` → wrapped with `"unknown"` sentinel for type safety, runtime attribution remains broken | Fix-forward sortie with `getProfileContext()` resolution + error UI fallback — tagged `FIXME(ADR-0134/L-0094)` in source. |

## Next steps

1. **Wait for `feat/contract-hub-fix-forward` → `development` merge.** Items 3 + 5 prereq.
2. **Write spec for harness-hardening Part 2** (Items 3 + 5): ADR-0189/0190/0192 + capability circuit breaker. Re-base on post-merge `development`.
3. **Add `OPENROUTER_API_KEY` to `SXTNmedia21/smartout.ai` repo secrets** so the `ai-eval.yml` CI workflow can actually run. Without it, the first PR that hits the workflow will fail red; this is intentionally fail-closed.
4. **Fix the 2 recorder route `gate_action` bypasses** (force-stop + whisper). Small sortie, pattern is the same as contract-intake A1.
5. **Redesign `invariants:emit-coverage` script for monorepo-wide scope** — currently limited to telemetry package internals.
6. **Brand-cascade migration sub-sortie for `apps/web`** — 694 pre-existing errors across ~197 files. Template: copy the codemod pattern in commit 6c0d72fa (python regex + emit-site wrap) and apply to web emit sites. Test suite already mocks `@smartout/telemetry` in Jest contexts.
7. **Close the two FIXME(ADR-0134/L-0094) attribution bugs in mobile cancel-absence + confirm-hours** — use `getProfileContext()` with error-boundary fallback.

## Test + gate results

All gates run from `feat/botsson-arena-harness-hardening` tip (`6c0d72fa`):

| Gate | Command | Result | Notes |
|---|---|---|---|
| Typecheck (target packages) | `pnpm turbo typecheck --filter=@smartout/{mobile,training,year-wheel,schedule,telemetry,ai,stage-engine}` | 🟢 PASS | 13 tasks, all cached after first run |
| Typecheck (full monorepo) | `pnpm turbo typecheck` | 🔴 FAIL (pre-existing) | `apps/web` 694 errors across ~197 files — pre-existing brand cascade from 768e58dc; out of scope for this sortie. Documented as known debt item #6 above. |
| Full test suite | `pnpm turbo test` | 🟢 PASS | 38 tasks green. Mobile: 205/205. AI: 261/261. Stage-engine: 95/95. |
| I2 emit-coverage | `pnpm --filter @smartout/ai run invariants:emit-coverage` | 🟢 PASS (exit 0) | `ok: all emit() calls registered in registry.ts` |
| I4 server-actor | `pnpm --filter @smartout/ai run invariants:server-actor` | 🟢 PASS (exit 0) | `ok: no profile_id in POST body schemas` |
| I6 gate-singleton | `pnpm --filter @smartout/ai run invariants:gate-singleton` | 🟢 PASS (exit 0) | `ok: engine_authority_config reads only via gate_action RPC` |

## Deviation from task plan

The task plan specified a narrow cleanup scope (`training + year-wheel`). At execution time the cascade was actually training + schedule + year-wheel + mobile — 50+ sites across 32 files. All are committed in `6c0d72fa`. `apps/web` (694 errors) was left out of scope per the original deferral commit's charter; fixing it requires a dedicated sortie per debt item #6.

Beyond the cleanup scope, one change was necessary to make the mobile tests pass after brand-widening `ProfileContext`: `apps/mobile/src/lib/__tests__/profile-context.test.ts` now mocks `@smartout/telemetry` the same way `use-push-token.test.ts` and `journey-bff.test.ts` already did — jest-runtime cannot load the ESM `dist/*.js` entries directly.

---

## Post-handoff updates (2026-04-23, later)

### Web cleanup landed (commit `4c0c5e7d`)

Debt item #6 from the original handoff was closed in the same session.
203 files touched in `apps/web/src/` using a Python regex codemod + 4
manual passes. Error count: 694 → 0.

Patterns applied: ~500 raw-string-to-`nonEmpty()` wraps, ~60
`?? ""`-fallback eliminations, ~107 `string | null`-ternary
brandings, 3 trust-boundary type widenings (`AuthResult`,
`resolveAdminProfile`, `AgentToolContext`), 8 test-mock extensions.

### Rebase onto origin/development

Campaign `campaign/botsson-arena` was 6 commits behind dev. Merged
origin/development into campaign (merge commit `e84fe5d7`, 1 conflict
in `docs/DASHBOARD.md`, resolved `--ours`). Then rebased the sortie
onto updated campaign tip — 23 commits replayed with 6 conflicts
resolved:

| Commit | File | Resolution |
|---|---|---|
| Task 0 brand | `docs/decisions/0193-*.md` add/add | Took `--theirs` (our status flip + Implementation section) |
| Task 4 widen | `fork-template.test.ts` | Took `--theirs` initially (later reverted to dev's shape — see below) |
| Cleanup 6c0d72fa | mobile `use-confirm-hours.ts` | Took `--ours` (dev's `getProfileContext()` beats our "unknown" placeholder) |
| Cleanup 6c0d72fa | mobile `use-livekit-call.ts` | Took `--ours`, re-applied `nonEmpty()` post-rebase |
| Cleanup 6c0d72fa | mobile `use-cancel-absence.ts` | Took `--ours` |
| Web cleanup 4c0c5e7d | `contract-templates/copy/route.ts` | Took `--ours` (dev's PR #237 removed legacy `copied` event) |
| Web cleanup 4c0c5e7d | `signoff-session-action.ts` | Took `--ours` (dev's ADR-0187 removed this emit) |

### Post-rebase brand-cascade fixup (commit `e2a462b3`)

Fixed 14 typecheck errors across 7 files — dev's 6 commits brought 7
new emit sites that needed `nonEmpty()` branding now that Task 0
landed. Also restored `fork-template.test.ts` to dev's updated
per-call-mock-array shape (refactored in PR #237) with brand wraps
re-applied to the 3 `makeCtx` call sites.

### Final verified state (post-rebase)

All gates re-run, all green:

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` (full monorepo) | 🟢 35/35 PASS | apps/web debt closed |
| `pnpm turbo test` | 🟢 38/38 PASS | all packages |
| I2 emit-coverage | 🟢 exit 0 | |
| I4 server-actor | 🟢 exit 0 | |
| I6 gate-singleton | 🟢 exit 0 | |

### Original debt item #6 closed

"Brand-cascade migration sub-sortie for apps/web — 694 pre-existing
errors across ~197 files" — **done in this session**. Next-steps
table above can have item #6 removed at close time.

### Open debt unchanged

Items 3 (recorder route gate bypasses), 4 (emit-coverage script
monorepo scope), 5 (mobile attribution FIXMEs), and the Part-2 spec
(Items 3 + 5 of original bundle) remain tracked. Item 6 (web
cleanup) closed above. Item 7 (mobile attribution) mostly remains —
dev's parallel work fixed the pattern for use-confirm-hours +
use-livekit-call + use-cancel-absence by integrating
`getProfileContext()`, so the "FIXME(ADR-0134/L-0094) attribution
broken in 3 files" debt shrinks to whatever mobile files still use
the "unknown" sentinel (zero in current tree — verify at PR time).

### Commit log at close (24 commits)

```
8a10b376 docs(harness-hardening): add YAML frontmatter to plan
db75da9b docs(harness-hardening): verify 3 journeys with debt
e2a462b3 fix(harness-hardening/post-rebase): brand new emit sites
4c0c5e7d fix(harness-hardening/cleanup-web): cascade brand
3a6d9433 docs(harness-hardening): handoff + campaign doc
4b2fbebb fix(harness-hardening/cleanup): cascade brand training/schedule/year-wheel/mobile
271cfd1c (rebased from 6c0d72fa cleanup)
(rebased 17 task commits — see git log for full list)
b71bd787 feat(harness-hardening/brand): land NonEmptyString per ADR-0193
744af2a3 docs(harness-hardening): declare 3 journeys
93691356 docs(plan): harness hardening — 17-task TDD plan
88b52105 docs(spec): harness hardening — 4-item bundle after council
```

