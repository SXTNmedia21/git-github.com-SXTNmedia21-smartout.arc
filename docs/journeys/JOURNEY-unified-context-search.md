---
title: "User Journeys — unified-context-search"
status: done
updated: 2026-03-06
created: 2026-03-06
module: search
tags: [search, context, cmdk, journey]
---

# User Journeys — Unified Context Search

## Journey: Employee searches for knowledge via CmdK

**Precondition:** Employee is logged in, on any dashboard page.

1. Employee presses `Cmd+K` (or `Ctrl+K`) → System opens CmdK palette overlay
2. Employee types `? allergen` → System parses `?` prefix as knowledge mode
3. System calls `/api/search?workspaceId=X&q=?allergen` → Orchestrator runs instance + semantic + dependency search in parallel
4. Results grouped by category (Knowledge, Policies) appear in palette → Employee sees matching policies/protocols
5. Employee clicks a result → System navigates to the deep link (e.g. `/dashboard/governance/policies/UUID`)

**Postcondition:** Employee landed on the relevant knowledge page.

**Error paths:**

- No results found → Palette shows empty state message
- API error → Palette shows graceful error, does not crash
- No workspace context → Search returns 400, palette handles gracefully

---

## Journey: Manager searches for people via CmdK

**Precondition:** Manager is logged in, on any dashboard page.

1. Manager presses `Cmd+K` → Palette opens
2. Manager types `@ Maria` → System parses `@` prefix as people mode
3. System calls `/api/search?workspaceId=X&q=@Maria` → Orchestrator runs `search_instance` RPC
4. Results show matching profiles with name, role, and deep link
5. Manager clicks profile → Navigates to `/dashboard/people/UUID`

**Postcondition:** Manager viewing the employee's profile page.

**Error paths:**

- No matching profiles → Empty people group
- Multiple matches → All shown, capped at 5 per group

---

## Journey: Admin uses command mode via CmdK

**Precondition:** Admin is logged in, on any dashboard page.

1. Admin presses `Cmd+K` → Palette opens
2. Admin types `> schedule` → System parses `>` prefix as commands mode
3. Palette shows navigation commands matching "schedule" (e.g. "Gå til Vaktplan")
4. Admin selects command → System navigates to `/dashboard/schedule`

**Postcondition:** Admin on the schedule page.

**Error paths:**

- No matching commands → Palette shows no results
- Palette dismissed with Escape → No navigation occurs

---

## Journey: Admin triggers global search (all modes)

**Precondition:** Admin is logged in.

1. Admin presses `Cmd+K` → Palette opens
2. Admin types `cleaning` (no prefix) → System uses "all" mode
3. Orchestrator runs all 3 search modes in parallel:
   - Instance: searches profiles for "cleaning" (e.g. "Cleaning Manager")
   - Semantic: searches workspace_doc_chunk embeddings (returns empty until wiring complete)
   - Dependency: searches policy→protocol→procedure graph for "cleaning"
4. Results grouped as People, Knowledge, Policies → Admin sees cross-domain results
5. Admin clicks a policy result → Navigates to governance page

**Postcondition:** Admin viewing the relevant resource.

**Error paths:**

- All modes return empty → Palette shows "Ingen resultater"
- One mode fails, others succeed → Failed mode returns empty group, other results shown

---

## Journey: System loads bootstrap context on page load

**Precondition:** User is authenticated with workspace context.

1. Client calls `GET /api/context/bootstrap?workspaceId=X&profileId=Y&pageId=schedule`
2. Server builds deterministic context:
   - SystemContext: page_id, workspace_id, role, permissions
   - IntelligenceSnapshot: readiness_score, verification_flags
   - SearchHints: recent_searches, suggested_queries
3. Response cached with `Cache-Control: private, max-age=30, stale-while-revalidate=120`
4. Client receives bootstrap payload → UI can render role-appropriate content

**Postcondition:** Client has server-verified context for the current page.

**Error paths:**

- Missing workspaceId or profileId → 400 error with message
- Invalid profile → Builder returns default/empty values

---

## Journey: Ingestion pipeline indexes workspace content

**Precondition:** Workspace has handbook chapters, policies, protocols, procedures in Supabase.

1. Operator runs `pnpm --filter @smartout/docs-pipeline ingest-workspace --workspace-id UUID`
2. Pipeline fetches all handbook_chapter, policy, protocol, procedure rows for workspace
3. Each row chunked using existing chunker strategy
4. Embeddings generated for each chunk
5. Chunks upserted to workspace_doc_chunk with content_hash dedup
6. On re-run: unchanged content skipped (hash match), only new/changed content processed

**Postcondition:** workspace_doc_chunk table populated, semantic search enabled for this workspace.

**Error paths:**

- Invalid workspace_id → No rows fetched, pipeline logs warning
- Embedding API failure → Chunk stored with null embedding, semantic search skips it
- `--dry-run` flag → Logs plan without writing to DB
