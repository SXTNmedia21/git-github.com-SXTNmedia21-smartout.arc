---
title: Handbook Domain — Telemetry Map
status: draft
updated: 2026-05-31
created: 2026-05-31
module: handbook
tags: [telemetry, handbook, bibliotek, mapping]
---

# Handbook Domain — Telemetry Map

## Design Sources Scanned

| File                  | Components                                                            |
| --------------------- | --------------------------------------------------------------------- |
| `handbook.jsx`        | `HandbookApp` (router), `HbSide` (sidebar)                            |
| `handbook-shared.jsx` | `HbModal`, `HbSwitch`, `HbOwnerPicker` (primitives, no direct events) |
| `handbook-views.jsx`  | `HbDashboard`, `HbHandbookDetail`, `HbGaps`, `HbWizard`, `HbSettings` |
| `handbook-editor.jsx` | `HbEditor` (full document editor)                                     |
| `handbook-create.jsx` | `HbCreate` (method chooser modal)                                     |

---

## Interactive Elements — Complete Inventory (36 total)

### HbSide / Sidebar (handbook.jsx)

| #   | Element                             | Action                                | Mutation? | Telemetry Event                       | Registry? | Hook                                                  |
| --- | ----------------------------------- | ------------------------------------- | --------- | ------------------------------------- | --------- | ----------------------------------------------------- |
| S1  | "Tilbake til Smartout" button       | `openExit` → leaves handbook mode     | No        | noop                                  | —         | —                                                     |
| S2  | Health ring button                  | `nav.dashboard()`                     | No        | noop                                  | —         | —                                                     |
| S3  | Search input (typing)               | `setQ(e.target.value)`                | No        | `handbook.search_executed` (MISSING)  | No        | `searchHandbook` tool (client-side keyword, existing) |
| S4  | Search clear (×) button             | `setQ("")`                            | No        | noop                                  | —         | —                                                     |
| S5  | Search result row click             | `nav.doc(b.id, c.id, d.id); setQ("")` | No        | `handbook chapter_opened`             | YES       | —                                                     |
| S6  | "Nytt dokument" button (nav)        | `nav.create()`                        | No        | `handbook.create_initiated` (MISSING) | No        | —                                                     |
| S7  | Handbook book toggle (head button)  | `setOpenBookId / nav.book(b.id)`      | No        | `handbook chapter_opened`             | YES       | ChapterReader.tsx emits on open                       |
| S8  | Chapter row in tree                 | `nav.book(b.id, c.id)`                | No        | `handbook chapter_opened`             | YES       | ChapterReader.tsx emits on navigation                 |
| S9  | "Mangler & forbedringer" nav button | `nav.gaps()`                          | No        | noop                                  | —         | —                                                     |
| S10 | "Innstillinger" nav button          | `nav.settings()`                      | No        | noop                                  | —         | —                                                     |
| S11 | Mr. Botsson button (footer)         | `openBot`                             | No        | noop                                  | —         | —                                                     |

### HbDashboard (handbook-views.jsx)

| #   | Element                          | Action                               | Mutation? | Telemetry Event                       | Registry? | Hook          |
| --- | -------------------------------- | ------------------------------------ | --------- | ------------------------------------- | --------- | ------------- |
| D1  | Book card click                  | `nav.book(book.id)`                  | No        | `handbook chapter_opened`             | YES       | ChapterReader |
| D2  | "Se alle" link (gaps panel)      | `nav.gaps()`                         | No        | noop                                  | —         | —             |
| D3  | Gap row click                    | `nav.gaps()`                         | No        | noop                                  | —         | —             |
| D4  | "Fortsett HMS-veiviser" button   | `nav.wizard("hms", {mode:"guided"})` | No        | `handbook.wizard_started` (MISSING)   | No        | —             |
| D5  | "Nytt dokument" quick button     | `nav.create()`                       | No        | `handbook.create_initiated` (MISSING) | No        | —             |
| D6  | "Eksporter håndbok (PDF)" button | `nav.settings()`                     | No        | noop                                  | —         | —             |

### HbHandbookDetail (handbook-views.jsx)

| #   | Element                                | Action                               | Mutation? | Telemetry Event                       | Registry? | Hook          |
| --- | -------------------------------------- | ------------------------------------ | --------- | ------------------------------------- | --------- | ------------- |
| H1  | Breadcrumb "Bibliotek"                 | `nav.dashboard()`                    | No        | noop                                  | —         | —             |
| H2  | "Eksporter" button                     | `toast(...)`                         | No        | noop                                  | —         | —             |
| H3  | HMS "Veiviser" button                  | `nav.wizard("hms", {mode:"guided"})` | No        | `handbook.wizard_started` (MISSING)   | No        | —             |
| H4  | Chapter "Dokument" add button (header) | `nav.create(book.id, ch.id)`         | No        | `handbook.create_initiated` (MISSING) | No        | —             |
| H5  | DocRow open button                     | `nav.doc(b.id, c.id, d.id)`          | No        | `handbook chapter_opened`             | YES       | ChapterReader |
| H6  | "Lag dokument" button (empty chapter)  | `nav.create(book.id, ch.id)`         | No        | `handbook.create_initiated` (MISSING) | No        | —             |

### HbGaps (handbook-views.jsx)

| #   | Element                            | Action                     | Mutation?      | Telemetry Event                    | Registry? | Hook |
| --- | ---------------------------------- | -------------------------- | -------------- | ---------------------------------- | --------- | ---- |
| G1  | Breadcrumb "Bibliotek"             | `nav.dashboard()`          | No             | noop                               | —         | —    |
| G2  | Gap action button (e.g. "Opprett") | `setResolved(...)` + toast | No (mock only) | `handbook.gap_actioned` (MISSING)  | No        | —    |
| G3  | "Avvis" button per gap             | `setResolved(...)` + toast | No (mock only) | `handbook.gap_dismissed` (MISSING) | No        | —    |

### HbWizard (handbook-views.jsx)

| #   | Element                                      | Action                         | Mutation?          | Telemetry Event                                     | Registry? | Hook                                              |
| --- | -------------------------------------------- | ------------------------------ | ------------------ | --------------------------------------------------- | --------- | ------------------------------------------------- |
| W1  | Breadcrumb "Bibliotek"                       | `nav.dashboard()`              | No                 | noop                                                | —         | —                                                 |
| W2  | Breadcrumb book name                         | `nav.book(book.id)`            | No                 | noop                                                | —         | —                                                 |
| W3  | "Bekreft og fortsett" / "Fyll inn" per block | `setAccepted(...)` + toast     | No (mock only)     | `handbook.wizard_block_accepted` (MISSING)          | No        | —                                                 |
| W4  | "Skriv om" dropdown button                   | `setRewriteFor(...)`           | No                 | noop                                                | —         | —                                                 |
| W5  | Rewrite option selection                     | `doRewrite(b, opt)`            | No (mock only)     | `handbook.wizard_block_rewrite_requested` (MISSING) | No        | —                                                 |
| W6  | "Lagre som utkast" button                    | `toast(...)` + `nav.book(...)` | **YES — intended** | `handbook chapter_saved`                            | YES       | `useHandbookSave` (via `use-handbook-content.ts`) |

### HbSettings (handbook-views.jsx)

| #   | Element                               | Action                  | Mutation?      | Telemetry Event                           | Registry? | Hook |
| --- | ------------------------------------- | ----------------------- | -------------- | ----------------------------------------- | --------- | ---- |
| SE1 | Breadcrumb "Bibliotek"                | `nav.dashboard()`       | No             | noop                                      | —         | —    |
| SE2 | "Ny mal" link                         | `toast(...)`            | No (mock only) | noop                                      | —         | —    |
| SE3 | "Bruk" template button                | `toast(...)`            | No (mock only) | noop                                      | —         | —    |
| SE4 | Notification toggle (×4)              | `setNotif(...)` + toast | No (mock only) | `handbook.notification_toggled` (MISSING) | No        | —    |
| SE5 | "Eksporter alle håndbøker (PDF)"      | `toast(...)`            | No (mock only) | noop                                      | —         | —    |
| SE6 | "Eksporter revisjonslogg"             | `toast(...)`            | No (mock only) | noop                                      | —         | —    |
| SE7 | "Arkiver utdaterte automatisk" toggle | `toast(...)`            | No (mock only) | noop                                      | —         | —    |
| SE8 | "Vis arkiverte dokumenter" button     | `toast(...)`            | No (mock only) | noop                                      | —         | —    |

### HbEditor (handbook-editor.jsx)

| #   | Element                                                                                                    | Action                                           | Mutation?             | Telemetry Event                              | Registry? | Hook              |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------- | -------------------------------------------- | --------- | ----------------- |
| E1  | Breadcrumb "Bibliotek"                                                                                     | `nav.dashboard()`                                | No                    | noop                                         | —         | —                 |
| E2  | Breadcrumb book name                                                                                       | `nav.book(b.id)`                                 | No                    | noop                                         | —         | —                 |
| E3  | "Versjoner" button                                                                                         | `setDrawer(true)`                                | No                    | noop                                         | —         | —                 |
| E4  | "Eksport PDF" button                                                                                       | `toast(...)`                                     | No (mock only)        | noop                                         | —         | —                 |
| E5  | Archive (danger) button                                                                                    | `setModal("archive")`                            | No (triggers modal)   | noop                                         | —         | —                 |
| E6  | Document title (contentEditable)                                                                           | `touch()` (auto-save indicator)                  | No (mock only)        | noop                                         | —         | —                 |
| E7  | Document body (contentEditable)                                                                            | `touch()`                                        | No (mock only)        | noop                                         | —         | —                 |
| E8  | "Forbedre med Botsson" toggle                                                                              | `setShowAi(...)`                                 | No                    | noop                                         | —         | —                 |
| E9  | "Oversett" button                                                                                          | `toast(...)`                                     | No (mock only)        | noop                                         | —         | —                 |
| E10 | "Forenkle" button                                                                                          | `toast(...)`                                     | No (mock only)        | noop                                         | —         | —                 |
| E11 | AI suggestion "Godta" button                                                                               | `setAiResolved(true)` + `touch()`                | No (mock only)        | `handbook.ai_suggestion_accepted` (MISSING)  | No        | —                 |
| E12 | AI suggestion "Avvis" button                                                                               | `setAiResolved(true)` + toast                    | No (mock only)        | `handbook.ai_suggestion_dismissed` (MISSING) | No        | —                 |
| E13 | AI suggestion "Rediger" button                                                                             | `toast(...)`                                     | No                    | noop                                         | —         | —                 |
| E14 | Primary action button (state-machine: "Send til godkjenning" / "Godkjenn" / "Start revisjon" / "Publiser") | `setState(...)` / `setModal("approve")`          | **YES — intended**    | `handbook chapter_saved`                     | YES       | `useHandbookSave` |
| E15 | "Be om endringer" button (review state)                                                                    | `setState("draft")` + toast                      | No (mock only)        | noop                                         | —         | —                 |
| E16 | Owner picker trigger                                                                                       | `setPickOwner(...)`                              | No                    | noop                                         | —         | —                 |
| E17 | Owner selection in picker                                                                                  | `setOwner(p)` + toast                            | No (mock only)        | noop                                         | —         | —                 |
| E18 | Related document row click                                                                                 | `toast(...)`                                     | No (mock only)        | noop                                         | —         | —                 |
| E19 | Attachment row click                                                                                       | `toast(...)`                                     | No (mock only)        | noop                                         | —         | —                 |
| E20 | "+ Legg til" attachment button                                                                             | `toast(...)`                                     | No (mock only)        | noop                                         | —         | —                 |
| E21 | Comment submit button                                                                                      | `addComment()`                                   | No (local state only) | noop                                         | —         | —                 |
| E22 | Conflict "Sammenlign" button                                                                               | `setConflict(false)` + toast                     | No (mock only)        | noop                                         | —         | —                 |
| E23 | Conflict "Overta" button                                                                                   | `setConflict(false)` + toast                     | No (mock only)        | noop                                         | —         | —                 |
| E24 | Version drawer restore button                                                                              | `setDrawer(false)` + toast                       | No (mock only)        | noop                                         | —         | —                 |
| E25 | Modal "Godkjenn og publiser" confirm                                                                       | `setState("approved")` + `setJustApproved(true)` | **YES — intended**    | `handbook chapter_saved`                     | YES       | `useHandbookSave` |
| E26 | Modal "Arkiver" confirm                                                                                    | `toast("Dokument arkivert")` + `nav.book()`      | **YES — intended**    | `handbook.chapter_archived` (MISSING)        | No        | none found        |

### HbCreate (handbook-create.jsx)

| #   | Element                      | Action                                   | Mutation? | Telemetry Event                     | Registry? | Hook |
| --- | ---------------------------- | ---------------------------------------- | --------- | ----------------------------------- | --------- | ---- |
| C1  | Close (×) button             | `onClose()`                              | No        | noop                                | —         | —    |
| C2  | Book selector buttons (3×)   | `setBk(b.id); setChId(null)`             | No        | noop                                | —         | —    |
| C3  | Chapter <select>             | `setChId(e.target.value)`                | No        | noop                                | —         | —    |
| C4  | Title input                  | `setTitle(e.target.value)`               | No        | noop                                | —         | —    |
| C5  | Method card "Veiviser"       | `start("veiviser")` → `nav.wizard(...)`  | No        | `handbook.wizard_started` (MISSING) | No        | —    |
| C6  | Method card "Botsson utkast" | `start("utkast")` → `nav.wizard(...)`    | No        | `handbook.wizard_started` (MISSING) | No        | —    |
| C7  | Method card "Manuelt"        | `start("manuelt")` → `nav.doc(...)`      | No        | noop                                | —         | —    |
| C8  | Botsson suggestion row       | `startSuggestion(s)` → `nav.wizard(...)` | No        | `handbook.wizard_started` (MISSING) | No        | —    |
| C9  | "Avbryt" button              | `onClose()`                              | No        | noop                                | —         | —    |

---

## Summary by Category

| Category                                                    | Count                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Total interactive elements                                  | 36 (S:11, D:6, H:6, G:3, W:6, SE:8, E:26 → design has richer editor; counting logical interactions above) |
| Noop (navigation/UI only, no mutation, no telemetry needed) | 22                                                                                                        |
| Already mapped with existing registry event                 | 7 (chapter_opened × 5, chapter_saved × 2)                                                                 |
| Events MISSING from registry                                | 10 (see below)                                                                                            |
| Real mutations (DB write)                                   | 3 (save chapter: create/update, archive: not yet wired)                                                   |
| Hooks found covering mutations                              | 2 (`useHandbookSave` → `upsertHandbookChapterAction`, `useHandbookChapters` for read)                     |

---

## Registry Status — Existing Events

| Event                        | Registry? | Destinations                          | Already Emitted In                                     |
| ---------------------------- | --------- | ------------------------------------- | ------------------------------------------------------ |
| `handbook chapter_saved`     | YES       | posthog, activity_trail               | `use-handbook-content.ts` `onSuccess`                  |
| `handbook chapter_opened`    | YES       | posthog, logger, activity_trail       | `ChapterReader.tsx` `useEffect`                        |
| `governance.content_updated` | YES       | posthog, activity_trail, engine_event | `update-handbook-chapter-action.ts` (on insert+update) |

---

## Missing Events (to be added to registry)

| Event Name                                | Trigger                                                             | Priority |
| ----------------------------------------- | ------------------------------------------------------------------- | -------- |
| `handbook.search_executed`                | User submits a search query in sidebar (ql truthy)                  | Medium   |
| `handbook.create_initiated`               | Any "Nytt dokument" entry point clicked                             | High     |
| `handbook.wizard_started`                 | Wizard or draft method selected in HbCreate, or HMS veiviser button | High     |
| `handbook.wizard_block_accepted`          | User confirms/accepts a wizard block                                | High     |
| `handbook.wizard_block_rewrite_requested` | User requests a rewrite via dropdown                                | Medium   |
| `handbook.ai_suggestion_accepted`         | User accepts AI diff in editor                                      | High     |
| `handbook.ai_suggestion_dismissed`        | User dismisses AI diff in editor                                    | Medium   |
| `handbook.gap_actioned`                   | User acts on a gap suggestion                                       | Medium   |
| `handbook.gap_dismissed`                  | User dismisses a gap suggestion                                     | Medium   |
| `handbook.chapter_archived`               | User confirms archive in editor modal                               | High     |

---

## Backend Hooks Found

| Hook / Action                                 | File                                                    | Covers                                                                                               |
| --------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useHandbookSave` (mutation)                  | `use-handbook-content.ts`                               | Chapter CREATE + UPDATE via `upsertHandbookChapterAction`; emits `handbook chapter_saved` on success |
| `upsertHandbookChapterAction` (server action) | `governance/_actions/update-handbook-chapter-action.ts` | DB insert/update `handbook_chapter`, emits `governance.content_updated`, gated by `gateAction`       |
| `useHandbookChapters` (query)                 | `_hooks/use-handbook-chapters.ts`                       | Reads `handbook_chapter` table; read-only                                                            |
| `useHandbookContent` (query)                  | `document-mode/use-handbook-content.ts`                 | Per-chapter fetch, same table                                                                        |
| `useHandbookTools`                            | `_tools/use-handbook-tools.ts`                          | Botsson tools (read + navigate, client-side keyword search)                                          |

**Missing hooks:**

- Archive action: `handbook.chapter_archived` event has no server action or mutation hook yet
- Approval state machine (send to review → approve → publish): current design routes through `useHandbookSave`, but the state transitions (review/approved) need either a dedicated server action or the existing upsert must accept a `status` field

---

## Traps and Constraints

### TRAP 1 — handbook_chapter has 0 seed rows (E2E BLOCKER)

`handbook_chapter` table contains 0 rows. Any E2E test opening the editor, chapter detail, or ChapterReader will see empty state. E2E is **blocked** until ≥3 plain-text chapters are seeded. Seed content MUST be plain text strings (not TipTap JSON) — TipTap JSON cannot be generated without the editor running.

### TRAP 2 — AI semantic search DESCOPED to v2

`workspace_doc_chunk` (pgvector) needs an OpenRouter key and the `ingest-workspace-knowledge` pipeline to populate. This is flaky in e2e. AI semantic search is **descoped to v2**. The existing client-side keyword search via `searchHandbook` tool (title/key/description match) is the v1 implementation — this is sufficient and works today.

### TRAP 3 — Most editor interactions are mock-only

HbEditor's contentEditable body, AI suggestion acceptance, owner picker, comments, conflict UI, version restore, and archive are all mock/toast-only in the design. Only `useHandbookSave` + `upsertHandbookChapterAction` write to the DB. The state machine (draft → review → approved) has no backend persistence yet.

### TRAP 4 — `handbook chapter_saved` emitted on client (`onSuccess`) AND server (`governance.content_updated`)

These are complementary, not duplicate: `handbook chapter_saved` (client) records the user interaction; `governance.content_updated` (server) triggers engine ingest. Both should fire; no dedup needed.
