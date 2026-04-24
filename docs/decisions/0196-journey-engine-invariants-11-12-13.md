---
title: "Journey Engine Invariants 11 / 12 / 13"
id: ADR-0196
status: proposed
layer: decision
created: 2026-04-23
updated: 2026-04-23
module: journey-engine
tags: [invariant, campaign, close-feature, phantom, gate-action, trust-gate]
---

<!-- 2026-04-23: ADR-0201 §D4 clarifies Invariant 13 applies system-wide (read tools exempt). See §Clarification at end. -->


# ADR-0196: Journey Engine Invariants 11 / 12 / 13

## Context and Problem Statement

Campaign `journey-engine` claimed M1–M3.5 complete with 7/7 Trust-Gate unblocks closed. Phase 3 council code-trace (2026-04-23) revealed the claim was false: 2 of 4 capabilities (`publish_mission`, `publish_guide`) are skeleton phantoms that emit success events without producing artefacts. L-0118 was violated inside the campaign that created it. The existing 10 Campaign Invariants in `CLAUDE.md` did not prevent this — they focus on file paths, imports, and grep gates but do not require a capability to actually do what it claims.

Three new invariants are required to prevent recurrence.

## Decision Drivers

- L-0094 5th occurrence + L-0118 spirit-violation (2026-04-23) — phantom bodies ship past all existing gates.
- ADR-0099 (gate_action mandatory) is under-enforced: 2 of 4 journey capabilities do not call it.
- Campaign status claims in CAMPAIGN-journey-engine.md and CLAUDE.md are self-written and unfalsifiable by CI.

## Considered Options

1. **Option A — Add as free-form prose in CLAUDE.md.** Quick, low friction; relies on reader discipline.
2. **Option B — Add as enforceable grep gates in `close-feature-journey-guardian.sh`.** Programmatic; some invariants don't lend themselves to grep alone.
3. **Option C — Hybrid: invariants in CLAUDE.md prose + matching close-feature gates where grep-able + CI test for the rest.** Every invariant has a mechanical enforcement path.

## Decision Outcome

Chosen option: **"Option C — Hybrid"**.

## Rules & Consequences

### Rules — three invariants added to `CLAUDE.md §Campaign Invariants`

**Invariant 11 — No phantom capabilities.**
A capability tool that emits `run_started` (or any "work has begun" telemetry) MUST produce its declared domain artefact in the same execute() call, OR return `{ok:false, error:'not_implemented'}` WITHOUT emitting `run_started`. Forbidden shape: `emit("journey run_started") → return {ok:true, note:"…lands in M_"}`.

*Enforcement:* `close-feature-journey-guardian.sh` gate greps `packages/ai/src/capabilities/journey/tools.ts` for the pattern (`emit.*run_started` near `return.*ok:.?true.*note.*skeleton|lands in M`). Any match blocks merge. Second enforcement: E2E test per capability must assert the artefact exists post-call (per L-0118, strengthened per L-0125).

**Invariant 12 — Falsifiable campaign status claims.**
Every milestone completion claim in `docs/plans/CAMPAIGN-journey-engine.md` or `CLAUDE.md` must reference a specific grep / SQL / test that, when run, returns a deterministic pass/fail. "M1 complete" is not a claim; "M1 complete — `pnpm test -F @smartout/journey-ir` passes + 4 rows in engine_authority_config for workspace X + all 4 capabilities' execute() bodies contain a DB write" is a claim.

*Enforcement:* `close-feature-journey-guardian.sh` rejects any change to the campaign doc that adds a new "complete" row without a matching `verify:` block with the command that proves it.

**Invariant 13 — Every mutation capability calls `callGateAction`.**
Every journey capability tool whose body writes to any DB table MUST call `callGateAction` before the write, regardless of authority default level (`suggest` / `autonomous`). ADR-0099 is reinforced here.

*Enforcement:* `close-feature-journey-guardian.sh` gate greps `packages/ai/src/capabilities/journey/tools.ts` for each tool's `execute` function. If the function contains `supabase.from(...).insert(...)` OR `supabase.from(...).update(...)` OR `supabase.from(...).delete(...)`, it MUST contain `callGateAction(`. Missing match blocks merge.

### Consequences

- **Good, because:** Phantom capabilities cannot ship.
- **Good, because:** Status claims become auditable — a campaign doc that says "green" must have a `verify:` block that proves it.
- **Good, because:** ADR-0099 has mechanical enforcement beyond human discipline.
- **Bad, because:** grep-based gates have false positives (comments, test stubs). Mitigate with clear "// noqa: invariant-N" escape hatch for intentional exceptions.
- **Agent Impact:** Build agents MUST implement capability bodies with real DB writes before emitting success. Documentation agents MUST attach `verify:` blocks when marking milestones complete.

## References

- ADR-0099 (gate_action mandatory)
- ADR-0173 (four journey capabilities)
- ADR-0197 (phantom contracts — promotes L-0094)
- L-0118 (every capability tool requires E2E Trust Gate test)
- L-0124, L-0125 (phantom body + test spirit vs letter, same council)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23
- `scripts/close-feature-journey-guardian.sh`
- `CLAUDE.md` §Campaign Invariants

---

> After writing: register in `docs/decisions/0000-decision-log.md` and add the three invariants to `CLAUDE.md §Campaign Invariants` in the same commit.

## Clarification — Invariant 13 applies system-wide, read tools exempt (2026-04-23)

This clarification does **not** modify the original Invariant 13 text above. It codifies the scope that has emerged from sibling-campaign precedent and from the 2026-04-23 campaign/year-wheel M3 council (ADR-0201 §D4 decision).

### Scope

Invariant 13 was drafted with journey-engine capability tools in mind ("Every journey capability tool whose body writes to any DB table MUST call `callGateAction` before the write"). Sibling campaigns have since adopted the same rule for their own capability namespaces, consistently applying one shared carve-out: **read-only tools skip `gateAction`**. Invariant 13 is therefore a system-wide rule, not a journey-specific rule.

### Precedent — read-only tools skip gateAction

- **Schedule** — 5 read tools (`getSchedule`, `getShiftsInRange`, `getShiftDetails`, `getActiveEmployees`, `listEmployeeShifts` in `packages/ai/src/tools/schedule/`): 0 `gateAction` calls. All 5 are single-shot `.select()` queries with explicit `workspace_id` filter.
- **Helpdesk_query** — 2 read tools (`searchQueries`, `getQueryDetails` in `packages/ai/src/tools/helpdesk_query/`): 0 `gateAction` calls. Same shape: `.select()` queries with explicit `workspace_id` filter.
- **Season (ADR-0201 §D4)** — 5 tools total; 2 read tools (`getReadiness`, `learnFactors`) skip `gateAction` explicitly. The other 3 (`createSeason`, `setRevenue`, `savePlaybook`) call `gateAction` before their first `.insert(...)` / `.update(...)`. Pattern matches schedule + helpdesk_query exactly.

### Codified rule

A capability tool's `execute()` body is classified as:

- **Mutation** — contains `supabase.from(...).insert(...)`, `.update(...)`, `.delete(...)`, or `supabase.rpc(...)` where the RPC has known write effects (e.g., `activate_season`). MUST call `gateAction(...)` before the first mutation statement. Enforced by `close-feature-journey-guardian.sh` grep gate (original Invariant 13 enforcement, widened to cover all capability tool namespaces).
- **Read-only** — contains only `.select(...)` / `.rpc(...)` where the RPC is SECURITY DEFINER and read-only. Declares `readOnly: true` in its `SmartoutTool` definition. MAY skip `gateAction`. Still subject to the RLS + explicit `workspace_id` filter requirement (no bypass of tenant isolation).

### What changes in enforcement

- `close-feature-journey-guardian.sh` grep gate extends from `packages/ai/src/capabilities/journey/tools.ts` to the sibling-campaign tool directories using the same rule. Read-tool exemption is enforced by requiring a matching `readOnly: true` declaration OR zero mutation operations in the tool body (whichever is cheaper to check mechanically).
- Phase 2.5 briefing fact-check gains a step: for any capability plan listing N tools, classify each as mutation/read-only and confirm every mutation carries a `gateAction` citation.

### Cross-references

- **ADR-0201 §D4** — makes the decision explicitly for `season.*` capabilities ("gateAction only on mutations").
- **ADR-0196 original body** — Invariant 13 rule (unchanged above).
- **ADR-0099** — `gate_action` default-allow CVE class; the base authority contract that Invariant 13 reinforces.
- **Schedule tools** (`packages/ai/src/tools/schedule/`) — 5 read tools, precedent #1.
- **Helpdesk_query tools** (`packages/ai/src/tools/helpdesk_query/`) — 2 read tools, precedent #2.
- **Season tools** (`packages/ai/src/tools/season/`) — ADR-0201 precedent #3 (2 read, 3 mutation).

### Status of this clarification

This is an **amendment-by-reference**, not a rewrite. Invariant 13's original text stays — its mutation-focused phrasing already permits read-only exemption by scope (it quantifies over "capability tool whose body writes to any DB table", which excludes read-only tools by construction). This section merely makes the read-only exemption explicit and points at the three precedents that confirm it.

