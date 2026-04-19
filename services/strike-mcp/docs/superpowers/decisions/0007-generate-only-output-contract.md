---
title: "ADR-0007: Generate-only output contract + canonical repo-root staging path"
status: accepted
created: 2026-04-18
updated: 2026-04-18
module: strike-mcp
tags: [decision, output, staging, gitignore, generate-only]
---

# ADR-0007: Generate-only output contract + canonical repo-root staging path

## Status

Accepted 2026-04-18 — ratified by System Council verdict on the strike-mcp verification work (`feat/strike-mcp-verification` branch).

## Context

During Council review of the strike-mcp verification fixes (2026-04-18), three related questions converged:

1. **Is strike-mcp allowed to write to Supabase?** Prior ADRs (0002, 0005, 0006) describe "dry-run only" as an operating mode, but no ADR declares it as a contract. The README prior to 2026-04-18 walked users through manually applying bundled SQL but never stated the principle.
2. **Where do staged SQL files live?** Until now, output landed in `services/strike-mcp/supabase/migration-staging/<slug>/` — buried inside the service directory, visually mixed with schema DDL, and inconsistent with `supabase/migrations/` (which is auto-applied by `supabase db reset`).
3. **Is staged output in git?** Per-tenant emitted SQL contains PII (names, emails, salary history) and can be 10MB+ per workspace. Committing it is a GDPR concern and bloats the repo. Not committing it destroys audit trail.

Council verdict resolved all three as one decision.

## Decision

### 1. Strike-mcp is generate-only

Strike-mcp **never writes to Supabase.** Its only output is:

- Per-entity transactional SQL files (`NN_<entity>.sql`, each wrapped in `BEGIN; ... COMMIT;`)
- Per-entity report files (`NN_<entity>.report.md`) with row counts, skipped records, warnings
- A bundled SQL file (`bundled.sql`) when the operator invokes `bundle_migration`
- Optionally a `MANIFEST.json` describing the emit run

The `verify_target_empty` tool does a **read-only** `SELECT count()` against Supabase if credentials are supplied — but this is optional. If Supabase env is not set, the tool errors cleanly and the operator proceeds to manual application without the safety check.

The operator applies bundled SQL by hand: `psql "$TARGET_SUPABASE_URL" -f <bundled.sql>`.

This formalizes the principle that was implicit in ADRs 0002, 0005, and 0006.

### 2. Canonical staging path is `supabase/bubble-data/` at repo root

All future emit runs land under `<repo>/supabase/bubble-data/<workspace-slug>/`. Set via `STRIKE_STAGING_DIR=${CLAUDE_PROJECT_DIR}/supabase/bubble-data` in `.mcp.json`.

Rationale for the split from `supabase/migrations/`:

| Path | Contents | Applied how | Git |
|---|---|---|---|
| `supabase/migrations/` | Schema DDL (tables, enums, RLS, functions) | Auto-applied by `supabase db reset` in lexicographic order | Committed |
| `supabase/bubble-data/` | Per-workspace INSERT data (Bubble → v3) | Manually applied by operator (`psql`) after human review | Gitignored (except manifests + reports) |

Mixing Bubble-imported data SQL into `supabase/migrations/` would break `supabase db reset` (it would try to re-apply tenant data as schema DDL on every reset, against empty tables with no FK parents).

### 3. Gitignore split — SQL out, attestation artifacts in

`.gitignore` rules:

```
supabase/bubble-data/**/*.sql
!supabase/bubble-data/**/MANIFEST.json
!supabase/bubble-data/**/*.report.md
```

This applies Learning 0033's emit/apply boundary:

- **Emit-time attestation** (what strike-mcp produced, which mappings, how many rows) → committed as `MANIFEST.json` + `*.report.md`. Small, PII-free, auditable.
- **Apply-time payload** (the raw INSERT statements with PII) → gitignored. Re-emittable from Bubble + current mappings.

The SQL itself is not "source of truth" — the combination of (Bubble data) × (mapping version) × (emit code) × (target schema) is. The manifests capture enough to reproduce.

### 4. Legacy staging directories remain committed

`services/strike-mcp/supabase/migration-staging/` and `migration-staging-tier2/` retain their existing committed SQL from the Wrightegaarden Tier 1 + Tier 2 migrations (April 2026). They are frozen historical record:

- Predate the gitignore policy
- Back Learning 0033 (attestation completeness)
- Referenced by strike-mcp ADRs 0004, 0005, 0006

A README in each directory marks them as archived and points future writes at `supabase/bubble-data/`.

## Consequences

### Positive

- **GDPR posture:** PII in staged SQL never lands in git. Reviewable by ops without exposure risk.
- **Repo size:** Avoids 10MB+ per-tenant SQL bloat. Scales to all 40 production workspaces.
- **Audit trail preserved:** Manifests + reports give future auditors enough to verify what was applied.
- **Boundary discipline:** Schema (versioned in git, auto-applied) and tenant data (out of git, manually applied) have separate homes.
- **Re-emit reproducibility:** Because mappings are versioned in git and Bubble is the upstream, any historical staging can be regenerated.

### Negative

- **Loss of exact payload history:** Once an emit run is garbage-collected, the exact INSERT statements are gone unless the operator archived them externally.
- **Two homes for staged output:** Until the legacy `migration-staging/` directories are retired, contributors must know which home is authoritative. Mitigated by READMEs in the legacy dirs.
- **`${CLAUDE_PROJECT_DIR}` dependency:** `.mcp.json` relies on Claude Code's interpolation of this variable. Non-Claude-Code invocations (pnpm test, CI) fall back to `services/strike-mcp/supabase/migration-staging/` — the legacy path. A safety assertion in `config.ts` catches unresolved `${...}` literals reaching the path layer.

### Neutral

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are removed from the default `.mcp.json` because `verify_target_empty` is not part of the core generate-only workflow. Operators who want the safety check can add them back locally without repo changes.

## Alternatives considered

- **Commit everything:** Rejected due to PII + size.
- **Gitignore everything under `bubble-data/`:** Rejected because it destroys the Learning 0033 attestation boundary.
- **Emit directly into `supabase/migrations/` with a numeric-prefix discipline:** Rejected because `supabase db reset` cannot distinguish schema DDL from tenant data and would try to re-apply bulk INSERTs on every reset.
- **Emit into `supabase/seeds/bubble/`:** Considered. `bubble-data/` chosen because "seeds" implies deterministic reference data, while per-tenant Bubble imports are stochastic one-offs.
- **Keep SUPABASE_URL in `.mcp.json` default:** Rejected because it makes the optional `verify_target_empty` look mandatory, which contradicts the generate-only principle.

## Compliance

- ADR-0002, ADR-0005, ADR-0006 — this ADR formalizes and extends their implicit generate-only principle.
- Learning 0033 — this ADR applies the emit/apply boundary to the git-vs-filesystem question.
- CLAUDE.md § "Database Migrations" — remains unchanged; this ADR governs a parallel (non-DDL) output path.

## Open questions

None — all Council decision points resolved in the 2026-04-18 verdict.
