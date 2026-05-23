---
title: "{Domain} — Data Model"
status: in_progress
mirror: verified
last_verified: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
created: {YYYY-MM-DD}
domain: {domain-slug}
tags: [domain, {domain-slug}, data-model, schema]
---

# {Domain} — Data Model

> Actual schema. **Code wins** — verified against migrations + `database.types.ts`. Enums enumerated by querying, not guessed.

## Tables
| Table | Schema | workspace-scoped | Key columns | Migration |
|---|---|---|---|---|
| {table} | public/payroll/… | yes/no | {…} | `path:line` |

## Enums
| Enum | Values | Source |
|---|---|---|
| {enum} | {a, b, c — from `enum_range` or types file} | `path` |

## FK map
{relationships}

## RLS posture
{JWT + API-key policies, helpers used}

## Telemetry events
| Event | Emitted at | Registry |
|---|---|---|
| {event} | `path:line` | `packages/telemetry/src/registry.ts:line` |
