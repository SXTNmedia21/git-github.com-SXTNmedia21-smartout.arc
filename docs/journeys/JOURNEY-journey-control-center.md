---
title: "User Journeys — Journey Control Center"
status: in_progress
updated: 2026-05-06
created: 2026-05-06
module: journey-control-center
tags: [journey-engine, dev-tool, operator-only]
---

# User Journeys — Journey Control Center

## Journey 1: Run a compiled journey at chosen speed

**Precondition:** At least one compiled JourneyIR protocol is registered in `PROTOCOL_REGISTRY` (i.e. the `apps/e2e/protocols/index.ts` barrel exports the slug). The Journey Control Center dev server is running on port 3065. No other run is currently active (single-run lock enforced per-process).

1. Operator opens `http://localhost:3065` → System fetches compiled protocols via `GET /api/journeys` → Dashboard renders protocol cards in the "Compiled Protocols" section
2. Operator locates the desired protocol card (e.g. "P-001: New Employee Onboarding") → Clicks "Run" button on the card
3. System opens the RunViewer panel → Dropdown shows three speed options: "Full (CI speed)", "Normal (operator review)", "Ai Companion (Botsson narrate)"
4. Operator selects a speed (e.g. "Normal") → Clicks "Start Run"
5. System sends `POST /api/journeys/run` with `{ slug, speedProfile: "normal" }` → Server spawns Playwright child process with `JOURNEY_SPEED_PROFILE=normal`
6. RunViewer subscribes to `GET /api/journeys/run/stream` → SSE events stream step progress: `step_start`, `gate_pass`, `gate_fail`, `step_complete`
7. Each event line renders in the log panel with timestamp and status icon → Operator watches steps advance in real time
8. On final `run_complete` event → RunViewer shows summary: steps passed, total duration, speed profile used
9. Run lock releases → "Run" button re-enables on all protocol cards

**Postcondition:** Protocol executed successfully. Log events visible in RunViewer. Run lock released.

**Error paths:**

- Another run already active → `POST /api/journeys/run` returns 409; RunViewer shows "En kjøring er allerede aktiv" toast
- Protocol slug not found in registry → 404; RunViewer shows error banner
- Playwright child exits non-zero → `run_error` SSE event with exit code; RunViewer shows red summary panel
- Network disconnect during stream → SSE auto-reconnects (browser EventSource); partial log preserved in UI

---

## Journey 2: Compile a draft markdown into runnable IR

**Precondition:** A draft `.md` file exists in the `apps/e2e/drafts/` directory (or equivalent configured drafts path). The Journey Control Center can reach OpenRouter with a valid `OPENROUTER_API_KEY` env var. The `apps/e2e/protocols/index.ts` PROTOCOL_REGISTRY barrel is in its expected shape (import block + export map).

1. Operator opens `http://localhost:3065` → Dashboard renders draft markdown files in the "Draft Protocols" section (below compiled protocols)
2. Operator locates the draft (e.g. "P-002: Manager Daily Loop") → Clicks "Compile" button on the draft card
3. System opens CompileDialog → Shows the draft filename and a slug input field pre-populated with a sanitised suggestion (e.g. "P-002")
4. Operator reviews or edits the slug → Clicks "Confirm Compile"
5. System sends `POST /api/journeys/compile` with `{ draftPath, slug }` → Server reads markdown, calls OpenRouter (Claude Sonnet 4.6) with `response_format: { type: "json_object" }`, receives JourneyIR JSON
6. Server validates IR with Zod schema → Writes compiled JSON to `apps/e2e/protocols/<slug>.json`
7. Server runs registry-rewrite: injects new `import` + export entry into `apps/e2e/protocols/index.ts`
8. CompileDialog shows success state: "Kompilert og registrert som P-002" → Auto-closes after 2 s
9. Protocol list refreshes → New compiled card appears in "Compiled Protocols" section with slug P-002

**Postcondition:** JourneyIR JSON written to disk. PROTOCOL_REGISTRY updated. Compiled card visible in dashboard. Draft card still visible (draft file unchanged).

**Error paths:**

- LLM returns non-JSON or invalid IR → Zod validation fails; `POST /api/journeys/compile` returns 422 with error detail; CompileDialog shows error and remains open with input preserved
- Slug already exists in registry → Server returns 409 "Slug already registered"; dialog prompts operator to choose a different slug
- `OPENROUTER_API_KEY` missing → Server returns 500 "Missing API key"; dialog shows "Sett OPENROUTER_API_KEY i miljøet ditt"
- Registry rewrite regex does not match expected structure → Server returns 500 with description; file is NOT written (atomic: write only after registry-rewrite succeeds)

---

## Journey 3: Abort a running journey mid-run

**Precondition:** A journey run is active — RunViewer is streaming SSE events, Playwright child process is running. The run was started by this process instance (same Node.js server; `activeRuns` Map holds the child PID).

1. Operator is watching an active run in RunViewer → Steps are streaming live
2. Operator decides to abort (e.g. wrong speed profile, wrong protocol) → Clicks "Abort" button in RunViewer header
3. Browser sends `POST /api/journeys/run/abort` → Server locates active run via `activeRuns` Map → Sends SIGTERM to Playwright child process
4. Child process receives SIGTERM → Playwright closes browser context → Child exits with code 130 or 1
5. Server emits `run_aborted` SSE event with `{ reason: "operator_abort", exitCode }` → RunViewer log panel appends abort line (red, with reason)
6. RunViewer header switches to "Avbrutt" state → Abort button disabled → Speed selector disabled
7. Run lock releases → "Run" button re-enables on all protocol cards

**Postcondition:** Child process terminated. Run lock released. RunViewer shows abort reason. No partial state written to disk.

**Error paths:**

- No active run when abort is sent → `POST /api/journeys/run/abort` returns 404 "Ingen aktiv kjøring"; toast shown in RunViewer
- SIGTERM ignored by child (timeout) → Server sends SIGKILL after 5 s; `run_aborted` event emitted with `{ reason: "sigkill_fallback" }`
- Server process restarted during run → `activeRuns` Map cleared; orphaned Playwright child continues until its own timeout; operator must kill manually (known issue — see HANDOFF)

---

## Journey 4: Search drafts by slug or title

**Precondition:** At least one draft file exists in the drafts directory. Dashboard is loaded. "Draft Protocols" section is visible.

1. Operator sees a list of draft cards (e.g. 8 drafts) → Wants to find "P-003" quickly
2. Operator clicks the search input above the drafts list → Types "P-003"
3. System filters draft list in real time (no network round-trip — client-side filter) → Only cards matching "P-003" in slug or title are shown
4. Match is case-insensitive (`"p-003"`, `"P-003"`, `"onboarding"` all work) → Count label updates: "1 av 8 utkast"
5. Operator clicks the matching draft card → Sees full draft title and "Compile" button
6. Operator clears the search input → Full list restores → Count label returns to "8 utkast"

**Postcondition:** Operator located the desired draft efficiently. Filter state is ephemeral (not persisted between sessions).

**Error paths:**

- Query matches nothing → List renders empty; count label shows "0 av 8 utkast"; no error shown (expected empty state)
- Query produces more than 50 matches (render cap) → First 50 shown; count label shows "50+ treff — presisar søket"
- Draft directory scan fails (server error on load) → Draft section shows error banner; search input disabled
