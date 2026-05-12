---
title: "Template vs Contract Lifecycle Separation"
id: ADR_0182
status: accepted
layer: decision
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [contract-template, employment-contract, lifecycle, telemetry, cascade-taxonomy]
---

# ADR-0182: Template vs Contract Lifecycle Separation

## Context and Problem Statement

`contract_template` and `employment_contract` have distinct lifecycles, but the shared word "contract" has caused repeated taxonomy confusion. ADR-0082 governs the `contract_status` enum used by `employment_contract` (`draft` → `composed` → `sent` → `pending_data` → `signed` → `amended` → `terminated`). `contract_template` does not use this enum and has its own lifecycle (`fork` → `publish` → `deprecate`) layered on the lineage columns introduced by ADR-0181.

Council 2026-04-22 (contract-management-redesign) Phase 5 synthesis flagged the risk: if template events collapse into the `contract.*` namespace, telemetry and audit consumers cannot distinguish "a template was published" from "a contract was signed". The two concerns belong in separate event namespaces; ADR-0082's authority is limited to the contract lifecycle it was written for.

## Decision Drivers

- ADR-0076 — template authoring is a separate cascade concern from composition.
- ADR-0082 — governs `employment_contract` lifecycle; not written for, and must not be extended to, templates.
- Emit registry (`packages/telemetry/src/registry.ts`) is the canonical source of truth for event names; conflating namespaces corrupts the registry per L-0094 phantom-emit-contract class of defect.
- `contract_status` enum is already taken by `employment_contract` — reusing it for templates would require a second set of states layered on the same enum, guaranteeing confusion.
- Audit consumers (`activity_trail`, `engine_event`) read the event name as a taxonomy signal; `contract.signed` vs `contract_template.published` need to route differently.

## Considered Options

1. **Two namespaces: `contract_template.*` for template lifecycle, `contract.*` for contract lifecycle** — clean audit separation, explicit governance boundary between ADR-0082 and template concerns.
2. **Single `contract.*` namespace with verb discrimination (`contract.template_published` vs `contract.signed`)** — retains one namespace but relies on readers parsing the verb; audit queries become fragile.
3. **Extend `contract_status` enum with template states** — couples two independent lifecycles at the enum level; guarantees future regressions per L-0030 (contract-word-overloaded) and L-0090 (enum-expansion-vs-timestamp-column).

## Decision Outcome

Chosen option: **"Two namespaces: `contract_template.*` for template lifecycle, `contract.*` for contract lifecycle"**, because (a) emit registry already treats `domain.verb_noun` as the identity of the event (per Gate G2) — different domains = different identities, (b) audit consumers filter by event-name prefix, (c) ADR-0082 is preserved unchanged and governs only `employment_contract`, (d) template authoring lives in its own cascade concern per ADR-0076.

### Event namespaces

| Namespace | Scope | Example events (non-exhaustive) | Governing ADR |
|---|---|---|---|
| `contract_template.*` | `contract_template` lifecycle | `contract_template.forked`, `contract_template.published`, `contract_template.deprecated`, `contract_template.clause_edited`, `contract_template.drift_observed` | ADR-0181, ADR-0182 (this), ADR-0183 (proposed) |
| `contract.*` | `employment_contract` lifecycle (existing) | `contract.composed`, `contract.sent`, `contract.signed`, `contract.amended`, `contract.terminated` | ADR-0082 |

Per Gate G2 (emit registry contract), five template lifecycle events must be registered in `packages/telemetry/src/registry.ts` as part of the Phase 0 scaffolding for the contract redesign:

- `contract_template.forked` — K1a → K1b copy via `POST /api/contract-templates/copy`.
- `contract_template.published` — draft → published transition.
- `contract_template.deprecated` — published → deprecated transition.
- `contract_template.clause_edited` — a specific clause was mutated within a workspace template.
- `contract_template.drift_observed` — passive drift detection surfaced to a workspace admin (Phase 4).

All five route to the standard four destinations (PostHog, Logger, activity_trail, engine_event) per ADR-0175 emit-registry pattern.

### ADR-0082 scope clarification

ADR-0082 continues to govern `employment_contract.contract_status` transitions and the `contract.*` event namespace. It does NOT govern `contract_template` lifecycle. Any future amendment to `contract_status` must NOT be read as extending to templates.

### Taxonomy invariants

- `contract_template` lifecycle events NEVER use the `contract.*` prefix.
- `employment_contract` lifecycle events NEVER use the `contract_template.*` prefix.
- `contract_status` enum is reserved for `employment_contract`. Template lifecycle is derived from timestamp columns (`forked_at`, `published_at`, `deprecated_at`) per ADR-0181 + L-0090 (nullable-timestamp-over-enum heuristic).
- Emit registry entries for both namespaces are required before any capability tool or Server Action emits under them (per L-0094 phantom-emit defense).

## Rules & Consequences

- **Good, because** audit consumers can filter `activity_trail` by prefix (`contract_template.%` vs `contract.%`) and get unambiguous slices.
- **Good, because** ADR-0082 is protected from accidental scope creep; reviewers can reject any PR that extends `contract_status` to cover templates.
- **Good, because** template lifecycle stays timestamp-derived (L-0090 heuristic), avoiding a second enum on the same conceptual surface.
- **Bad, because** five new registry entries must land before any template-related emit fires — phantom-contract risk is non-zero if the registration PR merges after the emit-site PR. (Mitigation: Gate G2 blocks the emit-site PR until the registry PR is merged.)
- **Bad, because** teams skimming code that mentions "contract" must now check the namespace to know which lifecycle is in play. (Mitigation: in-code comment convention — comment every emit site with the namespace it belongs to.)
- **Agent Impact:** Any agent writing a contract-related emit MUST pick the correct namespace. `create_contract` emits `contract.composed`, not `contract_template.*`. Template capability tools (future) emit `contract_template.*`, not `contract.*`. Before adding an emit, grep `packages/telemetry/src/registry.ts` for the exact event name — missing entry = blocked per L-0094. When reading ADR-0082, treat its scope as `employment_contract` only — do not extrapolate to templates.

## References

- ADR-0024 — original contract capability proposal.
- ADR-0076 — composition as cascade derivation (template authoring is separate concern).
- ADR-0082 — `employment_contract` lifecycle (unchanged scope after this ADR).
- ADR-0181 — K1a→K1b lineage + timestamp-derived template lifecycle.
- ADR-0175 — emit-registry contract pattern (precedent for journey.* namespace).
- L-0030 — "contract" word overloaded across two systems.
- L-0090 — enum-expansion-vs-timestamp-column heuristic.
- L-0094 — phantom emit contracts recurring.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
