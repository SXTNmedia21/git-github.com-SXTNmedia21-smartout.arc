---
title: "Service-Key Seeding — Prod Cutover Discipline"
id: ADR-0411
status: accepted
layer: decision
created: 2026-05-24
updated: 2026-05-24
---

# ADR-0411: Service-Key Seeding — Prod Cutover Discipline

## Context and Problem Statement

On 2026-05-23 Pontus discovered that contract-send from the prod UI returned "Unauthorized: invalid
service key". Root cause (BUG-009): the `platform_api_key` table had zero rows in production.
Service keys are intentionally never seeded via migration (secrets must not live in git), so after
the first prod release on 2026-05-13 the seeding step was missed. The `validate-api-key` Edge
Function rejected every service-to-service call with `{valid: false}` because no hash ever matched.
At least three services were affected (contract-service, stage-engine, shift-mcp). The bug was live
for 10 days before discovery.

## Decision Drivers

- Service keys must NOT be stored in migrations or git (Three Laws of Security).
- After any prod db-reset or first cutover, the operator must explicitly seed keys.
- Nothing enforced this requirement — it was undocumented tribal knowledge.
- Silent 401s: no alarm, no metric, no heartbeat gate triggered.
- The BUG-009 class will repeat on every future db-reset without a structural fix.

## Considered Options

1. **Migration-based seed** — Store hashed keys in a migration and auto-apply.
2. **Vault-only auto-derive in EF** — `validate-api-key` tries Vault on hash-miss.
3. **Seed script + registry + drift-check + CI gate (layered defence)** — operator tool backed
   by automation catches omission at every layer.

## Decision Outcome

Chosen option: **Option 3 — layered defence**. Migration seed rejected because even a SHA-256
hash in git reduces key-rotation agility and couples secrets to schema history. Vault auto-derive
rejected because it adds latency to every auth request and inverts the hash-based lookup contract.

### The four layers

| Layer | File | Trigger |
|---|---|---|
| Operator seed tool | `infra/scripts/seed-prod-service-keys.sh` | Manual: after prod db-reset or adding a service |
| Expected-keys registry | `services/_shared/expected-keys.json` | Read by seed script + drift-check + CI |
| Drift-check gate | `infra/scripts/drift-check.sh` (Check 5) | Nightly heartbeat — alerts within 24 h |
| CI gate | `.github/workflows/ci.yml` (Migration Deploy job) | Every `main` push — fails immediately if missing |

## Rules & Consequences

- **Good, because** silent 401 days → minutes: CI gate fails on the same push that resets the DB.
- **Good, because** heartbeat picks up drift within 24 h if CI is bypassed or the seed script is
  run after cutover with no subsequent push.
- **Good, because** the seed script is idempotent — safe to re-run any time, including rotation.
- **Bad, because** the CI gate relies on `SUPABASE_PROJECT_REF` + `PGPASSWORD` secrets; if the
  query itself fails (auth / connectivity), the step warns and continues rather than false-red.
- **Bad, because** adding a new service requires a manual PR to update `expected-keys.json` before
  the CI gate knows to enforce it.
- **Agent Impact:** When adding a new service that calls `validate-api-key` or queries
  `platform_api_key` directly: (1) add an entry to `services/_shared/expected-keys.json`,
  (2) add the corresponding 1Password item in `smartout_ai_prod` vault, (3) run the seed script
  after the next prod db-reset or immediately if the service is being deployed to prod.

## Operator Runbook Addition

After any prod db-reset or first cutover:

```bash
# Authenticates to 1Password and seeds all service keys idempotently
op run --env-file=.env.template -- ./infra/scripts/seed-prod-service-keys.sh
```

See `docs/protocols/DEPLOYMENT.md §8 Service-Key Seeding (post-cutover)`.

## Alternatives Considered

- **Option 1 — migration seed:** rejected. Even hashes in git reduce auditability of key rotation
  and couple a security operation to schema versioning. If the hash leaks, reconstructing the key
  is harder but the hash is still a sensitivity liability.
- **Option 2 — Vault auto-derive in EF:** rejected. Adds a Vault round-trip to every `x-api-key`
  or `x-service-key` auth path. The hash-based lookup is O(1) index scan today; Vault lookup is a
  function call with network cost. Also inverts the design: the EF currently trusts the DB as
  authoritative; making the EF authoritative on hash-miss creates a split-brain.

## References

- BUG-009 — `docs/test-runs/2026-05-23-prod-release-d766392a.md`
- ADR-0388 — pg_cron enablement + prod cron-registration recovery (pattern precedent for
  idempotent seed via psql + CI verification step)
- `infra/scripts/seed-prod-service-keys.sh`
- `services/_shared/expected-keys.json`
