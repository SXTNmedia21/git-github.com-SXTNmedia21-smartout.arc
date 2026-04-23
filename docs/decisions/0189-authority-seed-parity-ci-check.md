---
title: "Authority seed parity enforced via CI check"
id: ADR_0189
status: proposed
layer: decision
created: 2026-04-22
updated: 2026-04-22
---

# ADR-0189: Authority seed parity enforced via CI check

## Context and Problem Statement

Council 2 (2026-04-22) labeled this finding **CVE-class**.

`gate_action` RPC at `supabase/migrations/20260505110000_unified_authority_gate.sql:91` **default-allows** when no `engine_authority_config` row exists for the (workspace, capability) pair. Comment in the source: *"No engine_authority_config row for (workspace, capability) → allow=true (default-allow)."*

Agent-coord code-trace found only **8 `gate_action` call sites in production TypeScript**, 7 seeded, **1 missing seed**: `reconciliation.override` (used at `apps/web/src/app/dashboard/reconciliation/_actions/override-reconciliation-action.ts:68`). Every admin-override in production since that feature shipped has passed an ungated gate returning `allow=true, reason=NULL` indistinguishable from a real authorization.

Exposure inventory (all seeded unless noted):

| Call site | Capability | Seeded? |
|---|---|---|
| `signoff-session-action.ts:91` | `session.signoff` | YES |
| `signoff-session-action.ts:148` | `session.close` | YES |
| `open-session-action.ts:60` | `session.open` | YES |
| `transition-session-action.ts:77` | `session.transition` | YES |
| `manual-time-entry-action.ts:67` | `shift.manual_time_entry` | YES |
| `send-broadcast-action.ts:59` | `broadcast.send` | YES |
| `override-reconciliation-action.ts:68` | `reconciliation.override` | **NO** |
| `observer-requests/route.ts:95` | `observer_request.create` | TBD |

ADR-NEXT-02 (Council 1) proposed 3 additional capabilities (`reconciliation.submit`, `.wizard_submit_with_blocker`, `.wizard_save`) — would add 3 more default-allow holes unless policy changes.

Council 2 rejected default-DENY-all (Path A — production outage on deploy: fresh dev environments and partial-seed workspaces fail simultaneously) and default-DENY-prefix (Path B — invents governance surface; prefix list becomes a new ADR of its own).

## Decision Drivers

- **CVE closure** — the `reconciliation.override` gap makes every admin-override indistinguishable from a real authorization in production `activity_trail` rows.
- **No production outage on deploy** — default-DENY-all fails fresh dev environments and partial-seed workspaces simultaneously; default-allow must survive.
- **No new governance surface** — default-DENY-prefix requires a prefix governance list, a new ADR, and a new ownership question. Rejected on simplicity grounds.
- **Prevent regression** — a new capability added to code must ship with its seed or the PR fails. Human review alone has already missed one.
- **Visibility for CI escape** — anything that slips past CI (third-party code, hotfix, dynamic capability string) MUST surface at runtime, not sit silent.
- **Stay inside known patterns** — seed migrations follow `supabase/migrations/20260515130500_seed_session_authority.sql:57-71`; `ts-morph` is a common choice in this repo's tooling trajectory.

## Considered Options

1. **Default-DENY all (Path A)** — flip the unseeded branch to `allow=false`. Rejected — production outage on deploy; fresh dev environments and partial-seed workspaces all fail simultaneously.
2. **Default-DENY by prefix (Path B)** — deny only for capabilities under `reconciliation.*` / `session.*` / similar curated prefixes. Rejected — invents a governance surface (who owns the prefix list?) and requires its own ADR with its own ownership question.
3. **Keep default-allow; enforce seed parity at CI (Path C)** — seed the missing row atomically, then guard the invariant at CI with an AST-based parity check, plus a runtime warning for any escape.
4. **Runtime warning only, no CI** — log to `activity_trail` when default-allow fires, no CI gate. Rejected — reactive only; gap stays gap until someone reads the log line. Fails the "prevent regression" driver.

## Decision Outcome

Chosen option: **Option 3 — Keep default-allow semantics; enforce seed parity at CI.**

### Immediate remediation (atomic with this ADR)

Seed migration `202605xxxxxx_seed_reconciliation_authority.sql` (timestamp > current tip `20260515140200`) adds:

- `reconciliation.override` — level `confirm`, min_role `admin`, for all workspaces (script follows the pattern at `supabase/migrations/20260515130500_seed_session_authority.sql:57-71`).
- `reconciliation.submit`, `reconciliation.wizard_submit_with_blocker`, `reconciliation.wizard_save` — if ADR-NEXT-02 lands in the same PR.

### CI seed-parity gate

New CI workflow `.github/workflows/authority-seed-parity.yml` (or an extension of an existing workflow) runs on every PR:

1. Extracts every string literal `capability: "x.y"` from `gate_action(...)` / `gateAction({capability: ...})` call sites using a TypeScript AST parser (`ts-morph` or equivalent — **NOT regex**; regex fails on template literals and computed properties).
2. Dynamic strings (variables, expressions) are either:
   - Annotated with `/* @authority-gate-ungated */` at the call site (explicit opt-out, logged for periodic review), OR
   - Fail the CI check.
3. Extracts every `INSERT INTO engine_authority_config` capability value from `supabase/migrations/*.sql`.
4. Diffs: every literal MUST have a matching seed. Missing seed = CI fail.

Script location: `scripts/authority-seed-parity.ts` (or similar).

### Compensating control (runtime)

Amend `gate_action`: when `v_level IS NULL` (default-allow branch hit), INSERT an `activity_trail` warning:

```json
{
  "event": "gate.unseeded_capability_invoked",
  "capability": "<name>",
  "workspace_id": "<id>",
  "actor_profile_id": "<id>",
  "severity": "warning"
}
```

Makes the gap *visible* in production for any capability that slipped past CI (e.g., third-party code, hotfix ungated by mistake).

### Gate capability as typed union (optional follow-up)

Convert the gate capability argument from `string` to `AuthorityCapability` TypeScript literal union generated from migration seeds. Lets TS compiler + CI enforce parity at build-time instead of CI-only. Not a blocker for this ADR; tracked as a Phase 2 polish item.

## Rules & Consequences

- **Good, because** it closes the `reconciliation.override` CVE immediately (atomic seed migration).
- **Good, because** the CI gate prevents regression — a new capability added to code must ship with a seed or fail the PR.
- **Good, because** no breaking semantics change — default-allow preserved for unseeded capabilities, but CI makes unseeded impossible going forward.
- **Good, because** the runtime `activity_trail` warning makes any escape from CI visible rather than silent.
- **Good, because** it stays inside known patterns — seed migration follows existing session-authority seed shape; `ts-morph` matches this repo's tooling trajectory.
- **Bad, because** it requires `ts-morph` (or equivalent) as a dev-dependency — small but new surface area.
- **Bad, because** dynamic capability strings (rare but possible — e.g., string templating) require an explicit `/* @authority-gate-ungated */` comment, and there is no way to verify those opt-outs are still safe beyond periodic review.
- **Bad, because** CI adds ~30s to PR checks.
- **Neutral:** does not affect existing seed migrations or production traffic beyond the one atomic remediation.
- **Neutral:** does not govern capability naming vocabulary — capability strings remain each domain owner's choice.
- **Agent Impact:**
  - **Seed migration:** `202605xxxxxx_seed_reconciliation_authority.sql` is the atomic closure of the `reconciliation.override` gap; cannot be skipped.
  - **`gate_action` amendment:** adds an `activity_trail` insert on the default-allow branch (`event='gate.unseeded_capability_invoked'`, `severity='warning'`).
  - **CI workflow:** `scripts/authority-seed-parity.ts` + `.github/workflows/authority-seed-parity.yml` — AST parse (ts-morph), not regex.
  - **Developer contract:** any new `gate_action`/`gateAction({capability: ...})` call ships with the matching `INSERT INTO engine_authority_config` seed in the same PR, or fails CI.
  - **Escape hatch:** dynamic capability strings require `/* @authority-gate-ungated */` at the call site; reviewer checks on each PR.
  - **ADR-0099 amendment:** §5 is rewritten so the default-allow branch is documented as temporary-by-CI-gate, not policy. New clause: *"Every capability literal passed to `gate_action` must have a matching seed migration, enforced by CI."*
  - **ADR-0091 amendment:** adds a clause requiring seed-exists verification on any new write-path capability introduced under the cascade governance gate.
  - **Smartout-database-guide skill:** adds "every capability string in a `gate_action` call has a matching seed row" as a DB-authoring rule.

## References

- **Amends** ADR-0099 (Unified Authority Gate) — §5 rewrite; default-allow documented as temporary-by-CI-gate.
- **Amends** ADR-0091 (Governance Gate Placement — Postgres RPC) — adds seed-exists clause for new write-path capabilities.
- **Related:** ADR-0114 (Server Actions as Canonical Mutation Primitive) — Server Actions calling `gateAction` are the primary CI target.
- **Precedent:** 2026-04-18 gate-client Wave 2 council — "three concurrent write paths can silently diverge in authority + telemetry"; same class of bug (appearance of gating without actual gating).
- **Precedent:** ADR-0187 (Session state-change events have exactly one emit source) — same pattern of closing a silent-drift failure mode on a different axis.
- **Files touched by implementation PR:**
  - `supabase/migrations/20260505110000_unified_authority_gate.sql` (amended — `activity_trail` warning on default-allow branch)
  - `supabase/migrations/202605xxxxxx_seed_reconciliation_authority.sql` (new — atomic remediation)
  - `scripts/authority-seed-parity.ts` (new)
  - `.github/workflows/authority-seed-parity.yml` (new or extended)
  - `apps/web/src/app/dashboard/reconciliation/_actions/override-reconciliation-action.ts:68` (now passes CI — was silent hole)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
