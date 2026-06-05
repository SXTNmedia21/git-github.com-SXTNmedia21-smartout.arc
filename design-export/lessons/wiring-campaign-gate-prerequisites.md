---
topic: wiring-campaign-gate-prerequisites
status: active
updated: 2026-05-31T22:30:00Z
created: 2026-05-31T13:50:56Z
supersedes:
---

# Decision lesson — wiring-campaign-gate-prerequisites

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Before any "wire-a-redesign-to-an-existing-backend" campaign runs under full-strict anti-fabrication gates, THREE prerequisites must be encoded as hard gates in the campaign spec — otherwise the gates are theater and agents can fake-finish:

1. **Register telemetry events FIRST — but reconcile to ONE registry before you do.** Every design mutation's event must exist in the canonical mutation-event registry before its domain sortie starts. PRE-STEP: verify there is a _single_ authoritative registry. A codebase can carry two diverged event registries (e.g. a small `MUTATION_EVENTS` list + a large `EVENT_ROUTING` map in a different package) where runtime routes through one but a spec naively enforces against the other — "register first" then enforces the wrong invariant and the gate passes on the wrong file. Declare the authoritative file and collapse/reconcile the duplicates FIRST. If the registry is stale or split, the interactive_contract + telemetry gate cannot verify a button actually fires anything → phantom telemetry passes (a button looks wired but isn't).
2. **Lint for direct/ungated writes must be `error`, not `warn` — but MEASURE before promising "0 errors".** A `warn`-level "no-direct-supabase-write" rule with live offenders means agents copy ungated writes and the no-mock/gate-client invariant is theater. Bump to `error` AND pre-clean known offenders. **Caveat (measured, not assumed):** "bump to error → 0 violations" can hide a huge legacy migration — a real count found **589** violations behind a spec that said "fix 3 offenders." Run the linter and COUNT the specific rule before committing to a "0 errors" DoD. The realistic scope is: rule = `error` for NEW/ported code paths (so new wiring can't add ungated writes) + clean the hot-path offenders; legacy stays `warn` with tracking. Don't boil the legacy ocean — gate new code, don't retro-fix the whole app.
3. **Seed-coverage is a hard pre-gate for e2e-against-live-seed.** A domain whose primary tables have zero seed rows is e2e-BLOCKED — the gate is permanently red, so the agent is pressured to claim "done" falsely. Land a Phase-0 seed-expansion PR for blocked/thin domains BEFORE their sorties; sequence rich/seeded domains first while the seed PR lands in parallel.

Corollary: sub-features with NO backend at all (a UI control whose table/column/cron does not exist) must be descoped or migrated up front in the spec — never discovered mid-sortie, where the agent invents the missing backend.

## Why

A plan-vs-reality verification (system-steward over the Smartout Nordic-Split redesign, 2026-05-31) proved that the anti-fabrication gates only bind if their backing machinery exists: telemetry gate needs a current event registry; no-mock gate needs lint-as-error; e2e-against-seed needs seed rows. Each missing piece is exactly where a build agent is _forced_ to fabricate or leave wiring unfinished — the failure mode the whole harness exists to prevent. The verification also showed why a static doc-vs-doc pass is insufficient: it wrongly reported tables missing/deferred that actually existed and were seeded. Ground campaign specs in a code+schema verification (migrations + seed SQL + actual hooks), not in cross-referenced prose. See [[redesign-wiring-pipeline]] for the ordering this plugs into.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T13:50:56Z — initial: register-telemetry-first + lint-as-error + seed-as-hard-pre-gate are the three prerequisites that make full-strict anti-fabrication gates real instead of theater; verified by system-steward plan-vs-reality pass.
- 2026-05-31T17:40:00Z — measured F0.3 scope: 589 `no-direct-supabase-write` violations in apps/web, not the "3 offenders" the spec implied. A "0 errors" DoD over legacy = a multi-week migration. Scope rule-as-error to NEW/ported code + hot-paths; legacy stays warn. Measure before promising "0".
- 2026-05-31T14:02:28Z — refined prereq #1: register-first assumes ONE registry — a council pass found a real two-registry divergence (grep-confirmed: an event present in the routing map but absent from the small mutation list). Reconcile to a single authoritative registry BEFORE enforcing register-first, or the gate validates the wrong file.
- 2026-05-31T22:30:00Z — reconfirmed (no new evidence): foreman-calibration turn re-stated the registry divergence from this canonical entry during campaign orientation — `registry.ts` = runtime source-of-truth, `events.ts` divergent; reconcile-to-one before register-first. Decision block unchanged; logged per self-improve gate (re-flag ≠ new finding).
