---
title: HANDOFF — Audit Sortie 2, ADR-0204 §3 CI Enforcement
status: review
created: 2026-05-06
updated: 2026-05-06
module: ci
tags: [audit, security, ci, adr-0204, sortie, handoff]
sortie: feat/audit-sortie-2-adr-0204-ci-grep
worktree: ~/wsl/smartout.ai-wt-7
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# HANDOFF: Audit Sortie 2 — ADR-0204 §3 CI Enforcement

## Summary

Highest-leverage fix from the 2026-05-06 audit shipped. ADR-0204 §3 specified a CI grep `scripts/ci/no-inline-gate-rpc.sh` to mechanize the "no inline `gate_action` RPC outside orchestrator" invariant — the script never existed. Now it ships, all 3 web-tier violations are migrated to the canonical `gateAction()` web orchestrator, and CI runs the gate on every PR.

## Fixes shipped

| # | Commit | What |
|---|---|---|
| F1 | `9d872ec32` | `scripts/ci/no-inline-gate-rpc.sh` — POSIX bash blocker, allowlist-aware. Reports `file:line` per violation, exits 1 on any. |
| F1.5 | `c0f0a0d23` | Allowlist refined — `apps/web/src/app/dashboard/_actions/_shared.ts` is the canonical web-tier orchestrator (NOT a non-existent `apps/web/src/lib/cascade/gate-client.ts`). |
| F3a | `2a3b8933d` | `apps/web/src/app/api/observer-requests/route.ts` POST handler migrated to `gateAction()` from `_shared.ts`. Subject line is misleading (says "_shared.ts gateAction" but diff is route.ts) — see L-NEW-2 below. |
| F3b | `c0ca76ecc` | `apps/web/src/app/api/observer-requests/[id]/route.ts:107` migrated. |
| F4 | `7f20e9568` | `apps/web/src/app/api/employment-contracts/bulk/route.ts:134` migrated. |
| F5 | `485574751` | `.github/workflows/ci.yml` — added `no-inline-gate-rpc` job triggered on PR events. |

Branch: `feat/audit-sortie-2-adr-0204-ci-grep`. Worktree: `~/wsl/smartout.ai-wt-7`. Base: plan + journeys at `628b9faa9`.

## Architectural decision

**`_shared.ts:gateAction()` is THE web-tier `gate_action` RPC orchestrator.** No separate `gate-client.ts` wrapper exists or needs to exist for this RPC. The audit slice 04 finding S04-01 originally flagged `_shared.ts:101` as a violation — but `_shared.ts` is `"use server"` Server Actions module, and `gateAction()` is the only thing wrapping the RPC for web callers. Banning it would mean banning `gate_action` from the web tier entirely.

The CI grep allowlist now reflects this: `_shared.ts` is the second sanctioned call site (alongside `packages/ai/src/gate/gatedMutation.ts` which is the agent-tier orchestrator). All other web callers — Server Actions, route handlers, future mobile BFF routes — MUST go through `gateAction()`.

**Why no new ADR:** This is enforcement of an existing ADR (ADR-0204 §3), not a new architectural choice. ADR-0204's example uses `gatedMutation()` from agent layer; web layer's analogue is `gateAction()` from `_shared.ts`. The mapping was already implicit; this sortie makes it CI-enforced.

## Verification

```bash
cd ~/wsl/smartout.ai-wt-7
bash scripts/ci/no-inline-gate-rpc.sh
# → PASS: no inline gate_action RPC calls outside orchestrator (ADR-0204 §3)
pnpm turbo typecheck --filter=web
# → 9/9 successful
```

## Learnings

### L-NEW-1 — Worktree freshness gap blocks per-package typecheck

Fresh worktrees from `new-feature.sh` lack `node_modules` and built `dist/` for internal packages. The `pnpm --filter web typecheck` Stop hook fails with cascading TS errors (Cannot find Set/Map, missing JSX flag, missing Promise — all symptoms of `lib`/`types` not loading because `@smartout/*` packages aren't installed). Resolution requires:
1. `pnpm install` (5–15 s)
2. `pnpm turbo build --filter=@smartout/telemetry --filter=@smartout/supabase --filter=@smartout/types --filter=@smartout/utils` (or full `pnpm turbo build` to get all internal packages built)

**Why:** Cached turbo build from main repo doesn't propagate to fresh worktrees because each worktree has its own `node_modules` (pnpm workspace symlinks resolve relative to the worktree root). The Stop hook runs `pnpm --filter` which bypasses turbo's dependency graph and hits raw tsc against unbuild deps.

**How to apply:** Either (a) `new-feature.sh` should optionally run `pnpm install && pnpm turbo build` at end, or (b) the dispatching agent should be told to run install + build before any code edit. Promote to repeat-occurrence: if seen on Sortie 3, propose change to `new-feature.sh`.

### L-NEW-2 — Sub-agent commit subjects can drift from actual work

Commit `2a3b8933d` has subject "fix(adr-0204): _shared.ts gateAction routes through gate-client (HIGH close)" — but the diff is `apps/web/src/app/api/observer-requests/route.ts` migration (43 LOC), zero changes to `_shared.ts`. The agent picked the subject from the original prompt's F2 description (which I was reusing as scaffold), then did a different fix when its own analysis showed F2 wasn't needed. Subject didn't get updated.

**Why:** Long-running build agents follow a multi-step plan. Subject lines are sometimes prepared from the plan template. When mid-execution rescoping happens (e.g. agent realizes F2 is not needed, jumps to F3), the prepared subject doesn't get re-derived.

**How to apply:** Future build-agent prompts should require the agent to compose the commit subject FROM the actual diff at commit time, not from the plan template. Add to dispatch prompt: "Verify the commit subject matches `git diff --cached --stat` before writing — do not reuse subjects from the plan."

### L-NEW-3 — Stop hook + per-package typecheck is fragile coordination signal

The PostToolUse:Edit Stop hook running `pnpm --filter web typecheck` triggered ~6 false-positive blockers during this sortie. Causes:
- Worktree missing node_modules (L-NEW-1)
- Mid-edit transient state (agent removed type definition before adding the import that replaces it; typecheck saw the gap)
- Pre-existing breakage on baseline (e.g. `proxy.ts` missing `@types/node` resolution)

The hook treats every transient typecheck failure as a hard block. This created an apparent loop where the agent kept retrying edits while the underlying issue was harness-level (missing install) or expected-mid-edit.

**How to apply:** Stop hook should distinguish between "regression caused by your edit" and "pre-existing or harness-level failure". Possible improvement: hook caches a baseline typecheck output at session start; only flags NEW errors introduced by the diff. Or: hook runs `pnpm turbo typecheck --filter=web` (uses dependency graph) instead of `pnpm --filter web typecheck` (raw tsc, no build).

## Known issues / debt

- **`2a3b8933d` subject misleading** (L-NEW-2 above). Code-correct but reading `git log` will misclassify. Mitigated by this HANDOFF + the audit synthesis cross-reference.
- **Branch protection promotion** — F5 added the `no-inline-gate-rpc` job to `ci.yml`. Promoting it to a "required check" via GitHub branch-protection ruleset is a separate manual step Pontus does in the GitHub UI. Until then, the job runs but doesn't block merges. Recommended ruleset target: `main` + `preview` (not `development` — bare ruleset per project convention).
- **Sortie 1 still local-only** — `feat/audit-sortie-1-unauth-closes` was committed to development locally but never pushed (pre-push lint hit pre-existing warnings). Sortie 2 branched from `ba419e41d` (origin/development) which doesn't have Sortie 1's commits. No conflict — Sortie 2 touches different files. But when both close, push order matters: Sortie 1 first, then Sortie 2.

## Next steps

### Pre-merge (Pontus)
1. Run grep + typecheck verification (commands above) — already passing.
2. Decide branch-protection promotion timing for `no-inline-gate-rpc` required check.
3. `close-feature.sh 7` to merge Sortie 2 to development.

### Post-merge
- **Sortie 3** (telemetry sweep): outreach + engine_world registry events + `sendEmployeeContract` zero emit. ~1–2 days. Independent of S2.
- **Sortie 4** (mobile remediation): 6 caller-supplied-ID hooks + `chat_message` direct insert. ~2–3 days. Independent.
- Promote `no-inline-gate-rpc` to required CI check in branch protection rulesets (manual GitHub UI step, post-merge).

## Closure deliverable status

- [x] Plan: `docs/plans/PLAN-audit-sortie-2-adr-0204-ci-grep.md`
- [x] Journeys: `docs/journeys/JOURNEY-audit-sortie-2-adr-0204-ci-grep.md`
- [x] All 5 fixes shipped + verified
- [x] CI grep `bash scripts/ci/no-inline-gate-rpc.sh` exits 0 on clean tree
- [x] Typecheck passes
- [x] HANDOFF (this file)
- [ ] No new ADRs needed (pure ADR-0204 §3 enforcement); skip
- [ ] `close-feature.sh 7` — Pontus runs after pre-merge checks above
