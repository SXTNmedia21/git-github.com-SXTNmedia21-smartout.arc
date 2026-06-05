---
title: Handbook Domain — Telemetry Implementation Plan
status: draft
updated: 2026-05-31
created: 2026-05-31
module: handbook
tags: [plan, telemetry, handbook]
---

# Handbook Telemetry — Implementation Plan

## Scope

Wire telemetry for every meaningful user interaction in the handbook domain. Noop elements (pure navigation, decorative, mock-toast only) are excluded from instrumentation. All real DB mutations must have an event. Missing events must be added to `packages/telemetry/src/registry.ts` before emitting.

---

## Phase 1 — Registry Additions (no code changes, just schema)

Add the following 10 events to `registry.ts`. Each follows the existing handbook section pattern.

| Event                                     | Category   | Destinations                          | Priority |
| ----------------------------------------- | ---------- | ------------------------------------- | -------- |
| `handbook.create_initiated`               | `handbook` | posthog, activity_trail               | P1       |
| `handbook.wizard_started`                 | `handbook` | posthog, activity_trail               | P1       |
| `handbook.wizard_block_accepted`          | `handbook` | posthog, activity_trail               | P1       |
| `handbook.chapter_archived`               | `handbook` | posthog, activity_trail, engine_event | P1       |
| `handbook.ai_suggestion_accepted`         | `handbook` | posthog, activity_trail               | P1       |
| `handbook.search_executed`                | `handbook` | posthog                               | P2       |
| `handbook.wizard_block_rewrite_requested` | `handbook` | posthog                               | P2       |
| `handbook.ai_suggestion_dismissed`        | `handbook` | posthog                               | P2       |
| `handbook.gap_actioned`                   | `handbook` | posthog, activity_trail               | P2       |
| `handbook.gap_dismissed`                  | `handbook` | posthog                               | P2       |

### Interface shape examples (add to registry.ts)

```typescript
// ─── Handbook Extended (Bibliotek v1) ───────────────
export interface HandbookCreateInitiated extends BaseEvent {
  event: "handbook.create_initiated";
  properties: {
    data: { entry_point: "sidebar" | "dashboard" | "chapter_header" | "empty_chapter" };
  };
}
export interface HandbookWizardStarted extends BaseEvent {
  event: "handbook.wizard_started";
  properties: {
    data: { mode: "guided" | "draft" | "suggestion"; book_id: string; chapter_key?: string };
  };
}
export interface HandbookWizardBlockAccepted extends BaseEvent {
  event: "handbook.wizard_block_accepted";
  properties: { data: { block_id: string; conf: "high" | "med" | "low" } };
}
export interface HandbookChapterArchived extends BaseEvent {
  event: "handbook.chapter_archived";
  properties: { data: { chapter_key: string } };
}
export interface HandbookAiSuggestionAccepted extends BaseEvent {
  event: "handbook.ai_suggestion_accepted";
  properties: { data: { chapter_key: string } };
}
export interface HandbookSearchExecuted extends BaseEvent {
  event: "handbook.search_executed";
  properties: { data: { query_length: number; result_count: number } };
}
```

---

## Phase 2 — Seed Data (E2E Unblock)

**BLOCKER:** `handbook_chapter` table has 0 rows. E2E tests cannot exercise the handbook without seed data.

### Seed requirements

- ≥3 chapters, plain-text content (NOT TipTap JSON)
- Use chapter_keys from `CHAPTERS` definition: `identity-mission`, `daily-operations`, `safety-compliance`
- SQL seed or migration file; do NOT use TipTap JSON format
- Add to `supabase/seed.sql` or a dedicated `supabase/seeds/handbook-chapters.sql`

Example:

```sql
INSERT INTO handbook_chapter (workspace_id, chapter_key, title, content, updated_by)
VALUES
  ('__TEST_WORKSPACE_ID__', 'identity-mission', 'Identitet og formål',
   '"Bistro Nord ble grunnlagt i 2018 med formål om å levere autentisk norsk matkjøkken. Vi er stolt av vår bærekraftige drift og lokal innkjøpspraksis."',
   null),
  ('__TEST_WORKSPACE_ID__', 'daily-operations', 'Daglig drift',
   '"Åpningstider: Mandag–Fredag 11–22, lørdag 12–23. Vaktansvarlig er alltid tilgjengelig på internt nummer."',
   null),
  ('__TEST_WORKSPACE_ID__', 'safety-compliance', 'Sikkerhet og etterlevelse',
   '"HACCP-plan revideres halvårlig. Temperaturlogging skjer ved åpning og stenging."',
   null);
```

---

## Phase 3 — Emit Wiring (frontend)

### 3a. Already wired (verify only)

- `handbook chapter_opened` — `ChapterReader.tsx` useEffect (confirmed)
- `handbook chapter_saved` — `use-handbook-content.ts` onSuccess (confirmed)
- `governance.content_updated` — `update-handbook-chapter-action.ts` (confirmed)

### 3b. Wire `handbook.create_initiated`

- Location: `handbook.jsx` `HbSide` — `nav.create()` handler
- Also: `HbDashboard` D5, `HbHandbookDetail` H4 + H6
- Emit with `entry_point` discriminator

### 3c. Wire `handbook.wizard_started`

- Location: `HbCreate.start()` when method = "veiviser" or "utkast"
- Also: `HbCreate.startSuggestion()`
- Also: HMS Veiviser buttons in `HbDashboard` D4 and `HbHandbookDetail` H3

### 3d. Wire `handbook.wizard_block_accepted`

- Location: `HbWizard` block confirm button `onClick`

### 3e. Wire `handbook.ai_suggestion_accepted` / `dismissed`

- Location: `HbEditor` AI card "Godta" and "Avvis" buttons

### 3f. Wire `handbook.search_executed`

- Location: `HbSide` search input `onChange` with debounce, emit when `ql.length >= 2`
- Include `result_count` from `results.length`

### 3g. Wire `handbook.chapter_archived`

- Location: `HbEditor` archive modal confirm
- Requires a server action to be built first (see Phase 4)

---

## Phase 4 — Missing Backend (Archive Action)

The archive flow in `HbEditor` is mock-toast only. To make it real:

1. Create `archive-handbook-chapter-action.ts` in `governance/_actions/`
2. Server action: set a `status` column (or soft-delete) on `handbook_chapter`, emit `governance.content_updated` with `trigger: "delete"`
3. Emit `handbook.chapter_archived` client-side on success
4. Note: `handbook_chapter` schema may need a `status` column — check migration before coding

---

## Phase 5 — State Machine Persistence (Approval Flow)

The editor's primary button (draft → review → approved) drives visual state only. To persist:

1. Add `status` column to `handbook_chapter` (migration)
2. Either extend `upsertHandbookChapterAction` to accept `status`, or create `updateHandbookChapterStatusAction`
3. `useHandbookSave` already calls upsert onSuccess — extend to pass status field

---

## Out of Scope (v1)

- `workspace_doc_chunk` AI semantic search — DESCOPED to v2 (needs OpenRouter key + ingest pipeline)
- Multi-user conflict detection (E22/E23) — mock-only, no server hook
- Version restore (E24) — mock-only
- Comment persistence (E21) — local state only
- Settings toggles (SE4, SE7) — mock-only, no workspace settings table wired yet
- Template "Bruk" (SE3) — mock-only

---

## Gate Criteria

| Gate                    | Condition                                                      |
| ----------------------- | -------------------------------------------------------------- |
| E2E unblocked           | ≥3 seed chapters in `handbook_chapter`                         |
| Telemetry complete (P1) | 5 missing P1 events added to registry + emitted                |
| Mutations covered       | All DB writes fire `governance.content_updated` + domain event |
| AI search               | Client-side keyword search working; pgvector DESCOPED to v2    |
