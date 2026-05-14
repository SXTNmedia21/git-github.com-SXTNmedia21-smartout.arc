---
title: "HANDOFF — People Page Polish Tier-1"
status: in_progress
updated: 2026-05-14
created: 2026-05-14
module: people
tags: [handoff, polish, page-polish, performance, people, tier1]
---

# HANDOFF — People Page Polish Tier-1

## What Was Built and Why

Polish-tier1 for `/dashboard/people` — the employee roster page. Applied the 8-phase SKILL.md workflow proven on `/dashboard/schedule`. The people page is architecturally simpler than schedule (19 components vs 50, RSC-fetched, no client-mount TanStack queries), so performance fixes were minimal — the main value was motion token compliance, Botsson tool registration, and site-map entry.

## Blocker: Docker Desktop Down

LCP baseline measurement (`apps/e2e/scripts/people-perf-baseline.ts`) requires Supabase local, which requires Docker Desktop. Docker Desktop was not running during this sortie.

**Resume path:**
1. Start Docker Desktop from Windows
2. `npx supabase start` from repo root
3. `op run --env-file=.env.template -- pnpm tsx apps/e2e/scripts/people-perf-baseline.ts`
4. Record cold + warm LCP in `.claude/page-polish/dashboard-people.run.yml`
5. Insert `page_knowledge` row (see Phase 6 DB Sync below)
6. If cold LCP < 1500ms → flip `lighthouse_lcp_under_1500ms: true` + `verified: true`
7. If cold LCP >= 1500ms → apply perf fixes (likely none needed given architecture), retest

## Commits on This Branch

| SHA | Subject |
|---|---|
| `7c9551735` | chore(perf): add people-perf-baseline.ts script |
| `b7e0093e1` | chore(page-polish): scaffold dashboard-people run.yml |
| `f90a89a76` | feat(people): apply page-polish tier-1 phases 2+4-8 |

## Decisions Made

### D1 — loading.tsx → null

Same decision as schedule (D1 there). `page.tsx` is a full RSC that fetches all people data server-side. The "loading" window is the RSC streaming phase — no role-specific skeleton can be rendered correctly before the RSC resolves the current user's role. `loading.tsx → null` eliminates the mismatch flash with zero LCP cost (the RSC is fast enough that the null flash is imperceptible in prod).

### D2 — Motion token replacement

`invite-member-dialog.tsx` had 5 raw spring sites, `StaffEventDialog.tsx` had 1. All replaced:
- `{ stiffness: 35, damping: 22, mass: 2.2 }` → `...motionTokens.spring` (exact match)
- `{ stiffness: 40, damping: 24, mass: 1.6 }` → `...motionTokens.springSnappy` (closest standard token; `springSnappy` = 45/24/2 — minor visual difference, semantically correct for "snappy section entry")

Both `invite-member-dialog.tsx` and `StaffEventDialog.tsx` import `motion as motionTokens` from `@smartout/design-tokens`.

### D3 — People voice tools: read-only only

Write operations (role change, deactivate, invite) require explicit UI confirmation due to C4 authority gate. Voice cannot bypass the confirmation step. The 4 registered tools are all read-only: `getPeopleState`, `getEmployeeInfo`, `getPeopleByDepartment`, `getReadinessSummary`. Write tools deferred to a future sortie when C4-voice interaction pattern is established.

### D4 — Telemetry: Wave-2 TODOs intentionally deferred

`TipsregelModal` and `LonnsprofilSection` in `apps/web/src/app/dashboard/people/[id]/_components/` have `TODO (Agent V): emit...` comments. These are payroll-related sub-components deferred to Wave 2. Not blocking this sortie — the run.yml `telemetry_emit_per_mutation` covers the main people mutation surface (people-actions.ts, employment-contract-actions.ts, staff-event-actions.ts).

## What Compiles (Verified)

Typecheck passed cleanly (3 independent runs, all exit code 0) after all changes:
- New files: `people-tool-definitions.ts`, `use-people-voice-tools.ts`, `people-voice-tools-bridge.tsx`
- Modified: `invite-member-dialog.tsx` (motionTokens import + spring replacements), `people-page-client.tsx` (bridge wired), `StaffEventDialog.tsx` (motionTokens spring), `loading.tsx` (null), `.botsson/site-map.json` (entry added)

## Known Issues / Debt

1. **LCP measurement missing** — Docker Desktop down. Resume path described above.
2. **page_knowledge DB row not inserted** — Deferred. Run `supabase` local, then insert with workspace_id=NULL (platform default).
3. **Wave-2 telemetry** — TipsregelModal + LonnsprofilSection TODOs not wired. Not blocking tier-1 checklist.
4. **Write voice tools** — Not implemented (C4 constraint). Could be a future tier-2 sortie if voice-confirm pattern is established.

## Phase 6 DB Sync (When Docker Is Up)

Insert the following into `page_knowledge` table (Supabase Studio or via script):

```sql
INSERT INTO page_knowledge (route, header, description, empty_copy, error_copy, components, api_routes, datapoints, harness_tools, workspace_id)
VALUES (
  '/dashboard/people',
  'Ansatte',
  'Oversikt over alle ansatte i workspacet: roller, avdelinger, beredskapsscorer og kontraktsstatus. Inviter nye teammedlemmer, se pågående invitasjoner og administrer personalprofiler.',
  'Ingen ansatte ennå. Bruk «Inviter ansatt»-knappen for å legge til ditt første teammedlem.',
  'Personaloversikten kunne ikke lastes. Sjekk nettverket og last siden på nytt.',
  19,
  '[{"method":"SERVER_ACTION","path":"people-actions.ts","role":"admin+manager"},{"method":"SERVER_ACTION","path":"employment-contract-actions.ts","role":"admin"},{"method":"SERVER_ACTION","path":"staff-event-actions.ts","role":"admin"}]',
  '[{"name":"people","source_table":"profile","type":"query"},{"name":"invitations","source_table":"workspace_invitation","type":"query"},{"name":"departments","source_table":"department","type":"query"},{"name":"readiness","source_table":"policy/protocol completion","type":"query"},{"name":"contracts","source_table":"employment_contract","type":"query"}]',
  '[{"key":"getPeopleState"},{"key":"getEmployeeInfo"},{"key":"getPeopleByDepartment"},{"key":"getReadinessSummary"}]',
  NULL
)
ON CONFLICT (route, workspace_id) DO UPDATE SET
  header = EXCLUDED.header,
  description = EXCLUDED.description,
  empty_copy = EXCLUDED.empty_copy,
  error_copy = EXCLUDED.error_copy,
  components = EXCLUDED.components,
  api_routes = EXCLUDED.api_routes,
  datapoints = EXCLUDED.datapoints,
  harness_tools = EXCLUDED.harness_tools,
  updated_at = now();
```

Then flip `page_knowledge_db_synced: true` in `dashboard-people.run.yml`.

## Next Steps

1. Start Docker Desktop → `npx supabase start` → run baseline → record LCP → flip checklist items
2. If LCP passes: set `verified: true`, `status: done` in run.yml, flip JOURNEY status to `verified`
3. Run `close-feature.sh` to merge `feat/people-page-polish-tier1` → `development`
4. Optional tier-2 ideas: next/image priority on avatar column (potential LCP candidate), C4-voice write tools, Wave-2 payroll telemetry
