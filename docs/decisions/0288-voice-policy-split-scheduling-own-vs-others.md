---
title: "Voice policy split — scheduling.own vs scheduling.others"
id: ADR-0288
status: proposed
layer: decision
created: 2026-04-23
updated: 2026-04-23
supersedes: []
amends: [ADR_0078]
related: [ADR_0024, ADR_0078, ADR_0133, ADR_0163, ADR_0286, ADR_0287]
---

# ADR-0288: Voice policy split — scheduling.own vs scheduling.others

## Context and Problem Statement

ADR-0078 established channel restriction as a capability-level contract: capabilities carrying PII (personnummer, bank, address) are chat-only. Hospitality gap analysis (Council 2026-04-23) found `packages/ai/src/industry/packages/hospitality.ts:143` sets `scheduling.default_voice_allowed: true` — a domain-wide default that is too broad for the capability surface growing underneath it.

Two capabilities inside the `scheduling` domain carry different privacy shapes:

1. **`availability.set_own`** (ADR-0286 new) — the actor sets *their own* availability intervals. Voice is acceptable: no third-party data revealed, input is low-sensitivity scheduling preference, hands-free entry helps employees in service roles.
2. **`shift_swap`** (existing) and **`availability.query_others`** (ADR-0286 new) — the actor is shown *other employees'* availability, names, shift slots. Voice is not acceptable: a bartender in an open kitchen asking "hvem er tilgjengelig fredag kveld" gets other employees' roster data read aloud in earshot of guests. Even absent PII as defined in ADR-0078, the pattern is a privacy leak through the physical channel.

The domain-level `default_voice_allowed: true` is technically correct for `set_own` but incorrect for `shift_swap` / `query_others`. ADR-0078's policy mechanism is per-capability `allowedChannels`, so the fix is not to invert the domain default (which would suppress `set_own`) but to ensure capability-level `allowedChannels` overrides the domain default explicitly.

ADR-0163 ("allowedChannels mandatory for PII, fail-closed at registration") already mandates the mechanism. This ADR codifies the *rule* that drives which capabilities in the scheduling domain need it.

## Decision Drivers

- **ADR-0078 capability > domain default.** The industry package's `default_voice_allowed` is a seed for capabilities that do NOT declare `allowedChannels`. Any capability with explicit `allowedChannels` overrides it. This ADR requires explicit `allowedChannels` on the two others-revealing capabilities so the domain default becomes inert for them.
- **Privacy scope goes beyond PII-as-defined-in-ADR-0078.** ADR-0078's PII list (personnummer, bank, address) is the *base*. Names + roster assignments + availability windows of third parties, spoken in a physical room the actor does not control, is adjacent privacy surface. ADR-0163 amended ADR-0078 to require fail-closed registration for PII; this ADR narrows the rule into a domain-specific split.
- **Actor-scope is the dividing line, not intent.** "Sett meg som utilgjengelig torsdag" = actor's data, voice OK. "Hvem er tilgjengelig torsdag" = third-party data, chat only. The rule phrased as `actor_scope in {self, other}` rather than `sensitivity in {low, high}` travels better to future capabilities.
- **ADR-0133 mobile verb table already splits by actor-scope.** Desk authoring / access-rule config / reassign-other is web-only; self-service verbs (query compose, self-claim, own-resolve) are mobile-allowed. This ADR applies the same actor-scope dividing line to voice.
- **Concrete call site to fix.** `packages/ai/src/industry/packages/hospitality.ts:143` sets the loose default. The ADR does not remove that line (other scheduling capabilities — e.g., hypothetical `scheduling.view_own_shifts` — may correctly inherit it); it mandates capability-level overrides on the others-revealing capabilities.

## Considered Options

1. **Flip domain default to `default_voice_allowed: false` for scheduling.** REJECTED. Over-corrects. `availability.set_own` is a legitimate voice use case (hands-free, self-scope), and breaking it pushes employees to chat for a task voice handles fine. Breaks `scheduling.view_own_shifts` and future self-scope tools the same way.
2. **Add a new `voice_sensitivity` field on the industry package.** REJECTED. Introduces a fourth dimension (on top of capability / authority / channel / domain). L-0029 names "parallel permission mechanisms" as ontology smell. Use the existing `allowedChannels` mechanism (ADR-0078) instead of growing new surface.
3. **Capability-level `allowedChannels` override, mandated for others-revealing capabilities.** CHOSEN. Uses the ADR-0078 mechanism already in place; amends ADR-0078 with a domain-specific rule; leaves `default_voice_allowed: true` intact for self-scope capabilities in the domain.

## Decision Outcome

Chosen option: **"Capability-level `allowedChannels` override, mandated for others-revealing capabilities"**, because (a) the mechanism (ADR-0078 `allowedChannels`) already exists and is fail-closed at registration (ADR-0163), (b) the dividing line is actor-scope not sensitivity, and (c) the fix is surgical — the domain default stays where it helps, capabilities that reveal others declare their override.

### Rule (enforced)

> **In the `scheduling` capability domain, any capability whose execution reveals data about employees other than the actor MUST declare `allowedChannels: ["chat"]` at registration. Capabilities whose execution touches only the actor's own data MAY inherit the domain default `default_voice_allowed: true`.**

### Applied to current capabilities

| Capability | Actor scope | `allowedChannels` required? | Current state |
| --- | --- | --- | --- |
| `availability.set_own` (ADR-0286) | Self | Not required (inherits domain default) | New |
| `availability.preference_rank` (ADR-0286) | Self | Not required | New |
| `availability.query_others` (ADR-0286) | Others | **REQUIRED `["chat"]`** | New — declare at registration |
| `shift_swap` | Others (reveals swap counterparty) | **REQUIRED `["chat"]`** | Existing — add at remediation |
| Future: `scheduling.view_own_shifts` | Self | Not required | Hypothetical |
| Future: `scheduling.view_department_roster` | Others | **REQUIRED `["chat"]`** | Hypothetical |

### Enforcement

Per ADR-0163 (fail-closed registration): a capability in the `scheduling` domain that touches `profile` / `workspace_member` / `schedule_shift` of `profile_id != auth.uid()` without `allowedChannels` declared fails registration at startup. Registration-time test (exists per ADR-0163) extended with a `scheduling`-domain variant.

CI grep (cheap secondary control): flag any tool under `packages/ai/src/capabilities/` whose domain is `scheduling`, whose `execute()` joins `profile` / `workspace_member` on a non-self `profile_id`, and whose registration does not include `allowedChannels: ["chat"]`. Allow-list with ADR-or-ticket reference.

### Amendment to ADR-0078

Add to ADR-0078 §Rules: **Actor-scope rule for scheduling domain.** Capabilities whose execution reveals data about employees other than the actor (roster assignments, availability windows, contact info, swap counterparties) MUST declare `allowedChannels: ["chat"]`. The domain-level `default_voice_allowed` governs only self-scope capabilities. ADR-0288 specifies this rule.

## Rules & Consequences

- **Good, because** actor-scope is a stable, code-traceable dividing line. "Does this query read `profile_id != auth.uid()`?" is a grep-able heuristic that lines up with the privacy intent.
- **Good, because** the mechanism reuses ADR-0078's `allowedChannels` and ADR-0163's fail-closed registration — no new permission surface. L-0029 constraint (keep mechanism count bounded) respected.
- **Good, because** self-scope capabilities keep voice availability, which is the hands-free win that justified the domain default in the first place.
- **Bad, because** the actor-scope test is a heuristic — a capability that joins `profile` to read the actor's own row still reads the `profile` table. CI grep must be paired with author judgment; the rule's intent ("reveals *other* employees") is stronger than any grep.
- **Bad, because** ADR-0078's per-capability override model places the decision on the capability author. If authors default to copy-paste from a self-scope sibling when writing an others-scope capability, the override gets forgotten. Registration-time fail-closed (ADR-0163) catches it; CI grep catches it; code review catches it; but the default human path is wrong.
- **Agent Impact:**
  - Authors adding new capabilities in the `scheduling` domain MUST answer "does this reveal other employees' data?" in the capability PR. If yes, `allowedChannels: ["chat"]` is mandatory at registration.
  - `shift_swap` remediation (per L-0131 / ADR-0287 trust-gate) MUST include `allowedChannels: ["chat"]` in the remediation PR.
  - `availability.query_others` (ADR-0286) ships with `allowedChannels: ["chat"]` from day one — no voice window.
  - Industry-package maintainers MUST NOT add new domain-level `default_voice_allowed` rows without considering the actor-scope split; the question "are there others-revealing capabilities in this domain?" is part of the domain seed's PR template.

## References

- ADR-0024 — C4 authority policy (base).
- ADR-0078 — channel restriction on capability processes (amended here with actor-scope rule).
- ADR-0133 — mobile verb table (precedent: actor-scope splits surface availability).
- ADR-0163 — `allowedChannels` mandatory for PII, fail-closed at registration (mechanism used here).
- ADR-0286 — employee availability three-table model (new capabilities in scope).
- ADR-0287 — `gate_action` mandatory on mutation capability tools (companion rule; voice + gate together).
- L-0029 — four parallel permission mechanisms is ontology smell (constraint satisfied).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
