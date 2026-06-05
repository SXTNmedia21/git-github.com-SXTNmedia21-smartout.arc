---
topic: local-supabase-multi-project-ports
status: active
updated: 2026-05-31T17:20:00Z
created: 2026-05-31T17:20:00Z
supersedes:
---

# Decision lesson — local-supabase-multi-project-ports

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

When several local Supabase stacks run on one machine (common on a dev box with multiple projects), DO NOT pick the DB container with `docker ps | grep supabase_db | head -1` — that grabs an arbitrary (often the wrong) project's container. Name the container explicitly: `supabase_db_<project_id>` (the `project_id` from `supabase/config.toml`). Query unambiguously with `docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -tA -c "<sql>"` — this hits the container directly and is address/port-independent.

Each project's CLI assigns DISTINCT host ports (no collision); confirm ownership with `docker ps --format '{{.Names}}\t{{.Ports}}'` before trusting `127.0.0.1:54322`. Verify you're on the right DB by querying a project-specific table (e.g. `select count(*) from schedule_shift`) — relation-not-found = wrong DB.

**Local Supabase needs only Docker** — no cloud project ref, no OAuth. `supabase start` from the worktree brings up the stack from the repo's migrations+seed. "supabase start is already running" means the stack is up — just query it.

## Why

2026-05-31, Smartout dev box: three stacks were up at once — `smartout.ai` (DB 54322, API 54321, Studio 54323), `habit-tracker` (DB 55322, API 55321), `sxtn-test-project` (DB 54332). I queried `supabase_db | head -1` and hit **habit-tracker** by accident — every smartout table came back "does not exist", and I nearly reported "wrong database / migrations didn't apply" when in fact smartout's stack was healthy; I'd just named the wrong container. The fix is to always pin `supabase_db_<project_id>` and verify with a project-specific table. Self-applied no-fabrication: the "wrong DB" was my sloppy selection, not reality — confirm before concluding. Relates to [[live-db-connection-before-db-claims]].

## Reference — Smartout local stack

|                   | DB port | API   | Studio |
| ----------------- | ------- | ----- | ------ |
| smartout.ai       | 54322   | 54321 | 54323  |
| habit-tracker     | 55322   | 55321 | —      |
| sxtn-test-project | 54332   | —     | —      |

`docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres -tA -c "<sql>"` — the canonical way to query smartout's live local DB. `activity_trail` (telemetry sink) exists → telemetry-lands-in-DB is testable here.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T18:15:00Z — running apps/web against local DB, two setup traps: (1) **don't copy `.env.template` raw** — it holds `op://vault/...` 1Password references meant for `op run`; copied literally they make URL vars (e.g. NEXT_PUBLIC_WEB_APP_URL) the string "op://…", and middleware redirects to `https://op/`. Write a CLEAN `apps/web/.env.local` with real localhost values (SUPABASE_URL=http://127.0.0.1:54321 + local anon/service from `supabase status -o env`, WEB_APP_URL=http://localhost:3060, ROOT_DOMAIN=localhost, dummy DOCUSEAL_WEBHOOK_SECRET≥16). Most env.ts vars are `.optional()`; only a few are required. (2) **Workspace packages must be BUILT first** — their package.json `exports` point to `./dist/index.js`; with no `dist/`, Next (even with transpilePackages) throws `Module not found: Can't resolve '@smartout/telemetry'`. Run `pnpm turbo run build --filter=web^...` to build web's deps before `pnpm dev`. (3) Preflight (`scripts/preflight.sh`) checks SHELL env, not `.env.local` — export the supabase vars in the shell, or it blocks `next dev`.
- 2026-05-31T17:20:00Z — initial: pin `supabase_db_<project_id>` (never `grep supabase_db | head -1`); verify with a project-specific table; smartout=54322/54321/54323, habit-tracker=553xx; local supabase needs only Docker.
