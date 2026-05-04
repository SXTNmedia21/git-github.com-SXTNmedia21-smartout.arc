---
name: Audit Inflation Pattern (verified recurrence — 4th occurrence 2026-04-22)
description: Grep-based site inventory in migration briefings inflates scope AND misses semantic integrity breaches. Verified four times now. Phase 2.5 fact-check is mandatory for count-based briefings.
type: feedback
---

# Audit Inflation Pattern

**Rule:** When briefing a migration, refactor, cleanup, or remediation based on grep counts ("N sites to migrate", "X events without producers", "Y CORS wildcards"), ALWAYS pair with a code-trace verification pass BEFORE producing the plan. Grep tells you where a string appears; it does not tell you whether the logic is correct, whether the call sites are what you think they are, whether there are unrelated active bugs, or whether the absence of a string means absence of the behavior (e.g. Edge Functions can write to telemetry tables without calling `emit()`).

**Why:** Four verified instances of this pattern producing plans with false claims:

1. **Web Performance Council (2026-04-16)** — 4 false claims caught by Phase 2.5 + Supervisor code-trace.
2. **Gate-Client Migration Wave 2 Council (2026-04-18)** — Phase 3 briefing mislabeled TanStack `useMutation` as raw-async (wrong for 2 of 3 files), missed live ADR-0091 violation in `shift-lifecycle/tools.ts:177-181`, missed season telemetry bug (`'button clicked'` instead of registered `'season created'`), missed D2 orphan in `contract-intake/tools.ts`, and under-appreciated optimistic cache staleness semantics.
3. **Year Wheel Redesign Council (2026-04-20)** — Phase 2.5 caught 3 false claims in same-session-written spec: dot-convention, hook signature, Overview-tab header location.
4. **Auth & Invitation Wave H Council (2026-04-22)** — Phase 2.5 + Supervisor + Agent-Coord INDEPENDENTLY proved briefing's central claim FALSE. Briefing said "0 emit sites, L-0083 4th occurrence". Code truth: 13 emit sites = 6 app-side `emit()` + 4 Edge direct-inserts to `activity_trail` + 3 Server Actions. Briefing missed Edge direct-insert pattern entirely (Deno can't import `packages/notifications/`, verified via deno.json scan). Real issues were different: engine_event parity gap on 5 of 9 events, fail-open `.catch` swallows on `emit()`, ADR-0045 silent violation in `create-invitation`. **My Phase 3 review accepted the false premise** and had to be reframed in Phase 5 synthesis.

In ALL FOUR cases, Supervisor + Agent Coord + Phase 2.5 produced verified code-trace findings that reversed or substantially reframed the Chair's initial plan.

**The Wave H lesson is the sharpest:** when "absence of X" is a load-bearing claim, the audit must verify with the *positive* test (does the behavior happen via a different mechanism?) not just the *negative* grep (is the string missing?). Edge Functions writing directly to `activity_trail` look like "0 emit sites" to a grep but are actually full producers via a different runtime path.

**How to apply:**

- Before approving any plan that enumerates "N sites to migrate," require the briefing to show *actual code snippets* from each site (not just file paths)
- Require explicit classification of the mutation pattern per site (raw-async / TanStack / Server Action / capability tool)
- Require a telemetry-current-state check: what event does the site emit today? Is that event in `registry.ts`? Does it route per `emit.ts`?
- Require an ADR-compliance pre-check: does the existing code in each site comply with the ADRs the migration invokes?
- Four red flags that the briefing is grep-inflated: (a) round numbers like "5 sites" without snippets, (b) pattern classification without file-by-file breakdown, (c) silence on the current telemetry state of the sites, (d) "absence of X" claims based on negative grep when the codebase has multi-runtime paths (Node + Deno) where one can bypass the canonical mechanism
- For any council whose briefing rests on count-of-N claims, **Phase 2.5 fact-check is mandatory** — not optional

**Counter-pattern that worked:** Supervisor's Phase 3 review cited line numbers, quoted actual code, named the registered event that should be used, and distinguished between pattern families. Wave H's Phase 2.5 verified by reading `deno.json` to prove import-graph reality. That's the quality bar.
