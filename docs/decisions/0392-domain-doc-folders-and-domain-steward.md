---
title: "Domain doc folders + domain-steward standard"
id: ADR_0392
status: proposed
layer: decision
created: 2026-05-22
updated: 2026-05-22
---

# ADR-0392: Domain Documentation Folders + the `domain-steward` Standard

## Context and Problem Statement

Smartout's documentation of product areas had drifted into three incompatible shapes living side by side: a flat legacy set (`docs/architecture/modules/SMARTOUT_MODULE_*`, referenced by `INDEX.md`/`BUILD_ORDER.md`), flat single files (`docs/modules/MODULE_*.md`), and a newer rich folder-per-area pattern (`docs/modules/<area>/` — daytimeline, payroll, procedure-engine). The folder pattern was the strongest but had no enforced standard: file names varied per author, built-vs-planned was a prose section in a monolith, "verified" claims were uncited, payroll docs were byte-duplicated under `design/spec/`, and 38 `Zone.Identifier` junk files plus binaries polluted the tree. Critically, the *exemplar* folder (daytimeline) was already stale within days — its `ARCHITECTURE.md` described capabilities as "(planned)" that had shipped.

We need a single, enforceable standard so each product domain has one folder that is an honest, current mirror of the codebase — the single place to look for concrete insight — and a mechanism that keeps it true rather than letting it rot.

## Decision Drivers

- One source of truth per domain; no competing or duplicated docs.
- Honest separation of *as-built* (code wins) from *aspirational* (ahead of code).
- Discipline-only conventions in Smartout drift geometrically without mechanical enforcement (ADR-0366 OKLCH stabilised only when ESLint shipped; L-0083).
- Respect existing owners: ADRs (global log), journeys (`journey-protocol`), specs/plans (superpowers workflow + git history).
- Token/time cost of verifying-against-code is real; rollout must be tierable.

## Considered Options

1. **Keep ad-hoc folders** — leave each area's docs free-form.
2. **Standard + skill only** — fixed spine maintained by a `domain-steward` skill, no mechanical gate.
3. **Standard + skill + mechanical floor** — fixed spine, `domain-steward` skill for judgment, `domain-lint` + lifecycle gates for enforcement.

## Decision Outcome

Chosen option: **Option 3**.

**Location & name.** Domain docs live at `docs/domains/<name>/`. The unit is a *domain* (bounded product area), deliberately distinct from code "module" and from `docs/engines`.

**Fixed 8-file spine** (no invented names): `README.md`, `OVERVIEW.md`, `ARCHITECTURE.md`, `DATA-MODEL.md`, `USER-FLOWS.md`, `ROADMAP.md`, `GAPS-AND-DEBT.md`, `E2E-COVERAGE.md`. `README` carries a `## Agent Guardrails` section; a CLAUDE.md is **never** placed in the doc folder (wrong cwd to auto-load — a thin pointer CLAUDE.md at the *code* root is optional).

**Two truth axes in frontmatter.** `status:` = doc lifecycle (existing repo enum). `mirror:` = code-truth (`verified|aspirational|mixed`). `last_verified:` = ISO date the verified claims were last checked vs code. Every spine file except `ROADMAP` carries `mirror` + `last_verified`.

**Boundary model (reference, don't move).**
- ADRs → referenced in `ROADMAP.md`; `ADR-DRAFT-*` may transit then graduate to `docs/decisions/`.
- Journeys → owned by `journey-protocol`; `USER-FLOWS.md` links.
- Specs / plans / handoffs → *dated raw sources*; read + reconciled vs code + referenced in `ROADMAP.md`, **never moved** into the folder.
- Only legacy *compiled* docs (`MODULE_*`, `SMARTOUT_MODULE_*`) get absorbed into the spine, then archived (`status: archived` + `superseded_by:`).

**Spec/Plan reconciliation** → each referenced spec/plan is verified against code with one outcome: **confirmed** (compiled into the verified spine), **deviation** (code differs — code wins, logged in `GAPS-AND-DEBT §4b`), or **gap** (not implemented — logged in `GAPS-AND-DEBT §3`). A "completed" plan with no matching code is a gap, not a confirmation.

**Overlap detection** → on `pre`/`update`, shared tables/components/concepts across domains are recorded as overlap edges with a `consolidate | split | keep` recommendation in `GAPS-AND-DEBT §5` + `_DASHBOARD.md`. Boundary moves are proposed, never auto-applied.

**Operating modes** (skill `domain-steward`): `pre` (define new — ask user → research/index → confirm code → generate spine → supersede old → register), `update` (reconcile vs code), `post` (close out after a sortie + auto-learn), `dryrun` (preview removals/consolidation + HIGH/MED/LOW confidence; writes nothing, never deletes).

**Enforcement.**
- **Now (this ADR):** `scripts/domain-lint.mjs` (`pnpm check:domains`) validates spine completeness, required frontmatter, `mirror`/`status` enums, ISO dates, `_DASHBOARD.md` listing, and **staleness** (a `verified` file older than `--max-stale-days`, default 45, fails). Runs in husky pre-push (`--changed` scope) and CI. Mechanical junk (`*Zone.Identifier`, binaries in docs) is flagged by the `domain-steward` Stop hook, not hand-curated.
- **Phase 2 (future, separate change):** `close-feature` gate requiring a `last_verified` bump when a sortie touched the domain's code; weekly heartbeat domain-drift check; an `adr-contract-audit` domain-drift slice.

**Status dashboard.** `docs/domains/_DASHBOARD.md` (domain × build-state × tested × `last_verified` × open gaps × overlap edges). NOT `docs/DASHBOARD.md` (git-state per ADR-0075).

**Tiered rollout.** Domains are migrated by activity/risk, not all at once. A domain may sit `draft`/unverified until reconciled — honest-partial beats false-complete. `domain-lint` ships **before** the first `pre` so no domain is born unenforced.

## Rules & Consequences

- **Good, because** one folder per domain, fixed spine, and `code-wins` verification give an honest mirror with no competing sources; `mirror`/`last_verified` make drift visible; `domain-lint` makes it mechanically enforced rather than aspirational.
- **Good, because** boundary model reuses existing owners (ADR log, journeys, superpowers specs/plans) instead of duplicating them.
- **Bad, because** per-domain verification is token/time expensive; full coverage is a multi-sortie effort. Mitigated by tiered rollout + `mirror: aspirational` honesty.
- **Bad, because** overlap detection is O(n²) by grep; acceptable at ~12 domains, revisit if it grows.
- **Agent Impact:** Use the `domain-steward` skill for any `docs/domains/*` work. Never invent spine file names, never write domain status to `docs/DASHBOARD.md`, never move specs/plans into a domain folder, never stamp `verified` without a code citation. Run `pnpm check:domains` before pushing domain-doc changes. Legacy `SMARTOUT_MODULE_*` / flat `MODULE_*.md` stay until absorbed (they are still referenced) — do not delete pre-migration.

---

> Registered in `docs/decisions/0000-decision-log.md`. Skill: `.claude/skills/domain-steward/`. Linter: `scripts/domain-lint.mjs`.
