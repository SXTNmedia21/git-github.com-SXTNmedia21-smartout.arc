---
id: L-0229
title: "Capability count source-of-truth drift across plans, audits, skills, system-map"
type: learning
status: accepted
created: 2026-05-08
updated: 2026-05-08
discovered_in: council 2026-05-08 R2 verify-5-plans
discovered_by: system-agent-coordinator (code-trace)
tags: [governance, capability-registry, doc-drift, council-finding]
related: [L-0042, L-0150, L-0176]
---

# L-0229: Capability Count Source-of-Truth Drift

## Pattern

Four different capability counts circulated across documentation surfaces while real registry has 29:

| Surface | Claimed count | Real (2026-05-08) |
|---|---|---|
| `~/.claude/skills/smartout-agent-dev/SKILL.md` | 8 (table rows; many marked "Planned") | 29 |
| `docs/audits/2026-05-08-botsson-harness-audit.md` | 16 | 29 |
| `docs/superpowers/plans/2026-05-08-doc-and-agent-instruction-consolidation.md` | 16 → 17 (post-onboarding) | 29 |
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` L4 section | 15 (header) / ~19 (listed) | 29 |
| `packages/ai/src/capabilities/registry.ts` | (truth) | 29 |

Off-by 12-13 across all doc surfaces. Audit and plan author repeated the previous-stale-number ("16 capabilities") without re-grepping.

Real list (verified via `grep -c "Capability,$" packages/ai/src/capabilities/registry.ts`):
profile, ui, guardian, schedule, operations, communication, contract, contract_intake, shift_swap, operations_intelligence, training, shift_lifecycle, governance, billing_query, memory, helpdesk_query, kb_query, journey, journey_authoring, season, availability, tips, payroll, mission, personal, legal, business_intelligence, engine_world, onboarding.

## Rule

Plans, audits, and skills that cite capability count MUST run a grep at write-time. NEVER hardcode a number copied from another doc.

```bash
grep -c "Capability,$" packages/ai/src/capabilities/registry.ts
```

If the doc already exists with a hardcoded count, replace with the grep command and the date verified, not just the new number.

## Why

Capability additions land frequently (~monthly per ADR cadence). Onboarding capability shipped via PR #342 (2026-05-04). Engine_world capability shipped 2026-05-06 (ADR-0281). Two capabilities added in 5 days. A hardcoded "16" goes stale within a week of writing.

The drift compounds because each new surface (audit → plan → skill → system-map) copies from the previous one without re-verification. By 2026-05-08 the original "16" had propagated to four downstream surfaces while the real number had grown to 29.

## How to apply

**Phase 2.5 council fact-check** — when reviewing a plan that cites capability count, treat the number as a CLAIM. Verify with grep before approving. Flag mismatches as fact-check finding, not as plan-author judgment call.

**Heartbeat doc-drift-check.sh** — added Check 6 in council 2026-05-08 R2 doc-consolidation plan: compares skill-file capability count against `registry.ts` grep, alerts on drift.

**Plan template** — capability counts in plans should be written as:
```
Capability count (verified 2026-05-08 via grep): 29
```
…not just `Capability count: 29`. The verified-date forces re-verification on next plan touch.

## Precedent

This is the 1st council-finding occurrence (2026-05-08 R2). Per `run-council` skill protocol: 3 occurrences → promote to SKILL.md hard rule. After 3rd find, expect promotion to mandatory grep-verify in Phase 2.5 fact-check.

Related learnings:
- L-0042 — migration timestamp ordering (also a "verify against current state" pattern)
- L-0150 — system-map 7d-gate (drift-detection pattern)
- L-0176 — body-trace not docstring-trace (same anti-pattern: trust claims without verification)
