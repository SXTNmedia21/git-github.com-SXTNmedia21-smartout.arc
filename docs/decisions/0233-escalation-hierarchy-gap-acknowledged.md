---
title: "Escalation Hierarchy Gap — Phase 2 Uses Proxy Patterns"
id: ADR_0233
status: accepted
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0233: Smartout Lacks a Formal Escalation Hierarchy — Phase 2 SLA Uses Proxy Patterns

## Context and Problem Statement

Helpdesk Phase 2 SLA wiring requires a deterministic answer to "who gets notified when a ticket breaches its escalation threshold?" The Phase 1 council ratified `engine_authority_config.observer_escalation_hours` as the timer source but did not specify the observer-resolution model. On inspection, Smartout has no first-class "X reports to Y" relationship anywhere in the schema:

- `profile.role` is a permission floor (`employee` → `manager` → `admin` → `owner`), not an org-chart link.
- `team.leader_profile_id` exists but only some profiles are on a team, and a leader can simultaneously be the team's only member.
- `engine_authority_config.min_role` describes who CAN act, not who SHOULD be paged.
- No `profile.reports_to_profile_id` or equivalent.

Phase 2 must escalate to *someone*, but the schema cannot answer "who" without a proxy.

## Decision Drivers

- Council 2026-04-19 (Kanaler som Help Desk) ratified shipping SLA basics quickly. A first-class escalation hierarchy was explicitly out of scope.
- The observer-resolution choice has long-term consequences — locking ourselves into a wrong model is harder to unwind than acknowledging the gap.
- Silent SLA failure ("we configured it but no one was notified") is worse than no SLA — operations relies on the badge being meaningful.
- Future capabilities (governance approvals, contract sign-off escalation, training-overdue follow-ups) will hit the same gap. Phase 2 must not pretend to solve it on their behalf.

## Considered Options

1. **Build org-chart first** — add `profile.reports_to_profile_id`, ALTER TABLE migration, admin UI to set reporting lines, then wire SLA on top. Estimated 2-4 weeks. Pushes Phase 2 to Phase 2+3.
2. **Add `observer_profile_id` to `engine_authority_config`** — workspace picks one designated escalation owner. Simple but doesn't scale to multi-desk workspaces (one observer for ALL helpdesk activity).
3. **Per-channel `escalation_profile_id` on `channel`** — most granular, but 20 desks = 20 maintenance points + cascade on profile deactivation.
4. **Role broadcast** — notify all profiles where `role >= min_role`. Zero migration. Diffusion-of-responsibility risk ("someone else will take it").
5. **Acknowledge the gap, ship Phase 2 with proxy patterns, document Phase 3 scope** — use existing fields (`channel.responsible_profile_id` + `team.leader_profile_id`) as a proxy, fall back to broadcast, surface "no observer" as a high-signal telemetry event.

## Decision Outcome

Chosen option: **Option 5 — acknowledge the gap, ship Phase 2 light, document the work for Phase 3.**

Phase 2 escalation resolves an observer via this rule chain (codified in ADR-0234):

1. Find the desk channel's `responsible_profile_id` (the rep).
2. Find that rep's primary team via `team_member.team_id` → `team`.
3. Use `team.leader_profile_id` if present and not equal to the rep.
4. Fall back to all profiles in the workspace where `role >= engine_authority_config.min_role` (broadcast).
5. If neither produces a recipient, emit a `helpdesk.sla.no_observer_resolved` telemetry event so the silent failure becomes loud.

Phase 3 will introduce a first-class escalation model (likely `profile.reports_to_profile_id` or a dedicated `escalation_chain` table). This ADR is the marker for that work.

## Rules & Consequences

- **Good, because** Phase 2 ships in days instead of weeks, the proxy is built from already-modeled relationships (no schema change), and the acknowledgement prevents the next agent from re-running the same analysis.
- **Good, because** the "no observer resolved" telemetry event makes silent SLA failure visible. Operations can detect misconfigured workspaces from production data.
- **Bad, because** the proxy chain is non-obvious to admins. A workspace where the rep has no team and only one manager (themselves) may resolve to nobody — the broadcast fallback covers this, but the failure mode is subtle.
- **Bad, because** every future capability that needs escalation will either reuse this proxy or invent its own. Phase 3 is now load-bearing for governance approvals + contract sign-off + training follow-ups.
- **Agent Impact:** when wiring escalation in any new capability, do NOT invent a new resolution rule. Reuse the helper introduced in ADR-0234 (`resolve_observer(workspace_id, rep_profile_id, min_role)`) until Phase 3 lands a real hierarchy. Capabilities that need a different chain must explicitly justify why and reference this ADR.
- **Agent Impact:** Phase 3 escalation-hierarchy work is a real prerequisite for production-grade SLA across capabilities. Estimated scope: schema migration + admin UI + backfill from existing teams + ADR. Not on Phase 2's critical path but blocks Phase 3 features that need deterministic escalation (e.g., "manager must sign off within 48h").

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
