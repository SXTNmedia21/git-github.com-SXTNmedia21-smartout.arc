---
id: ADR-0202
title: "Season Server-Action Capability Namespace"
status: accepted
created: 2026-04-23
updated: 2026-04-23
module: year-wheel
tags: [season, capability, authority, server-action, M5]
related:
  - ADR-0200  # atomic season activation RPC — seeds season.activate
  - ADR-0201  # season agent-capability five tools
  - ADR-0189  # authority seed parity CI
  - ADR-0195  # authority loader full dotted-key preservation
  - ADR-0196  # journey engine invariants 11/12/13 (phantom capability bar + gate_action)
deciders: [pontus, claude]
council_session: "2026-04-23 — campaign/year-wheel M5 cleanup sortie"
---

# ADR-0202: Season Server-Action Capability Namespace

## Status

Accepted (2026-04-23, campaign/year-wheel M5.6 doc-hygiene sortie).

## Context and Problem Statement

After M5.1 (Fjernkontroll runtime) + M5.5 (Server Action cleanup), the year-wheel campaign has three season mutation capabilities reachable only as Server Actions:

- `season.activate` — wired by ADR-0200 (`apps/web/src/app/dashboard/_actions/activate-season-action.ts`).
- `season.archive` — Server Action, manager-gated via `gate_action`.
- `season.duplicate` — Server Action, manager-gated via `gate_action`.

All three capability names were added to the `CapabilityName` union in M5.1 so `tool-selector.ts` and `gate_action` can resolve authority rows (per ADR-0195 full dotted-key preservation). However, none of the three are registered in `seasonCapability.tools` at `packages/ai/src/capabilities/season/index.ts` — they are NOT agent-callable tools.

This creates an apparent inconsistency:

- Capability key exists in `CapabilityName` union → agent-framework reads it.
- `engine_authority_config` has a seed row for it → gate_action resolves it.
- But `CapabilityDefinition.tools[]` does NOT expose it → agent cannot invoke it.

ADR-0200 declares this intent inline ("M1 does NOT expose `season.activate` as an agent capability"). ADR-0201 extends the rule to `season.archive` + `season.duplicate` by the same reasoning but does not spell it out as a namespace rule. Reviewers arriving at M6+ work need a single ADR they can cite when asked "why is `season.archive` in the union but not in `tools[]`?"

## Decision Drivers

- **Authority parity (ADR-0189).** Capability keys in the union must have authority seed rows; authority seed rows must have capability keys in the union. Both are satisfied. The agent-capability-tool registration is the third, orthogonal dimension.
- **Phantom capability bar (ADR-0196 Invariant 11).** Registering a tool in `seasonCapability.tools[]` without a complete `execute()` body is a merge blocker. If an agent tool wrapper does not yet exist, the tool must NOT be registered — even if the Server Action it would wrap is live.
- **One path per surface.** A capability accessible as BOTH a Server Action and an agent tool doubles the surface area and invites drift (see ADR-0191 on auth-passing pattern uniformity). Exposing `season.activate` via agent chat would require a new wrapping tool that also calls the `activate_season` RPC — and the rules governing that wrapper (channel restrictions, multi-turn confirmation) are a separate design discussion.
- **Namespace hygiene.** `season.*` is now a shared namespace split across two consumption surfaces. Future capabilities under `season.*` need a rule for which half they land in.

## Considered Options

1. **Option A — Register `season.activate` / `.archive` / `.duplicate` as agent tools now.** Maximises agent reach. Blocked by ADR-0196 I11: the agent wrappers do not yet exist, so registering would be phantom.
2. **Option B — Remove the three keys from `CapabilityName` union, keep them as string literals in Server Actions.** Breaks authority parity (ADR-0189). `gate_action` still needs the dotted key and the seed row.
3. **Option C — Declare the three as Server-Action-only in a dedicated ADR, reserving the `season.*` Server-Action namespace.** Matches current code reality. Establishes forward rule for M6+ season capabilities.

## Decision Outcome

Chosen option: **"Option C — Server-Action-only namespace reservation"**.

### Rule — Server-Action-only season capabilities

The following three `season.*` keys are **Server-Action-only capabilities in M5**:

| Capability key | Server Action | Agent-tool-registered? | Authority seed |
|----------------|---------------|------------------------|----------------|
| `season.activate` | `apps/web/src/app/dashboard/_actions/activate-season-action.ts` | **No** | Yes (ADR-0200 seed migration `20260518010000`) |
| `season.archive` | `apps/web/src/app/dashboard/_actions/archive-season-action.ts` | **No** | Yes (seeded in M5 authority migration) |
| `season.duplicate` | `apps/web/src/app/dashboard/_actions/duplicate-season-action.ts` | **No** | Yes (seeded in M5 authority migration) |

Structural consequences:

1. **Present in `CapabilityName` union.** `packages/ai/src/capabilities/types.ts` declares these dotted keys so `gate_action` / `tool-selector` / authority-loader treat them uniformly.
2. **Absent from `seasonCapability.tools[]`.** `packages/ai/src/capabilities/season/index.ts` MUST NOT import tool wrappers for any of the three. Adding one is a merge-blocker until the wrapper actually exists and has a complete `execute()` body (ADR-0196 I11).
3. **Authority row exists.** `engine_authority_config` is seeded with a row per capability so the Server Action's `gateAction(...)` call resolves a deterministic authority level instead of default-allow (ADR-0099 / ADR-0189 / L-0097).
4. **Gate-action mandatory.** Per ADR-0196 Invariant 13 (as clarified by ADR-0201 §D4), every mutation Server Action in this namespace calls `gateAction(...)` before its mutation. None of the three are read-only — all three write DB state.

### Namespace split — `season.*`

After this ADR, `season.*` divides into two halves:

- **Agent-tool capabilities** (registered in `seasonCapability.tools[]`, ADR-0201):
  - `season.create`, `season.set_revenue`, `season.save_playbook` (mutating, chat + system)
  - `season.get_readiness`, `season.learn_factors` (read-only, chat + voice + system)
- **Server-Action-only capabilities** (not registered in `seasonCapability.tools[]`, this ADR):
  - `season.activate`, `season.archive`, `season.duplicate`

Both halves share one authority seed table. Both halves share one `CapabilityName` union. The split is purely in the tool-registration layer.

### Rule for future `season.*` capabilities

Any new `season.*` capability follows this test:

1. Is there a live Server Action with a complete `execute()` body? → required for either half.
2. Is there a live agent tool wrapper with a complete `execute()` body (no phantom skeleton)? → required to enter the agent-tool half.
3. Missing #2 → defaults to Server-Action-only half; registering in `tools[]` requires a **new ADR** (not an amendment to this one) that documents the agent-tool wrapper design, channel restrictions, and multi-turn flow if any.

Agent-capability exposure of any of the three Server-Action-only keys (`activate` / `archive` / `duplicate`) is deferred to future M6+ work and requires a separate ADR. That ADR must address:

- Channel restrictions (voice-safety of a destructive mutation like archive).
- Multi-turn confirmation UX (activate wipes hour-factor cache; archive is soft-delete; duplicate writes ~50 rows).
- Whether the agent tool re-uses the existing Server Action transport or the existing RPC directly (ADR-0191 pattern choice).

None of these are resolvable in M5 scope.

## Rules & Consequences

### Rules enforced for agents and reviewers

- **Rule 1.** Reviewers seeing `season.activate` / `season.archive` / `season.duplicate` in `CapabilityName` but not in `seasonCapability.tools[]` MUST NOT flag this as a bug. It is the intended shape documented in this ADR.
- **Rule 2.** Any PR that imports `activateSeasonTool` / `archiveSeasonTool` / `duplicateSeasonTool` into `packages/ai/src/capabilities/season/index.ts` MUST cite a new ADR (not this one) authorising the promotion. `close-feature` gate (see Invariant 4 below) blocks unauthorised promotions.
- **Rule 3.** Every Server Action in this namespace resolves `profileId` + `workspaceId` server-side via `resolveCurrentProfile()` (ADR-0151) and calls `gateAction(...)` before the RPC / mutation call. Phantom emit paths (ADR-0196 I11 / L-0094) forbidden.
- **Rule 4.** Authority seed rows for all three keys MUST be present in `engine_authority_config` — the Server Action's `gateAction(...)` call must find an explicit row, not default-allow.

### Invariants

All invariants are falsifiable via the listed grep / SQL / review command.

**I1 — Three keys in CapabilityName union.**
verify: `grep -cE "'season\.(activate|archive|duplicate)'" packages/ai/src/capabilities/types.ts` returns at least `3`.

**I2 — None of the three registered in seasonCapability.tools[].**
verify: `grep -E "activateSeasonTool|archiveSeasonTool|duplicateSeasonTool" packages/ai/src/capabilities/season/index.ts` returns zero results.

**I3 — Authority seed rows exist for all three.**
verify: `SELECT capability FROM engine_authority_config WHERE capability IN ('season.activate','season.archive','season.duplicate') GROUP BY capability` returns 3 distinct rows (per workspace, seed migration).

**I4 — No unauthorised promotion.**
verify: Reviewer-level — any PR diff that adds any of `activateSeasonTool` / `archiveSeasonTool` / `duplicateSeasonTool` to `seasonCapability.tools[]` must cite a new ADR by number in the commit message. `close-feature` human-gate until a CI script exists.

**I5 — gateAction before mutation in each Server Action.**
verify: In each of `activate-season-action.ts`, `archive-season-action.ts`, `duplicate-season-action.ts`, the line number of `gateAction(...)` is less than the line number of the first `supabase.rpc(...)` / `supabase.from(...).update(...)` / `supabase.from(...).insert(...)` / `supabase.from(...).delete(...)`.

**I6 — Server-Action-only paths emit canonically server-side.**
verify: Client-side `emit('season ...')` calls targeting `activate` / `archive` / `duplicate` lifecycle events are zero. Grep: `grep -rE "emit\(['\"]season (activated|archived|duplicated)" packages/year-wheel apps/web/src/components apps/web/src/app/dashboard/year-wheel` returns zero hits in client-side code paths.

### Consequences

- **Good, because** the inconsistency between union membership and tool registration is now a documented, enforced pattern rather than an apparent bug.
- **Good, because** agent-capability exposure of destructive season operations (archive, duplicate, activate) is deferred until a real use-case and design emerges — no premature phantom tools.
- **Good, because** `season.*` namespace is reserved end-to-end for season-scoped operations. No collision surface with `schedule.*`, `helpdesk_query.*`, `journey.*`.
- **Good, because** authority parity (ADR-0189) holds: the seed table and the union are both populated for all six `season.*` keys.
- **Bad, because** a future reader unfamiliar with this ADR may see the asymmetry and attempt to "fix" it by registering tool wrappers. Mitigated by Invariant 4 citation requirement.
- **Agent Impact:** Build agents asked to "add a season capability" must check this ADR before registering anything in `seasonCapability.tools[]`. If the capability is destructive (archive, duplicate, activate) and no prior ADR authorises agent-tool exposure, default to Server-Action-only and cite this ADR.

## References

- ADR-0200 — Atomic Season Activation (seeds `season.activate`, declares Server-Action-only scope)
- ADR-0201 — Season Agent Capability (five tools; establishes read-tool exemption from ADR-0196 I13)
- ADR-0189 — Authority seed parity CI check
- ADR-0195 — Authority loader full dotted-key preservation
- ADR-0196 — Journey engine invariants 11/12/13 (phantom capability bar, gate_action mandate)
- ADR-0191 — Agent capability tool auth-passing pattern
- ADR-0099 — gate_action default-allow CVE class
- ADR-0151 — Stage-engine profile_id server derivation (used by `resolveCurrentProfile()`)
- L-0097 — C4 defaults 2nd occurrence
- L-0118 — No phantom capabilities
