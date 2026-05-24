---
title: "Declared Contract Fulfillment Rule"
id: ADR-0421
status: accepted
layer: decision
created: 2026-05-25
updated: 2026-05-25
---

# ADR-0421: Declared Contract Fulfillment Rule

## Context and Problem Statement

11-agent restaurant-week + hotel + festival sim (council 2026-05-25) surfaced a recurring
meta-pattern across the codebase: **declared contract surfaces ship without paired
implementation**. Five surface manifestations all share the same root.

| Sub-pattern | Example |
|---|---|
| A — UI skeleton with `not_implemented` body | `packages/ai/src/capabilities/tips/tools.ts:10` — all 4 LLM-callable tools return `{ ok: false, error: "not_implemented" }` |
| B — Component built but never mounted | `AnnouncementKindPicker.tsx` exists, no parent imports |
| C — Capability tool + production EF diverge | `compile-day-brief.ts` capability vs `supabase/functions/ops-day-brief/index.ts` — 0 cross-references, duplicated logic |
| D — Enum + DB column without BFF route | `payroll.period_status='approved'` + `approved_by` exist, no BFF route to advance |
| E — Migration deprecates table but writers remain | `20260519110000_deprecate_help_request_table.sql` says "all dashboard write paths removed" — `use-help-requests.ts:49-60` still writes |
| F — Docstring claims ADR compliance, body doesn't (L-0176) | Capability tool docstring states "uses gatedMutation" with direct write in body |
| G — Registry entry without authority seed (L-0354 / ADR-0413) | `CapabilityName` union has 13 entries with no `capability_default_registry` row |

All seven sub-patterns produce the same failure mode: a downstream consumer (user, LLM,
test, scheduled job) interacts with the declared surface and receives a silent no-op or
error. None are catchable at TypeScript compile time.

## Decision Drivers

- Surface convergence: 5 independent council agents flagged variants of this pattern in one sim
- Sub-pattern E was the root cause behind baseline BUG-20 (helpdesk SLA 0/4 pass)
- ADR-0192 invariant (capability registration completeness) is one slice of this rule
- L-0176, L-0177, L-0292 are all surface manifestations
- A single audit rule cannot catch all 7 sub-patterns — need a multi-axis enforcement layer

## Considered Options

1. **A** — Document the pattern, rely on convention discipline
2. **B** — Ship one ESLint rule per sub-pattern (7 separate rules)
3. **C** — Build a unified "declared contract fulfillment" specialist in `adr-contract-audit`
   that scans all 7 axes in one pass

## Decision Outcome

**Chosen: Option C** — single specialist in `adr-contract-audit` with 7 sub-checks. Each
sub-check has a focused detection rule:

- **C-A** — every LLM-callable tool body must return real data OR an explicit user-facing
  error string (`"X is not yet available — coming Q3"`); `not_implemented` literal is BANNED
  per [[ADR-0422]]
- **C-B** — every component file under `apps/web/src/components/**` and `apps/web/src/app/**`
  must be imported by at least one parent OR carry `// scaffold` directive
- **C-C** — for every Edge Function under `supabase/functions/` that duplicates logic with a
  `packages/ai/src/capabilities/` tool, ship a `// canonical: capability` reference comment
  pointing at the shared module
- **C-D** — every enum value referenced in DB schema must have either a BFF route OR a
  Server Action that writes it (grep enum value across `apps/web/src/app/api` + Server Actions)
- **C-E** — every migration with `COMMENT ON TABLE ... DEPRECATED` must trigger a
  cross-codebase grep for table reads/writes; non-zero = blocking
- **C-F** — capability tool docstring claims about ADR compliance MUST match body shape
  (L-0176 enforcement)
- **C-G** — every entry in `CapabilityName` union MUST have a row in
  `capability_default_registry` ([[ADR-0413]] invariant — extend with pgTAP test)

## Rules & Consequences

- **Good:** structural CVE class (silent default-allow, silent no-op, silent error) becomes
  pre-merge-detectable
- **Good:** 6 prior learnings (L-0066, L-0097, L-0176, L-0177, L-0287, L-0292) all unify
  under one enforcement umbrella
- **Bad:** 7-axis specialist is heavier than a single ESLint rule — initial implementation
  effort ~1 sortie
- **Bad:** sub-check C-B has high false-positive risk for intentional placeholders — needs
  scaffold directive convention

## Agent Impact

When implementing any of: a new capability tool, a new UI component, a new EF, a new enum
value, a new ADR claim, a migration that deprecates a table — verify all 7 sub-checks pass
locally before opening PR. The `adr-contract-audit` specialist will run automatically on
diffs touching the affected glob patterns.

## References

- 11-agent restaurant-week sim council 2026-05-25 (chair Phase 5 synthesis)
- [[ADR-0413]] — capability_default_registry single source of truth (sub-check C-G)
- [[ADR-0422]] — `not_implemented` antipattern ban (sub-check C-A)
- L-0176 — docstring drift (sub-check C-F)
- L-0177 — silent fallback (related: read-side bleed via [[ADR-0423]])
- L-0353 — Contract-Promise-Without-Fulfillment meta-pattern (this ADR's underlying learning)
