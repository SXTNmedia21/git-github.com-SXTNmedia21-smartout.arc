---
name: domain-steward
description: Use when defining a new Smartout product-domain doc folder under docs/domains/<name>/, when refining/reconciling an existing domain's docs against the codebase, when closing out a domain after a build sortie, or when domain docs may have drifted from code. Triggers on "define domain", "new domain", "reconcile domain", "domain docs", "is this domain doc correct", "docs/domains", "domain dashboard", "domain drift", and domain names (billing, daytimeline, payroll, announcements, procedure-engine, core-structure, communication, contracts, year-wheel, notifications).
---

# domain-steward

## Overview

A **domain** is a bounded product area (billing, payroll, daytimeline…). Its truth lives in **one folder**: `docs/domains/<name>/`, a fixed 8-file spine. This skill defines, refines, and closes out those folders so each is an honest mirror of the codebase — the single place to look for concrete insight into a domain.

**Core principle:** *Code wins.* Every `mirror: verified` claim must be checked against actual code/schema, with file:line citations. Aspiration is allowed but must be marked `mirror: aspirational` and live in ROADMAP/GAPS — never blended silently into a verified doc.

**Two truth axes (frontmatter):**
- `status:` — doc lifecycle (`draft|in_progress|review|done|archived`) per repo standard.
- `mirror:` — code-truth (`verified` = checked vs code | `aspirational` = ahead of code | `mixed`).
- `last_verified:` — ISO date the verified claims were last checked vs code.

## The Spine (8 files — fixed names, never invent others)

| File | status/mirror | Holds |
|---|---|---|
| `README.md` | done / verified | Entry: build-state badge, reading order, **`## Agent Guardrails`** (traps + pointer) |
| `OVERVIEW.md` | / verified | What + why. Cascade placement. (Replaces old `MODULE_X`.) |
| `ARCHITECTURE.md` | / verified | L1–L5 code map. **Code wins.** |
| `DATA-MODEL.md` | / verified | Tables, FKs, enums, RLS, telemetry. **Code wins — actual schema.** |
| `USER-FLOWS.md` | / verified | Flow index. **Links** to `docs/journeys/<slug>/` (does NOT duplicate). |
| `ROADMAP.md` | / aspirational | Forward plan + design intent. **References governing ADRs + planned journeys here.** |
| `GAPS-AND-DEBT.md` | / verified | The bridge: built-vs-planned delta. Every gap cites code (file:line) or roadmap. |
| `E2E-COVERAGE.md` | / verified | Test matrix = proof of what is actually built+tested. |

Optional working-docs allowed (graduate out when done): `ADR-DRAFT-*` (→ `docs/decisions/`), `FINDINGS-*`, `AUDIT-*`, deep-dives (e.g. payroll `TIME-BANKS.md`).

## Three Modes

```
domain-steward pre <name>      define a NEW domain  (high-confidence intake)
domain-steward update <name>   reconcile existing docs vs code
domain-steward post <name>     close out after a build sortie
domain-steward dryrun [name|all]   preview-only: removal/consolidation plan + confidence (writes NOTHING)
```

### pre — define new domain
1. **ASK the user first** — scope, boundaries, what it covers / explicitly does NOT cover. Do not guess the boundary. (See High-Confidence Rule.)
2. **Research + index** — grep `docs/` for scattered mentions; pull old `docs/architecture/modules/SMARTOUT_MODULE_*`, flat `docs/modules/MODULE_*.md`, related ADRs, **and the domain's `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/handoffs/*`**. List what exists. Then run Spec/Plan Reconciliation (below).
3. **Confirm code** — map the domain's real surfaces: routes, packages, supabase tables, edge functions, AI capabilities. Cite paths.
4. **Generate all 8 spine files** from `templates/`. Verified sections checked vs code (cite file:line); aspiration marked `aspirational`.
5. **Supersede old docs** — migrate/absorb the scattered sources, then mark them `status: archived` + `superseded_by:` pointer. One truth, not two.
6. **Register** in `docs/domains/_DASHBOARD.md`.

### update — reconcile vs code
1. Re-index docs + re-confirm code surfaces.
2. **Diff each `verified` claim vs code.** Mismatch → fix the doc OR log it in `GAPS-AND-DEBT.md`. Never leave a silent lie.
3. Run the real verification (see below) — don't punt.
4. Bump `mirror:` + `last_verified:` + `updated:`.
5. Refresh the dashboard row.

**Recognized triggers for `update`:**
- **Council verdict** — Phase 7 of `run-council` MUST dispatch `update` for every affected domain. The council briefing is the context; reconcile in **targeted** mode (only re-grep the claims the council touched). See `run-council/SKILL.md` Phase 7 "Domain spine reconciliation".
- **Post-sortie closure** — `/close-feature` should trigger `update` if the sortie touched a domain spine (use `post` mode for full re-verification; `update` for targeted drift-fix).
- **Routine drift-check** — periodic heartbeat or manual `update <name>` to catch silent code-vs-spine drift.
- **Pre-sortie scope-check** — when a new sortie is being planned, `update` confirms spine reflects current code so the plan isn't built on stale assumptions.

Council-driven `update` is **mandatory not optional** — skipping it creates 2-source-of-truth drift (council decided X, spine still says ¬X). See `_DASHBOARD.md` Migration Backlog for any pending council-reconciliation debt.

### post — close out after a sortie
1. Capture what the sortie changed; update `ARCHITECTURE`/`DATA-MODEL`/`E2E-COVERAGE`.
2. Move closed gaps out of `GAPS-AND-DEBT`; add any new debt with code citation.
3. **Auto-learn**: append durable insight to the relevant spine file (not a separate log).
4. Tick dashboard progress.

## Spec/Plan Reconciliation (confirm → deviation → gap)

A spec or plan is a **claim of intent**, not proof of code. For each spec/plan/handoff the domain references, verify it against actual code and assign one outcome:

1. **Confirmed** — code matches the spec. Compile the intent into the verified spine (`ARCHITECTURE`/`DATA-MODEL`), cite `path:line`, mark the source "delivered" in `ROADMAP.md`.
2. **Deviation** — code did it **differently** than the spec said (spec: X, code: Y). **Code wins** — document the real behavior in the spine, and record the deviation in `GAPS-AND-DEBT.md` §Deviations (spec ref + what differs + why, if known).
3. **Gap** — spec/plan **not implemented** (or partial). Define a gap in `GAPS-AND-DEBT.md` §Gaps, linked to the spec + the `ROADMAP.md` phase that will close it.

Never assume a spec/plan shipped because it exists or is in `plans/completed/`. Check the code. A "completed" plan with no matching code = a gap, not a confirmation.

## Overlap Detection (consolidate / split)

Domains leak into each other (daytimeline ↔ procedure-engine share `session_task`, `day_line`, the whole D6 surface). A doc folder that ignores overlap lies by omission. On every `pre` and `update`:

1. **Detect** — for each table/component/capability the domain claims, grep whether **another** `docs/domains/*` claims the same surface. Shared surface = overlap edge.
2. **Classify** the seam:
   - **keep** — clear boundary, both legitimately touch it (cite the seam).
   - **consolidate** — same concept documented twice / two domains fighting over ownership → merge into one owner, the other links.
   - **split** — one domain has swallowed two concepts → carve out.
3. **Record** in the domain's `GAPS-AND-DEBT.md` §Overlap **and** the `_DASHBOARD.md` "Overlap edges" table, with a recommendation + rationale.
4. **Propose, don't auto-merge** — boundary changes are load-bearing (ADR-0240 frozen-boundary thinking). Surface the recommendation to the user; never silently move ownership.

### dryrun — preview removals + confidence
Writes **nothing**. Produces a plan of what to remove/consolidate and how confident we are that removal is a net improvement.

For each candidate output: **path · action (delete / archive / merge-into / keep) · confidence (HIGH/MED/LOW) · rationale · what absorbs it**.

**Confidence rubric:**
- **HIGH** — byte-identical duplicate; mechanical junk (`*Zone.Identifier`, binaries in docs); legacy source already fully absorbed into a spine + cross-checked. Safe to remove.
- **MED** — overlap-consolidate loser where one domain is the clear owner, but unique content must be merged first. Remove only after merge confirmed.
- **LOW** — looks redundant but holds unique, unabsorbed content. **Do NOT remove** — flag for human review.

**Safety:** dryrun never deletes. Anything below HIGH stays. A candidate is HIGH-to-delete only if its content is provably elsewhere (diff/grep shown) or it is mechanical junk. When unsure → LOW → keep + ask.

## High-Confidence Rule

Uncertain about a boundary, an ownership question, or whether something is built? **STOP and ask the user.** A domain doc that guesses is worse than no doc — it lies with authority. Asking is cheap; a confident wrong mirror is expensive.

## Verification = actually run it (not "to verify, run X")

The RED baseline punted: it wrote *"to fill the gap, run `SELECT enum_range(...)`"* and moved on. **Forbidden.** If a claim needs the local DB, run it (`docs/reference/DATABASE.md` for connection; local Supabase only). If it needs a grep, grep it. A `verified` claim with no citation is not verified — downgrade it to `aspirational` or `mixed` until checked.

**Line citations drift.** Files grow; `path:line` rots (GREEN test found a banner cited at `:238` actually at `:297`). Cite with a **grep-able anchor** (a unique string/symbol) plus the line as a ±hint — verify by pattern, not by line number. When `update` re-verifies, re-grep the anchor and refresh the line.

## Dashboard

`docs/domains/_DASHBOARD.md` — matrix: domain × build-state × tested × `last_verified` × open gaps. This is the honest map. NOT `docs/DASHBOARD.md` (that is git-state per ADR-0075 — never write domain status there).

## Boundaries (respect existing owners)

- **ADRs** are global — referenced in `ROADMAP.md`, never re-authored per domain. `ADR-DRAFT-*` may transit the folder, then graduate to `docs/decisions/`.
- **Journeys** are owned by `journey-protocol` (`docs/journeys/<slug>/`). `USER-FLOWS.md` **links**, never duplicates.
- **Specs & plans** (`docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/handoffs/*`) are **dated sources** (raw), not living truth (compiled). **Read them, reconcile vs code (confirm/deviation/gap), reference in `ROADMAP.md` — never move them into the domain folder.** They span domains and belong to the superpowers workflow + git history. Only legacy *compiled* docs (`MODULE_*`, `SMARTOUT_MODULE_*`) get absorbed + archived.
- **CLAUDE.md never goes in the doc folder** — it won't auto-load where code work happens (wrong cwd). Domain agent-rules live in `README.md` `## Agent Guardrails`. A thin pointer `CLAUDE.md` at the *code root* (e.g. `packages/billing/CLAUDE.md`) is optional v2.
- Mechanical cleanup (Zone.Identifier purge, binaries out of docs, dedup) is a **script/chore, not skill judgment** — the stop-hook flags it; don't hand-curate it.

## Red Flags — STOP

| Symptom | Fix |
|---|---|
| Inventing file names (`X-DOMAIN.md`, `-QUICK-REF`) | Use the 8-file spine. Only spine names. |
| Built-vs-planned as a *section* in one doc | Standalone `GAPS-AND-DEBT.md` + per-file `mirror:`. |
| `verified` claim with no file:line | Run the check or downgrade to `aspirational`. |
| "To verify, run …" then moving on | Run it now. |
| Two live docs for one domain | Absorb + archive the old one. |
| Guessing a boundary | Ask the user. |
| Writing domain status to `docs/DASHBOARD.md` | Use `docs/domains/_DASHBOARD.md`. |
| 40KB monolith | Split across the spine. |
| Domain shares a table/component with another, undocumented | Run Overlap Detection → record edge + consolidate/split/keep recommendation. |
| Assuming a spec/plan shipped because it exists or is in `plans/completed/` | Check the code. No matching code = gap, not confirmation. |

## Skill maintenance

This skill was built RED→GREEN→REFACTOR (writing-skills). RED baseline: `general-purpose` agent on `billing` without the skill invented its own 3-file set, used no `mirror:` status, folded gaps into a section, punted DB verification, never built a dashboard, left the old doc alive. The spine + High-Confidence Rule + "actually run it" + dashboard requirements each close one of those failures.

### Asymmetric skill location (known risk)

This skill lives at `.claude/skills/domain-steward/` — **project-local**, committed to the Smartout repo. Its counterpart `run-council` lives at `~/.claude/skills/run-council/` — **user-global**, NOT in any repo. The two skills reference each other (council Phase 7 → domain-steward update; domain-steward `update` triggers → council). The pairing is load-bearing for ADR-0392 compiled-truth discipline.

**Failure mode:** if `run-council` is invoked from a project that does NOT have a `.claude/skills/domain-steward/`, Phase 7 dispatch will fail to load this skill — the council ships a verdict without spine reconciliation. The Phase 7 sub-agent now guards against this (uses `$(git rev-parse --show-toplevel)/.claude/skills/domain-steward/SKILL.md` + stops if absent), but the absent state is silent for the user.

**Recommended mitigation:** if Pontus starts using run-council in another project that should have domain-spine discipline, copy this skill there as project-local OR promote both skills to a shared location. Until then, only this repo gets the full council ↔ spine bridge.
