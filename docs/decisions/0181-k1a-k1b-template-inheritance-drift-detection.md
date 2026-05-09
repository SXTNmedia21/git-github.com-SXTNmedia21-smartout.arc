---
title: "K1a→K1b Template Inheritance & Drift Detection"
id: ADR-0181
status: accepted
layer: decision
created: 2026-04-22
updated: 2026-04-22
module: contracts
tags: [k1a, k1b, contract-template, inheritance, drift, lineage, cascade-derivation]
---

# ADR-0181: K1a→K1b Template Inheritance & Drift Detection

## Context and Problem Statement

ADR-0076 establishes composition as cascade derivation — workspaces may fork K1a (industry) system templates into their K1b (workspace) space and customize. Today, `contract_template` carries no lineage columns: the moment a workspace copies a K1a template, the fork is orphaned. Drift between the forked copy and the evolving K1a source cannot be detected, compared, or surfaced to the workspace admin.

Council 2026-04-22 (contract-management-redesign) Q7 asked how Phase 4 should treat drift. Two sub-questions: what data model makes drift observable, and what affordance (passive vs interactive) ships in Phase 4. This ADR answers the data-model sub-question; Phase-5 interactive remediation is deferred to ADR-0183.

## Decision Drivers

- ADR-0076 — composition is cascade derivation; workspaces may fork K1a without losing provenance.
- K1a is platform-owned, K1b is tenant-isolated; propagation must be one-way (forward-only), never write-back.
- Without lineage columns, drift is invisible; the drift-badge UI in Phase 4 has no source data.
- Active remediation (accept/reject K1a clause updates) is a distinct capability-shaped concern — belongs in its own ADR.
- `contract_template` already carries `workspace_id` (nullable for K1a rows) — lineage columns layer on top without reshaping the table.

## Considered Options

1. **Lineage columns + passive drift only (Phase 4), interactive remediation deferred** — add 5 columns to `contract_template`, populate at fork time, compare versions at read time.
2. **Lineage table (`contract_template_lineage`) instead of columns** — normalized but adds join cost on every read; no write-back scenarios justify the normalization.
3. **No lineage at all — forks are independent copies** — blocks drift detection entirely; rejects Council Q7 passive-drift requirement.
4. **Bi-directional sync (K1b edits propagate back to K1a)** — violates platform/tenant isolation; rejected by ADR-0076.

## Decision Outcome

Chosen option: **"Lineage columns + passive drift only (Phase 4), interactive remediation deferred"**, because (a) columns are cheap and avoid an extra join on every template read, (b) passive observability ships without requiring a new capability registration or C4 authority seed, (c) interactive remediation is a separate product concern (clause-level accept/reject UX + change_proposal writes) that belongs in ADR-0183 with its own capability.

### Schema additions to `contract_template`

```sql
ALTER TABLE contract_template
  ADD COLUMN source_template_id UUID NULL REFERENCES contract_template(template_id) ON DELETE SET NULL,
  ADD COLUMN source_template_version text NULL,
  ADD COLUMN forked_at timestamptz NULL,
  ADD COLUMN published_at timestamptz NULL,
  ADD COLUMN deprecated_at timestamptz NULL,
  ADD CONSTRAINT contract_template_fork_lineage_coherent
    CHECK (source_template_id IS NULL OR forked_at IS NOT NULL);
```

| Column | Semantics |
|---|---|
| `source_template_id` | FK to the K1a template that was forked. `NULL` for original platform templates and for hand-authored workspace templates. `ON DELETE SET NULL` preserves the workspace copy if K1a deprecates. |
| `source_template_version` | Immutable snapshot of the K1a version at fork time (e.g. `"1.4.0"` or a content-hash). Drift = `source_template_version < current K1a version`. |
| `forked_at` | Timestamp the fork occurred. Required if `source_template_id` is set. |
| `published_at` | Template lifecycle — when the workspace-admin flipped the template from draft to published. Nullable (drafts). |
| `deprecated_at` | Template lifecycle — when the workspace-admin retired the template. Nullable. |

### Population path

`POST /api/contract-templates/copy` (the fork endpoint) MUST populate all three lineage columns atomically:

- `source_template_id` ← the K1a `template_id` being forked.
- `source_template_version` ← snapshot of the K1a row's version at copy time.
- `forked_at` ← `now()`.

The fork endpoint is the only write path for these columns. Workspace edits to the copy (clause rewrites, display-name changes) do NOT mutate the lineage columns.

### Propagation rules (one-way forward)

- Workspace edits to a K1b copy do NOT propagate back to K1a. Ever.
- Platform edits to K1a do NOT auto-apply to K1b copies. Ever.
- Drift is observable via `SELECT * FROM contract_template WHERE source_template_id = $1 AND source_template_version < (SELECT version FROM contract_template WHERE template_id = $1)`.
- Phase 4 ships a passive badge on workspace templates whose `source_template_version` is stale relative to current K1a. No accept/reject UI. No `change_proposal` writes.

### Out of scope for this ADR

- Interactive remediation (accept/reject K1a clause updates) — belongs in ADR-0183 (proposed, deferred).
- The `industry_intelligence` capability needed to compute diffs and generate `change_proposal` rows — also ADR-0183.
- Cross-workspace drift aggregation dashboards — not required for Phase 4.

## Rules & Consequences

- **Good, because** the five columns are load-bearing for four separate product concerns (lineage visibility, drift detection, template lifecycle audit, future remediation) at near-zero read cost.
- **Good, because** constraint `source_template_id IS NULL OR forked_at IS NOT NULL` makes it structurally impossible to create an orphaned fork.
- **Good, because** `ON DELETE SET NULL` on `source_template_id` preserves the workspace's working copy if K1a ever deprecates — drift becomes "source removed" rather than a cascade delete.
- **Bad, because** templates copied before this ADR lands carry `NULL` lineage permanently — drift is invisible for those rows. (Mitigation: `forked_at IS NULL AND workspace_id IS NOT NULL` is readable as "historical, lineage unknown".)
- **Bad, because** Phase 4 drift is observability-only — a workspace admin sees the badge but cannot act on it until ADR-0183 accepts and the `industry_intelligence` capability ships.
- **Agent Impact:** Any agent composing a contract from a template MUST read `contract_template` including the lineage columns; do not project them away. The fork endpoint is the only write path for `source_template_id` / `source_template_version` / `forked_at` — no capability tool may backfill them. Template lifecycle events (`forked`, `published`, `deprecated`) belong to the `contract_template.*` namespace per ADR-0182 — never to `contract.*`.

## References

- ADR-0024 — original contract capability proposal.
- ADR-0076 — composition as cascade derivation (K1a→K1b inheritance foundation).
- ADR-0082 — contract lifecycle (`contract_status`) governs `employment_contract`, NOT `contract_template`. See ADR-0182.
- ADR-0133 — mobile surface boundary; template authoring stays web-only.
- ADR-0183 (proposed) — `industry_intelligence` capability for active drift remediation. Blocks Phase 5.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
