---
title: "API Versioning and Lifecycle"
id: REF_API_VERSIONING
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on:
  - REF_API_OVERVIEW
tags:
  - api
  - versioning
  - lifecycle
  - deprecation
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# API Versioning and Lifecycle

> Versioning rules, change policy, and deprecation lifecycle for Smartout APIs.
> Last updated: 2026-02-28

---

## Scope

Applies to:

- Public customer APIs (`/v1/...` target),
- Partner APIs,
- Event/webhook contracts,
- Internal APIs consumed by multiple Smartout services.

---

## Versioning strategy

### URL versioning for external APIs

- Major API versions use URL prefix:
  - `/v1/...`, `/v2/...`

### Contract version metadata

Each endpoint contract should include:

- `api_version` (major),
- `contract_version` (semantic, for schema evolution),
- `last_updated_at`,
- `deprecation` metadata (when applicable).

### Webhook event versioning

Event payloads should carry:

- `event_type`,
- `event_version`,
- `event_id`,
- `occurred_at`.

---

## Change classification

### Non-breaking changes (allowed in same major)

- Add optional request fields.
- Add response fields (non-required for existing clients).
- Add new enum values only when clients are documented to handle unknowns.
- Add new endpoints/resources.

### Breaking changes (require new major)

- Remove or rename endpoints.
- Remove or rename existing fields.
- Change field type/semantics incompatibly.
- Tighten validation in ways that reject previously valid input.
- Change auth requirements incompatibly.

---

## Lifecycle states

Each endpoint and contract must have one state:

- `draft`: design in progress, not for production use.
- `beta`: available but may evolve quickly.
- `stable`: production contract with compatibility guarantees.
- `deprecated`: replacement exists; sunset date announced.
- `sunset`: no longer supported/served.

---

## Deprecation policy

Minimum policy for stable endpoints:

- announce deprecation with rationale and migration path,
- provide at least 90 days notice before sunset (longer for enterprise),
- emit warning headers/log events during deprecation window,
- provide migration examples.

Recommended HTTP headers:

- `Deprecation: true`
- `Sunset: <RFC 7231 date>`
- `Link: <migration-doc-url>; rel="deprecation"`

---

## Backward compatibility guardrails

- Existing clients must continue working across non-breaking releases.
- Required response fields for stable endpoints cannot be removed in-place.
- Unknown field tolerance required for client SDKs and partner integrations.
- Contract tests must verify no incompatible diff before release.

---

## Release governance checklist

Before release:

1. Contract diff reviewed.
2. Breaking-change assessment complete.
3. Security/scope model reviewed.
4. Data dictionary updated.
5. Endpoint reference updated.
6. Migration guidance prepared (if needed).
7. Monitoring and alert thresholds defined.

---

## Recommended version cadence

- Public API major versions: infrequent, planned, migration-led.
- Minor/internal contract updates: as needed, backward-compatible.
- Partner contracts: slower cadence with explicit communication windows.

---

## Migration playbook template

When introducing `v2` from `v1`:

- publish changelog and mapping table (`v1` field -> `v2` field),
- provide side-by-side examples,
- enable overlap period where both versions run,
- track client migration progress,
- sunset only after target migration threshold.

---

## Ownership

- API domain owners propose changes.
- API Architecture Review approves major/breaking changes.
- Security approves auth/scope and sensitive data handling changes.
- Product ownership approves timing and communication to customers/partners.
