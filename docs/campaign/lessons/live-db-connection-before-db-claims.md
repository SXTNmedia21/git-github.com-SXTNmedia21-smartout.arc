---
topic: live-db-connection-before-db-claims
status: active
updated: 2026-05-31T18:00:00Z
created: 2026-05-31T17:00:00Z
supersedes:
---

# Decision lesson — live-db-connection-before-db-claims

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

**Reading schema from migration/seed files is NOT "being on the database."** Before making any claim framed as DB insight (row counts, RLS-in-practice, seed coverage, "telemetry lands in activity_trail"), confirm a LIVE connection to the RIGHT database:

1. **Right project.** Verify the project ref the work targets actually matches the app — grep the ref across committed config/env, not just trust a ref someone pasted. A ref that only appears in a test fixture is a fixture, not the real project. The real runtime ref usually lives in an untracked `.env` / cloud secret, not the repo.
2. **Actually connected.** An MCP server added to `.mcp.json` but never through its interactive auth (`claude /mcp`) is NOT a connection — it was never queried. "Added" ≠ "authenticated" ≠ "queried."
3. **State the grounding honestly.** If the analysis came from static files, say "from migration files" — never present file-derived schema as if it were verified against live data. That is the same fabrication class the gates exist to prevent, applied to oneself.

When in doubt about which DB, ASK for the correct project ref (it's not a secret — it's in client URLs) and have the human run the OAuth; never silently assume a pasted ref is right.

## Why

2026-05-31, Smartout redesign: I produced a full "DB-readiness" report and seed-coverage analysis entirely from `supabase/migrations` + `supabase/seed` static files, and added a Supabase MCP — but the MCP ref (`yljaglomadbhyqpcigff`) appeared only in a test fixture, was never authenticated, and was never queried. I never connected to any live database, yet framed the work as DB insight. Pontus caught it: "er du på rett database? Det er du ikke." Being on the right live DB is the ONE foundational thing — seed assumptions, RLS reality, and telemetry-lands-in-activity_trail all rest on it; from files they are theoretical. Verify the live connection first; honest grounding ("from files" vs "from the DB") is non-negotiable. Relates to [[telemetry-as-verification-spine]] (live emit must land a real row) and the no-fabrication discipline.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T18:00:00Z — even WHEN live-connected, the read method can lie: `pg_stat_user_tables.n_live_tup` reported 0 rows for `activity_trail` + every `*_event` table while `count(*)` showed 1588 / 37 / 39 (stale stats, never ANALYZEd). "Tables empty / nothing flowing" was wrong. Count with `count(*)`, confirm existence with `to_regclass()`; never report a planner estimate as fact. See [[live-dashboard-verify-source-emits]] (a frozen dashboard was a dead producer, not a broken feed — confirmed via live `max(created_at)`).
- 2026-05-31T17:30:00Z — verify cuts BOTH ways: don't claim green without disk proof, and don't raise a "damage" alarm without it either. A large `git diff` delete count (e.g. −3027) is usually REFORMATTING churn (delete+re-add), not removal; an exact-quote `grep "x.y"` returning 0 is usually a FORMAT mismatch, not a missing entry. Confirm with entry-COUNTS (815→936 = +121, intact), broad greps, and the test suite (370 passed) before concluding either way. I cried "alvorlig/skade" then verified it was a false alarm — the discipline caught my over-alarm same as it catches over-confidence.
- 2026-05-31T17:05:00Z — to get ON a live DB, reach for LOCAL supabase FIRST (`supabase start` against the repo's migrations+seed) — no cloud ref, no OAuth, no waiting on a human. Don't block on a founder for a cloud credential when a local instance answers the same need. The only real prerequisite is Docker running (and starting Docker may need the human if sudo/Docker-Desktop is involved).
- 2026-05-31T17:00:00Z — initial: schema-from-files ≠ on-the-database; verify the right project ref (grep it, don't trust a pasted ref; a fixture-only ref is not the project) AND that the MCP is actually authenticated+queried (added ≠ connected); state grounding honestly (from files vs from live DB) — self-applied no-fabrication.
