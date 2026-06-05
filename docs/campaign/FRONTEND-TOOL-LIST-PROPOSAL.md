---
title: Frontend Refactor — Tool List (CANONICAL)
status: confirmed
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [tools, skills, enforcement, telemetry, nordic-split, canonical]
---

# Frontend Refactor — Tool List  ·  CANONICAL

> **This is the single source of truth for the loop's tool catalog.**
> `AUTONOMOUS-SYSTEM-INSTRUCTION.md` §5 points here — do not maintain a parallel list there.
> Statuses below are **verified on disk 2026-06-03** (golden-path session), not drawn from intent.
>
> **Two engines + a router.** **(A) Build skills** = how a domain goes FAIL→PASS.
> **(B) Enforcement gates** = mechanical CI walls that make a Nordic-Split/telemetry violation
> *impossible to merge* — design as a product, not a guideline. **(C) Router** = the one skill
> that picks the right tool per task.
>
> Legend: ✅ exists · ♻️ extend/harden what exists · 🆕 build.

---

## A. Build skills — one per gap-class (§5), reusable across all 13 domains

| # | Skill | Covers (the gap it closes) | Feeds gate | Status |
|---|-------|----------------------------|-----------|--------|
| A1 | `smartout-design-port` | the 4-file copy-not-rewrite port unit **+ honest-empty-state** (A5 folded in — no-ghost-data is cross-cutting, part of the port motion, proven on min-dag-v2's 3 "ikke implementert ennå" stubs) | port-fidelity | ✅ draft exists |
| A2 | `register-events` | reconcile design events → `registry.ts` (the ~144-event backlog) | `events_missing_from_registry[]` → empty | ✅ **exists** — `.claude/skills/register-events/` (crystallized from the min-dag-v2 recipe: 3-site edit + dist rebuild + 3-layer caveat) |
| A3 | `wire-hookless-mutation` | attach a real data hook to a dead CTA | `hooks_missing[]` → empty | 🆕 build |
| A4 | `gate-ungated-write` | add auth + awaited `emit()` to a raw write (DB-wall aware) | `mutations` ungated → 0 | 🆕 build |

*(A5 `honest-empty-state` — **dissolved into A1** per golden-path evidence. Not a separate gap-class.)*

## B. Enforcement gates — Nordic Split + telemetry as a product (mechanical CI walls)

> Convention = `scripts/check-*` + the husky `.husky/pre-commit` numbered gates (≈11 ship today).
> Each: scans changed `.tsx/.css`, fails on a violation, prints file:line + the fix.

| # | Tool | Enforces (rule + ADR) | Status |
|---|------|------------------------|--------|
| B1 | `check-design-tokens` | no hex · no raw `oklch()` · no `zinc/slate/gray-*` (ADR-0366 / ADR-0361) | ♻️ **extend** — pre-commit **hook #10** already scans `zinc/gray/slate` + inline `stiffness/damping` on staged dashboard files (strand-1, "no NEW"). Extend to hex + raw-oklch + fonts; harden "no NEW" → "none". |
| B2 | `check-fonts` | only Instrument Serif / Geist / Geist Mono | 🆕 build (fold into B1's scan?) |
| B3 | `check-motion-tokens` | no inline `stiffness/damping/duration` — use `motionTokens.*` | ♻️ partly in hook #10; extend to `duration`/ease arrays (≈30 open sites) |
| B4 | `check-ui-purity` | no emoji in UI · Lucide-only icons | 🆕 build |
| B5 | `check-copy-fidelity` | port ~2× source line-count = rewrite → reject | 🆕 build |
| B6 | `check-telemetry-coverage` | events **emitted-and-landed in `activity_trail`** (layer-2), reconciled to `registry.ts` — **NOT** layer-1 "defined" | ♻️ **harden into a gate** — `telemetry-map/emit-coverage.sh` + `completion-rate.sh` + `reports/emit-coverage-*.json` already measure it. **The done-oracle.** |

## C. Router

| # | Skill | Does | Status |
|---|-------|------|--------|
| C1 | `frontend-workflow-router` | given a task or a `control.json` blocker-class → names the exact skill(s) to run, in order. Makes §5 "select by gap-class" invokable. | 🆕 build (after the minimum proves out) |

## Already-exist (reuse, never rebuild)

`smartout-nordic-split` · `smartout-database-guide` · `smartout-edge-function-guide` ·
`smartout-page-polish` (**active gate** — blocked min-dag-v2 commit) · `packages/telemetry/src/registry.ts`
(done-oracle, 16k lines) · `.husky/pre-commit` numbered gates · `telemetry-map/` coverage scripts.

---

## Resolved (2026-06-03, golden-path evidence — was "open questions")

1. **A5 fold?** → **FOLDED into A1.** Empty-state stubs were part of min-dag-v2's port motion, not a separate gap-class. No-ghost-data is cross-cutting → lives in the port skill.
2. **scripts vs ESLint?** → **scripts.** Matches the husky `pnpm check:*` convention already exercised. One convention, reuse.
3. **B6 first?** → **YES** — it's the done-oracle. **Nuance:** must measure **layer-2 (emitted, reconciled to `activity_trail`)**, never layer-1 (defined) — the seeded-GREEN-was-0%-real trap caught this session. Build by **hardening `emit-coverage.sh`**, not from scratch.
4. **First cut?** → **golden-path-minimum, even smaller than first drawn:** **A2** (proven, crystallize) · **B6** (harden the oracle) · **extend B1** (hook #10). Fan out the rest after one domain reads all-green.

## The motion (proven-first, secure-as-you-go)

1. **Commit** the green registry + adapter work (registry.ts/dist is standalone — no page-polish gate). *(orchestrator's lane — its worktree context + the live recipe.)*
2. **Crystallize `A2 register-events`** from the proven min-dag-v2 recipe (3-site + telemetry rebuild) — the first *real* gap-skill, not theoretical.
3. **Repoint §5** in `AUTONOMOUS-SYSTEM-INSTRUCTION.md` → this doc (canonical). Dedupe the two catalogs.
4. **Next:** harden B6 (the oracle) → then the loop has a real gate to drive toward.
