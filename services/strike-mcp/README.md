# strike-mcp

MCP server that extracts a Bubble.io workspace and emits reviewable Supabase migration SQL — one entity at a time, under agent control.

**Strike is generate-only.** It never writes to Supabase. Its only output is:
- Per-entity `.sql` files (transactional — each wrapped in BEGIN/COMMIT)
- Per-entity `.report.md` files (row counts, skipped records, warnings)
- A bundled `bundled.sql` when the operator asks for it

Operator applies bundled SQL to target Supabase manually (`psql`).

See `docs/superpowers/specs/2026-04-07-strike-mcp-design.md` for full design.

## Output layout

All staged output lives under `$STRIKE_STAGING_DIR` (canonical: `supabase/bubble-data/` at repo root, gitignored).

```
supabase/bubble-data/
└── <workspace-slug>/
    ├── 01_workspace.sql          ← one INSERT INTO public.workspace
    ├── 01_workspace.report.md    ← rows emitted, skipped, warnings
    ├── 02_locations.sql          ← one INSERT per Bubble location
    ├── 02_locations.report.md
    └── bundled.sql               ← all ordered files, single outer transaction
```

Numeric prefix = causal migration order (matches `plan_migration` output). Slug is a stable, diacritic-stripped version of the Bubble workspace name (`Strøm Mat & Bar` → `strom-mat-bar`).

## Running locally

1. Install dependencies: `pnpm install`
2. Build: `pnpm build`
3. Copy `.mcp.json.example` to your repo root as `.mcp.json` and replace `REPLACE_FROM_1PASSWORD_...` with the real token (either inline in shell env as `BUBBLE_API_TOKEN`, or by launching Claude via `op run --env-file=.env.template -- claude`)
4. Restart Claude Code so the MCP server loads with the new env

## Tests

`pnpm test`

## Required environment

| Var | Required | Purpose |
|-----|----------|---------|
| `BUBBLE_APP_URL` | ✅ | Bubble.io app base URL (e.g. `https://smartout.io`) |
| `BUBBLE_API_TOKEN` | ✅ | Bubble Data API bearer token — from 1Password |
| `STRIKE_STAGING_DIR` | recommended | Where SQL + reports land. Default: `<service>/supabase/migration-staging/`. Canonical: `<repo>/supabase/bubble-data/` |
| `STRIKE_MAPPINGS_DIR` | optional | Where entity mappings live. Default: `<service>/mappings/` |
| `STRIKE_VAULT_SHAPES_DIR` | optional | Where `research_entity` writes narrative docs. Default: `~/dev/second-brain-v2/wiki/migration/bubble-shapes/` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | optional | Only enables `verify_target_empty`. Not needed for SQL generation. |

## Tool workflow (typical migration of one workspace)

1. `list_workspaces` → find the target workspace id
2. `inspect_workspace` → verify record counts look right
3. `research_entity` (once per entity type) → sample Bubble data, update `mappings/<entity>.json`, write narrative to vault, surface fields that need human review
4. **Operator reviews** `mappings/<entity>.json`, sets `needs_review: false` on accepted fields
5. `plan_migration` → returns ordered `migrate_*` steps with record counts
6. `migrate_workspace` then `migrate_locations` → emits staged SQL + reports per entity
7. `preview_sql` on each generated `.sql` → confirms INSERT counts, transactional wrappers, no stray DELETEs
8. `bundle_migration` → concatenates all ordered entity SQL into one `bundled.sql`
9. **Operator applies manually:** `psql "$TARGET_SUPABASE_URL" -f supabase/bubble-data/<slug>/bundled.sql`
10. Verify in Supabase that row counts match the reports

## Safety gates built into the tools

- `migrate_*` refuses to emit SQL if the mapping has any `needs_review: true` fields
- `preview_sql` flags missing `BEGIN`/`COMMIT` or presence of `DELETE`
- `bundle_migration` (when `SUPABASE_*` are set) refuses if target workspace slug already has rows, unless `acknowledgeTargetHasData: true` is passed
- No tool ever opens a write connection to Supabase

## Smoke tests

See historic smoke tests in `docs/superpowers/notes/` (Phase 1, Phase 2, Phase 3). Most recent verification: `docs/superpowers/notes/strike-mcp-verification-2026-04-18.md`.
