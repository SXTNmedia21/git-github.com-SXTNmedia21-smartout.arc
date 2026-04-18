---
name: Audit Inflation Pattern (verified recurrence)
description: Grep-based site inventory in migration briefings inflates scope AND misses semantic integrity breaches. Verified twice now.
type: feedback
---

# Audit Inflation Pattern

**Rule:** When briefing a migration, refactor, or cleanup based on grep counts, ALWAYS pair with a code-trace verification pass BEFORE producing the plan. Grep tells you where the string appears; it does not tell you whether the logic is correct, whether the call sites are what you think they are, or whether there are unrelated active bugs in those sites.

**Why:** Two verified instances of this pattern producing plans with false claims:

1. **Web Performance Council (2026-04-16)** — 4 false claims caught by Phase 2.5 + Supervisor code-trace.
2. **Gate-Client Migration Wave 2 Council (2026-04-18)** — Phase 3 briefing mislabeled TanStack `useMutation` as raw-async (wrong for 2 of 3 files), missed live ADR-0091 violation in `shift-lifecycle/tools.ts:177-181`, missed season telemetry bug (`'button clicked'` instead of registered `'season created'`), missed D2 orphan in `contract-intake/tools.ts`, and under-appreciated optimistic cache staleness semantics.

In both cases, Supervisor + Agent Coord produced verified code-trace findings that reversed the Chair's initial plan.

**How to apply:**

- Before approving any plan that enumerates "N sites to migrate," require the briefing to show *actual code snippets* from each site (not just file paths)
- Require explicit classification of the mutation pattern per site (raw-async / TanStack / Server Action / capability tool)
- Require a telemetry-current-state check: what event does the site emit today? Is that event in `registry.ts`? Does it route per `emit.ts`?
- Require an ADR-compliance pre-check: does the existing code in each site comply with the ADRs the migration invokes?
- Three red flags that the briefing is grep-inflated: (a) round numbers like "5 sites" without snippets, (b) pattern classification without file-by-file breakdown, (c) silence on the current telemetry state of the sites

**Counter-pattern that worked:** Supervisor's Phase 3 review cited line numbers, quoted actual code, named the registered event that should be used, and distinguished between pattern families. That's the quality bar.
