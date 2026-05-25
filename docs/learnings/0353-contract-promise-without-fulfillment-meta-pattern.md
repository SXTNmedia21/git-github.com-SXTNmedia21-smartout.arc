---
title: "Pattern 1 = Contract-Promise-Without-Fulfillment Meta-Pattern"
id: L-0353
status: accepted
layer: learning
created: 2026-05-25
updated: 2026-05-25
---

# L-0353: Contract-Promise-Without-Fulfillment Meta-Pattern

## What happened

11-agent restaurant-week + hotel + festival sim council 2026-05-25. The synthesizer
identified Pattern 1 ("Built but disconnected") as cross-cutting across 5 independent agent
findings:

| Surface | Manifestation |
|---|---|
| `useGPSGuard` (mobile) | Hook bodied at `useGPSGuard.ts:75-166`, never invoked by `usePunch` |
| `tips` capability | All 4 LLM-callable tools at `tips/tools.ts:46-118` return `not_implemented` |
| `AnnouncementKindPicker.tsx` | Component exists, never mounted by parent |
| `compile-day-brief` capability | Tool body real, but `supabase/functions/ops-day-brief/index.ts` (157 lines, 0 cross-references) duplicates logic instead of calling the tool |
| `payroll.period_status='approved'` | Enum value + `approved_by` column exist, no BFF route to advance from `locked → approved` |
| `help_request` table | `20260519110000` migration says "all dashboard writes removed", `use-help-requests.ts:49-60` still writes |

Supervisor decomposed Pattern 1 into 5 sub-patterns (A skeleton, B forgot-to-mount, C EF/
capability duplication, D enum+UI without BFF, E deprecated-table-writes).

Steward identified the same pattern from the docstring-vs-body axis (L-0176 family).

System-Agent-Coordinator identified the same pattern from the registry-completeness axis
(`CapabilityName` union vs `capability_default_registry`, formalized in [[ADR-0413]]).

## Why it matters

All three reviewer framings are slices of one meta-pattern: **declared contract surface
ships without paired implementation**. The contract surfaces vary (UI element, docstring
claim, registry entry, schema column, ADR assertion, migration deprecation comment), but
the failure mode is identical: a downstream consumer (user, LLM, test, scheduled job)
interacts with the declared surface and gets a silent no-op or error.

Pattern recurrence:
- L-0066 — capability registered without authority seed → silent default-allow
- L-0097 — same class, contract authority seed
- L-0176 — docstring claims compliance, body doesn't
- L-0177 — silent fallback on workspace_id resolution
- L-0287 — phantom contract avoidance (the carve-out — intentional non-fulfillment OK
  when documented)
- L-0292 — capability without intent-classifier enum
- L-0353 (this) — the meta-pattern naming

Six prior learnings + this council's 5 sub-patterns → meta-pattern is structural, not
anecdotal.

## Lesson learned

**One specialist can detect 7 surface manifestations of this meta-pattern if it scans all
axes in one pass.** Drafted as [[ADR-0421]] — Declared Contract Fulfillment Rule. The
specialist's 7 sub-checks map 1:1 to the surface manifestations:

| Sub-check | Detects |
|---|---|
| C-A | LLM-callable tool body returning `not_implemented` |
| C-B | Component file with zero parent imports |
| C-C | EF duplicating capability logic (missing `// canonical: capability` reference) |
| C-D | Enum value referenced in schema but no BFF route or Server Action writes it |
| C-E | Migration `COMMENT ON TABLE ... DEPRECATED` with active reads/writes elsewhere |
| C-F | Docstring ADR-claim mismatching body shape (L-0176) |
| C-G | `CapabilityName` union entry without `capability_default_registry` row (ADR-0413) |

## How to apply

- **When writing any new capability tool:** verify body returns real data, OR ship explicit
  user-facing error message ([[ADR-0422]] ban on `not_implemented`)
- **When writing any new component:** verify a parent imports it before merging
- **When writing any new EF that overlaps with a capability tool:** add `// canonical:
  capability` reference comment pointing at the shared module; better: refactor EF to
  invoke the capability via [[ADR-0424]] `invoke_capability_tool` action-type
- **When adding any new enum value to DB schema:** ensure a BFF route OR Server Action
  writes it within the same sortie
- **When deprecating any table via `COMMENT ON TABLE`:** grep entire codebase for reads +
  writes; close them all in the same sortie
- **When writing any new capability:** add row to `capability_default_registry` per
  [[ADR-0413]]

## References

- 11-agent restaurant-week sim council 2026-05-25 (Phase 5 synthesis)
- [[ADR-0421]] — Declared Contract Fulfillment Rule (this learning's enforcement ADR)
- [[ADR-0422]] — `not_implemented` antipattern ban
- [[ADR-0413]] — capability_default_registry single source of truth
- L-0066, L-0097, L-0176, L-0177, L-0287, L-0292 — prior surface manifestations
