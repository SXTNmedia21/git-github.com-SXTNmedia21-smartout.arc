# strike-mcp

MCP server that migrates a Bubble.io workspace into Smartout v3 Supabase, one entity at a time, under agent control.

See `docs/superpowers/specs/2026-04-07-strike-mcp-design.md` for the design.

## Running locally

1. Install dependencies: `pnpm install`
2. Build: `pnpm build`
3. Set environment variables (see `.mcp.json.example`)
4. Register with Claude Code using `.mcp.json.example` as reference

## Tests

`pnpm test`

## Smoke test (Phase 1)

1. Build: `pnpm build`
2. Copy `.mcp.json.example` to your project's `.mcp.json` (or `~/.claude/.mcp.json`), replace `REPLACE_FROM_1PASSWORD` with the real Bubble API token from 1Password (`op://smartout_ai_prod/bubble/api-token` or wherever it lives).
3. Restart Claude Code so it picks up the MCP server.
4. In a Claude Code session, ask: "Use strike-mcp to list all workspaces."
5. Expected: a list of Smartout workspaces with IDs and names.
6. Then: "Inspect workspace <id>"
7. Expected: counts per entity type, possibly with errors for types whose Bubble name we guessed wrong (those get corrected in Phase 2).

## Phase 2 smoke test — research engine

1. Ensure strike-mcp is registered with Claude Code (see `.mcp.json.example`)
2. Set `STRIKE_VAULT_SHAPES_DIR` if your second-brain vault is in a different location
3. In a Claude Code session, ask:
   > "Use strike-mcp to research the workspace entity."
4. Expected: a new file at `mappings/workspace.json` and another at
   `~/dev/second-brain-v2/wiki/migration/bubble-shapes/workspace.md`
5. Open the narrative file in Obsidian. Review the field list. Mark fields as
   reviewed (edit `mappings/workspace.json` directly: set `needs_review: false`
   on entries you accept, set the `target` column name correctly).
6. Re-run: "research the workspace entity again"
7. Expected: the narrative shows "No new fields" and the reviewed entries are
   preserved unchanged.
8. Repeat for `locations`.

If research reveals Bubble type names in the registry that are wrong (e.g. the
Bubble API returns 404 for `location` but works for `org_location`), update
`src/entities.ts` with the correct names, rebuild, and re-run.

## Phase 3 smoke test — first migration

Prerequisites:
- A local Supabase instance with the v3 schema applied (from `smartout.ai/supabase/migrations`)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` set in your environment
- Reviewed `mappings/workspaces.json` and `mappings/locations.json` (no `needs_review: true` fields, both have `target_table` set)
- A test workspace in Bubble that has not been migrated yet

Procedure:
1. In Claude Code, ask: "Use strike-mcp to plan migration for workspace <id>"
2. Expected: a list of steps including migrate_workspace and migrate_locations with record counts
3. Ask: "Migrate workspace <id>"
4. Expected: a `MigrationReport` with the path to a generated `.sql` file in `supabase/migration-staging/<slug>/01_workspaces.sql`
5. Open the generated file. Verify it begins with BEGIN; ends with COMMIT; contains exactly one INSERT INTO workspaces.
6. Ask: "Migrate locations for workspace <id>"
7. Expected: another file at `02_locations.sql` with one INSERT per location
8. Ask: "Bundle migration for workspace <slug>"
9. Expected: `bundled.sql` containing both files merged with one outer transaction
10. Ask: "Preview the bundled SQL"
11. Expected: a summary with insert counts per table and no warnings
12. Manually apply the bundled SQL to the local Supabase: `psql $LOCAL_SUPABASE_URL -f supabase/migration-staging/<slug>/bundled.sql`
13. Verify in Supabase: SELECT * FROM workspaces WHERE slug = '<slug>' returns one row, SELECT count(*) FROM locations WHERE workspace_id = '<uuid>' returns the expected count
14. Re-run step 8 (bundle_migration). Expected: it refuses with "Target workspace already exists" because `verify_target_empty` now sees the data we just inserted
15. Capture all results in `docs/superpowers/notes/phase-3-smoke-test.md`
