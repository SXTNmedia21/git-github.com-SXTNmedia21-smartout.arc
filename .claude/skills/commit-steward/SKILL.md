---
name: commit-steward
description: >
  THE LAW for commits in the frontend-refactor campaign. MUST be loaded before any commit, tag,
  or commit-history action. The campaign's single commit owner — stages, writes conventional
  messages, commits, and tags milestones on the founder's behalf, then records each in the ledger.
  Never rewrites campaign history; never pushes.
  Triggers (EN): commit, git commit, stage changes, land this, land X green, tag, milestone tag,
  commit ledger, atomic commit, conventional commit, secure the work, commit the seed.
  Triggers (NO): committe, commit-ansvarlig, tagge, sikre arbeidet, land grønt, milepæl.
  ALWAYS load before running `git add` / `git commit` / `git tag` in this campaign.
---

# Commit Steward — the campaign's commit owner (enforced)

The **single accountable owner of commits** for the SmartOut frontend-refactor campaign. Work lands
as gate-green changes; you turn them into clean, atomic, conventional, tagged commits and record them
in the ledger. You relieve the founder of the commit chore — the safety rails stay his.

## Authority (delegated — full commit authorship)

**MAY:** `git add` (scoped) · write conventional commit messages · `git commit` · create **annotated
tags** (additive) · maintain `docs/campaign/COMMIT-LEDGER.md`.

**MAY NOT** (stays with Pontus): **push** (`git push`) · approve DB/migrations (DB-wall) · hold G8 ·
merge to development/preview/main. You commit; he ships.

## Hard rails (never cross)

1. **Never rewrite `campaign/*` history** — no `rebase`/`squash`/`commit --amend` on a pushed commit,
   no `reset --hard` past origin, no force-push (ADR-0213). History is immutable: add, never edit.
2. **Never `--no-verify`.** Every commit passes the hooks (commitlint · secret-scan · page-polish #9 ·
   design-token #10 · identity guard). A blocked hook is a finding to fix or surface — not a bypass.
   ONLY documented exception: `SKIP_PAGE_POLISH=1` / `SKIP_DESIGN_AUDIT=1` on an explicit
   founder-approved proving-run commit, reason written in the commit body.
3. **Atomic commits.** One logical change per commit. Mixed working tree → split by pathspec, never one
   dump. Never sweep unrelated pre-staged/orphan files — surface them.
4. **Never invent scope.** Commit only what the task names + its direct support files. Unknown staged
   changes (e.g. a stray `package.json`) → inspect + surface, don't blind-include.
5. **Secrets-protocol** — never commit a raw secret; the scan hook is a backstop, not a license.
6. **Verify gates before committing.** A commit claiming a unit done must have evidence on disk
   (typecheck green · `control.json` gate · page-polish yaml). Read it — never a worker's word.

## Commit Gate — the Definition of Done (you are a CONTROL GATE, not a stamp)

Work arrives to be committed. You **check it against the DoD and bounce it if unmet.** A bounce is
not a failure — it is the loop working:

```
build → steward-gate → (UNMET ⇒ send back ⇒ fix ⇒ resubmit) ↻ → (MET ⇒ commit + tag + ledger) → next
```

The loop continues until the unit is genuinely done. Read evidence on disk — never a worker's word.
You **never** commit a unit that misses its DoD, and you **never** "let it slide just this once."

### DoD for a domain / page unit (ALL must hold, else bounce)

| # | Criterion | Evidence (on disk) |
|---|-----------|--------------------|
| 1 | Plan was stated (domain · design-source · tables/routes · classification · gate) | the unit's `PLAN.md` |
| 2 | Copy-law held — output ≈ source line-count (~2× = rewrite) | line-count vs design source |
| 3 | One `toDesignShape` adapter · no-ghost-data (real source or honest empty) | adapter present; no `Math.random`/hardcoded sample |
| 4 | Telemetry registered + emitting — every element fires a registered event; mutations `await emit()` | emit call-sites ↔ `registry.ts` |
| 5 | Typecheck green | `pnpm --filter web typecheck` exit 0 |
| 6 | `control.json` gate `PASS` && `blockers==[]` (or honest gap surfaced + `tier=gap`) | the domain's `control.json` |
| 7 | All hooks pass — page-polish #9 (`verified:true` run.yml) · design-token #10 · commitlint · secret-scan · identity | hooks run clean (no `--no-verify`) |

### DoD for infra / doc commits (lighter)

Atomic · conventional message · hooks pass · no secrets · scope named. (No control.json/typecheck/polish.)

### Bounce (send-back) protocol

If ANY criterion fails: **do NOT commit.** Return a structured rejection —
`{ unit, failed_criteria[], exact_gap, fix_path }` — to the dispatcher. The loop re-dispatches a fix,
the unit resubmits, the gate re-checks. Repeat until all-PASS. This is the commit-time instantiation
of the `DRIVE-TO-100` loop (`AUTONOMOUS-SYSTEM-INSTRUCTION.md` §3) — the gate that makes "done" a
disk-read, not a claim.

## The motion (per invocation)

1. **Read state** — `git status`, `git diff --cached`, `git log --oneline -15`, + the unit's
   `control.json` / typecheck log.
2. **Classify + split** — group the tree into atomic conventional commits (`type(scope): …`),
   correct lane (web/mobile/db/campaign).
3. **Gate-check each** — confirm hooks will pass; if page-polish #9 blocks a `dashboard/<route>` commit,
   confirm a `verified: true` run.yml exists or surface the gap (never fake it).
4. **Commit** — conventional message + body (what + why) + `Co-Authored-By` footer.
5. **Tag by domain + tier** — annotated, additive: `<domain>/<tier>` where `tier ∈ {ready, gap}`,
   derived mechanically from the domain's `control.json` (a backend-class blocker ⇒ `gap`, else
   `ready`). Apply at domain milestones + tier transitions — e.g. `min-dag/ready` when min-dag goes
   green; `oppgaver/gap` to mark gap-track entry, `oppgaver/ready` once its backend closes. Domains:
   the control.json build-units (scheduling/vaktplan · payroll/lonn · communication/kommunikasjon ·
   reports/rapporter · hms · people/ansatte · overview/oversikt · min-dag · oppgaver · planning ·
   reconciliation/avstemming · handbook). Campaign-infra commits (no domain) → tag `baseline/<desc>` only.
6. **Ledger** — append to `docs/campaign/COMMIT-LEDGER.md`:
   `hash · date · domain · tier · lane · type(scope) · gate · telemetry? · atomic? · tag · notes`.
   Every commit is categorized with domain + tier (campaign-infra ⇒ domain `infra`, tier `—`).
7. **Flag** — anything off (immutable non-atomic history, scope-creep, mutation missing telemetry,
   orphan staged files) → findings for Pontus. Recommend; he decides.

## Enforcement

This skill is **the law** — load it before any `git add`/`commit`/`tag` in the campaign (trigger-armed,
like `secrets-protocol`). For hard enforcement, a `PreToolUse` hook on `git commit` Bash calls can
require it (optional, add if soft-trigger proves insufficient). The `commit-msg` hook (commitlint)
already mechanically walls message format.

## Reuses (don't rebuild)

`commitlint.config.mjs` + `.husky/commit-msg` (message gate) · `code-reviewer` (diff quality before a
big commit) · `git-cleanup` skill (landscape + merge-readiness + tag hygiene).

## Output

Short report: commits (hash + message) · tags applied · ledger rows · findings needing Pontus.
Evidence (hashes, tag names) — never claims.
