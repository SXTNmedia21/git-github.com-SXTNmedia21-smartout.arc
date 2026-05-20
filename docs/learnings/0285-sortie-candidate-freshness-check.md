---
title: "Sortie plan must verify candidate is still open before nomination"
id: L_0285
status: proposed
layer: learning
created: 2026-05-16
updated: 2026-05-16
---

# L-0285 — Sortie candidate freshness check before nomination

## Pattern

Sortie planning sessions nominate candidates from audit findings or memory without first checking whether the candidate has already been addressed in a recent commit. This wastes dispatch capacity and produces incorrect sequencing plans.

## This occurrence — Payroll Sortie-Triplet 2026-05-16

**Original S3 candidate:** "F-CL-13 feriepenger_basis fix" — nominated for parallel work alongside S1 (label sweep) and S2 (mobile UX polish).

**Reality:** F-CL-13 CLOSED 2026-05-13 by commit `58d40f500`. The canonical helper was shipped in that commit. Supervisor (opus) verified via `git log --all --grep="F-CL-13"` during Phase 2.5 fact-check.

**Second missed candidate in same session:** Phase 5 PII reveal was also nominated as an S3 option. Also already shipped 2026-05-08.

Re-nominating a closed candidate = wasted Phase 3 dispatch (agent time), invalid sequencing plan (S3 dependencies based on false premise), and potential duplicate work if S3 had shipped before discovery.

## Rule

Before nominating any sortie candidate from audit findings or memory, run the following verification:

```bash
# Check recent commits that may have closed this candidate
git log --all --grep="<candidate-id>" --since="30 days ago" --oneline

# Check plan status if a PLAN file exists
grep -l "<candidate-id>" docs/plans/PLAN-*.md | xargs grep "status:"
```

Additionally inspect any relevant `PLAN-*.md` frontmatter `status:` field. Any `status: done` = candidate INVALID.

**This is a Phase 1 INTAKE hardening**, not Phase 2.5 fact-check. Running it before briefing assembly is faster than catching it at Phase 2.5 (saves full briefing preparation cycle).

## Detection heuristic

A candidate is stale if ANY of these are true:
- `git log --all --grep="<id>" --since="30 days ago"` returns ≥ 1 hit
- A linked PLAN file has `status: done`
- A linked ADR has `status: accepted` and the accepting commit is within 30 days
- The capability or tool the candidate targets no longer exists under the referenced name

## Sibling

- L-0209 (ADR-Renumber-Pattern) — same class of "verify before allocating/nominating", applied to ADR ID allocation instead of sortie candidates.
- L-0239 (briefing trust gate self-test) — similar class of "claims about prior state require git-trace verification".
