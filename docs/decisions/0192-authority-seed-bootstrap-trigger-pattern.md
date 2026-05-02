---
id: ADR-0192
title: "Authority seed bootstrap-trigger pattern"
status: accepted
date: 2026-04-22
created: 2026-04-22
updated: 2026-05-02
deciders: [pontus, council]
superseded_by: null
module: MODULE_AUTHORITY
tags: [adr, c4, authority, gate-action, bootstrap, trigger, capability-registry, contract-hub-redesign]
---

# ADR-0192 — Authority seed bootstrap-trigger pattern

## Context and Problem Statement

Post-merge code-trace of `contract-hub-redesign` (PR #234) found the `contracts.template_management` authority seed migration silently no-ops when no godmode user exists at migration time. The same pattern occurs in `billing_query` and `helpdesk_query` seed migrations: each tries to backfill `engine_authority_config` rows by joining against a "first owner" lookup that may return zero rows for fresh workspaces.

Combined with the `gate_action` default-allow behavior on missing rows (`20260506120000_gate_action_accept_entity_id.sql:107-109`), an unseeded capability becomes auto-autonomous — a CVE-class side-finding flagged at the 2026-04-19 Kanaler-som-Help-Desk council and re-confirmed by Trust Gate at every subsequent council that touched a new capability.

The platform has accumulated five recurring symptoms of this single root cause:

1. New workspaces created after a capability ships do not get authority rows (no `BEFORE INSERT ON workspace` hook seeds them).
2. Existing workspaces present at migration time but lacking a godmode/owner row are skipped silently.
3. Per-capability seed migrations duplicate the same idempotent CROSS JOIN logic with subtle drift (`helpdesk_query_authority_seed.sql:43-66` is correct; `billing` and `contracts` variants drift).
4. `gate_action` default-allow turns an absent row into "autonomous, level=admin" — exactly the opposite of fail-closed.
5. Council Trust Gate has to re-verify seed coverage on every new capability — wastes review cycles, fails open the moment one council misses it.

The root fix is platform-level: a generic mechanism that makes "every workspace has an authority row for every registered capability" a structural invariant, not a per-migration ritual.

## Decision Drivers

- **Close the default-allow CVE class permanently** — fail-closed by construction, not by per-migration discipline.
- **Eliminate per-capability seed migrations as a vector for drift** — six capabilities today, ~25 by year end; the helpdesk pattern works, but every new capability re-implements it slightly differently.
- **Cover both new and existing workspaces** — trigger handles new; backfill handles existing; both share one source of truth (capability registry).
- **Single platform invariant, not per-team discipline** — "registered capability ⇒ row in `engine_authority_config` for every workspace" is a database-level guarantee, not a checklist.
- **Idempotency** — re-running migration or trigger must be safe (`ON CONFLICT (workspace_id, capability) DO NOTHING`).

## Considered Options

1. **Periodic reconciliation job** — cron sweeps workspaces × registered capabilities and inserts missing rows. Rejected: race window between workspace creation and next cron tick. Default-allow fires for new workspaces during the gap.
2. **Per-migration backfill (status quo)** — each capability ADR ships with a seed migration. Rejected: duplicates code, drifts in subtle ways (3 of 6 capabilities have the bug today), still leaves the new-workspace gap unless the migration also installs a trigger.
3. **`BEFORE INSERT ON workspace` trigger + capability registry + one-time backfill** — chosen. Trigger reads from a registry (static SQL array OR new `capability_registry` table) and inserts authority rows for every registered capability. Backfill migration covers existing workspaces using the proven helpdesk pattern.

## Decision Outcome

Chosen option: **`BEFORE INSERT ON workspace` trigger + capability registry + one-time backfill** (option 3).

**Trigger.** Migration `<TBD>_authority_seed_bootstrap_trigger.sql` installs:
- A `capability_registry` table OR (interim) a `seed_authority_for_workspace(workspace_id uuid)` SQL function that hard-codes the list of capabilities + default authority levels per capability (level, min_role, observer_escalation_hours).
- A `BEFORE INSERT ON workspace` trigger that calls `seed_authority_for_workspace(NEW.id)` and inserts one `engine_authority_config` row per registered capability with `ON CONFLICT (workspace_id, capability) DO NOTHING`.

**Backfill.** Same migration runs the seed function against every existing workspace using a COALESCE chain to find a non-NULL "owner-ish" actor (mirrors the working pattern from `helpdesk_query_authority_seed.sql:43-66`):

```sql
COALESCE(
  (SELECT id FROM profile WHERE workspace_id = w.id AND role = 'owner' LIMIT 1),
  (SELECT id FROM company_member WHERE company_id = w.company_id LIMIT 1),
  (SELECT id FROM user_identity LIMIT 1)
)
```

**Registry source of truth.** Two acceptable shapes; choose at implementation time:
- **a)** Static SQL `VALUES` list inside the seed function. Pros: zero new tables. Cons: every new capability requires editing the function and a migration to redeploy.
- **b)** New `capability_registry` table populated by per-capability migrations. Pros: cleaner ownership model, capabilities self-register. Cons: another table to maintain RLS/types for.

Council recommends starting with (a) (faster, fewer moving parts), promoting to (b) when the static list crosses ~15 capabilities or when capability self-registration becomes a pattern in TypeScript-side code.

**Per-capability migrations going forward.** Each new capability ADR adds its tuple to the registry in the same PR as the capability code. Per-capability backfill migrations are deprecated; the trigger handles new workspaces and the registry function handles backfill.

## Rules & Consequences

- **Good, because** the default-allow CVE class is structurally closed at platform level — `gate_action` can no longer find an absent row for a registered capability.
- **Good, because** new workspaces always have authority rows on creation. No race window. No cron dependency.
- **Good, because** existing unseeded workspaces are backfilled in one operation, using the proven `helpdesk_query` pattern.
- **Good, because** future capability ADRs lose the "and ship a seed migration" footnote — they ship a registry insert in the same PR.
- **Bad, because** the `BEFORE INSERT ON workspace` trigger is now load-bearing for security. Drop it accidentally and every new workspace defaults to autonomous on every capability. Mitigation: pgTAP test asserts trigger exists + `gate_action` denies an unseeded workspace.
- **Bad, because** the COALESCE owner-resolution chain can pick a stale `user_identity` if the workspace is brand-new and has no profile yet. Acceptable trade-off — the row is updateable post-onboarding, and the alternative (no row) is the CVE we are closing.
- **Agent Impact:** Capability authors stop writing seed migrations. They add one tuple to the registry. Council Phase 5 Trust Gate's "did you seed `engine_authority_config`?" question collapses to "did you add the registry tuple?" — a one-line grep instead of a per-capability deep dive.

## Alternatives Considered

- See "Considered Options" above. Periodic reconciliation rejected on race-window grounds; per-migration backfill is the failing status quo this ADR replaces.
- Considered making `gate_action` itself fail-closed on missing rows (no default-allow). Rejected as a separate-ADR scope: changing default-allow is a behavior change for every existing capability and requires its own rollout plan with feature-flag and migration sequencing. This ADR closes the CVE by ensuring the default never fires; a later ADR can remove the default itself once we are sure no production capability relies on it.

## Open Questions

- **Capability removal semantics.** When a capability is deprecated, what happens to its rows in `engine_authority_config`? Probably leave them (idempotent, no harm). Document in implementation.
- **Registry ownership for cross-package capabilities.** If a capability ships in one package but is consumed by another, who owns the registry tuple? Default: the package that exports the capability `index.ts`.
- **Migration ordering with new-capability PRs.** If capability code lands before registry seed, the gap window re-opens for new workspaces during deploy. Enforce same-PR ordering via lint rule (no `capabilities/<x>/index.ts` without matching registry insert in same diff).

## Related ADRs

- **ADR-0091** — `cascade_gate_write` / `gate_action` is the consumer this ADR keeps fed.
- **ADR-0162** — Helpdesk capability placement; introduced the working seed pattern that this ADR generalizes.
- **ADR-0176** — Journey C4 authority seed; was the second instance to hit this bug.
- **ADR-0163** — `allowedChannels` mandatory at registration; sibling fail-closed pattern at the registry layer.
- **L-0066** (linked in 2026-04-19 Kanaler council) — default-allow CVE class first named.
- **L-0097** — C4 authority defaults are not free.

---

> Council: 2026-04-22 post-merge review of contract-hub-redesign (PR #234). Verdict: APPROVE WITH FIX-FORWARD SORTIE. After writing: register in `docs/decisions/0000-decision-log.md`.
