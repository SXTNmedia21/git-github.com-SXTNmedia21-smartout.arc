---
title: "ADR-0396: Identity-layer columns belong on user_identity, not profile"
status: accepted
date: 2026-05-23
updated: 2026-05-23
deciders: pontus + council 2026-05-23 (employee-onboarding-wizard R1→R2)
amended: 2026-05-23 (Sortie C — added address columns to §Exceptions legacy carve-out)
tags: [adr, schema, identity, cascade]
---

# ADR-0396: Identity-layer columns belong on user_identity, not profile

## Context

`user_identity` is the canonical pre-workspace identity record (one per
human). `profile` is the workspace-scoped role + status (N per human,
one per workspace they belong to).

The employee-onboarding-wizard R1 spec proposed adding `phone`,
`emergency_contact_name`, `emergency_contact_phone`, and
`emergency_contact_relation` to `profile` — fields that already exist on
`user_identity`. This would have created a dual source-of-truth for the
same personal data class, the exact pattern documented in
`schema-orphan-rebuild-pattern.md`.

Cross-checked: ADR-0151 (server-derived identity), L-0177 (silent
fallback class), Cascade invariant 1 (single canonical pipeline per fact).

## Decision

Identity-class columns (anything that follows the human, not the
employment in a specific workspace) belong exclusively on `user_identity`.

This includes:
- `phone`
- `email`, `personal_email`
- `emergency_contact_*`
- `date_of_birth`
- `personal_number` (NB: currently on `profile` — see Exceptions)
- `address_line_*`, `postal_code`, `city`, `country` (when used as the
  person's address; workplace addresses belong on `location`)

## Exceptions

`personal_number` and `bank_account` are currently on `profile` because
they were placed there before the identity layer was formalized. They
stay on `profile` for now (out-of-scope migration). New columns of this
class go on `user_identity`.

`address_line_1`, `address_line_2`, `postal_code`, `city`, `country` are
currently on `profile` for the same reason as `personal_number` — placed
there before the identity layer was formalized. They stay on `profile` for
now (out-of-scope migration). A future ADR will track migration to
`user_identity` once consumer paths are mapped. New identity-class features
that need address must read from `profile` for legacy users + write through
`user_identity` for new placements (TBD when that ADR lands).

**Note:** If implementation conflicts with this list, amend the ADR or
migrate — never accept silent drift.

## Enforcement

A pre-commit guard (`scripts/check-identity-on-profile.mjs`, registered
in husky) greps staged migrations for `ALTER TABLE … profile … ADD
COLUMN (phone|email|personal_email|emergency_contact_|date_of_birth|
address_line_)` and rejects them. Override requires explicit ADR.

## Consequences

- New identity-class features write through `user_identity` + the
  existing `submit_own_pii` RPC (which handles workspace-scoped
  `profile` fields and is being considered for extension to identity-
  class field groups in a future ADR).
- Audit trail consistency: identity edits land in one canonical event
  stream rather than split across profile vs user_identity writes.
- No silent dual-write for the four columns the R1 spec proposed.

## References

- Spec: `docs/superpowers/specs/2026-05-23-employee-onboarding-wizard-design.md`
- Council log: `docs/council/COUNCIL-LOG.md#2026-05-23`
- ADR-0151 (server-derived identity)
- Pattern: `schema-orphan-rebuild-pattern.md`
- L-0177 (silent fallback class)
