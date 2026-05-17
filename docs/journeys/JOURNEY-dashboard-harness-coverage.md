---
title: "Journey — dashboard-harness-coverage"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: botsson
tags: [journey, dashboard, harness, botsson, voice]
---

# Journey — dashboard-harness-coverage

> 4 journeys covering /dashboard harness coverage for Botsson voice + chat. Each journey: precondition → user does → system does → user sees → postcondition + error paths.

## Journey 1: Manager voice "kor mange er på vakt i dag?"

**Role:** Manager
**Surface:** /dashboard (oversikt variant), Botsson voice channel via LiveKit

**Precondition:**
- Manager signed in, profile has department
- Today's `department_session` exists (state = `active`)
- At least 1 `schedule_shift` for today
- Manager has C4 read authority for `roster.read` (default true for manager+)

**Happy path:**
1. Manager opens /dashboard → Botsson Orb mounted, ready-state
2. Manager taps Orb mic, says "kor mange er på vakt i dag?" (or "who is working today?")
3. Realtime LLM (LiveKit voice plane per ADR-0282) receives utterance + context_init bootstrap (workforce snapshot + site-map.json with /dashboard tools per 2026-05-13 ADR-0297)
4. LLM picks `getRosterForDay` tool (registered via `useRegisterTools("oversikt", ...)`) — no `query_smartout` fallback
5. Tool handler calls `useRoster` query → returns names + role + status
6. LLM speaks: "Du har 4 på vakt: Anna (bartender, aktiv), Bjørn (kjøkken, oppmøtt), Cecilie (servitør, kommer om 15 min), Daniel (kjøkken, fri)."
7. Telemetry: `roster.read.tool_call` event emitted with tool_name, response_time_ms

**User sees:**
- Roster panel highlights briefly via `ui.highlight_element` if Botsson calls that nav-tool (optional Phase 4 polish)
- No page navigation needed — answer comes via voice + ambient orb glow

**Postcondition:**
- Botsson chat history (engine_memory) updated with tool_call + response
- Activity_trail row: `actor=manager`, `entity=schedule_shift`, `verb=read`, `tool=getRosterForDay`

**Error paths:**
- No session today → tool returns `{ ok: false, reason: "no_session_today" }`; LLM speaks "Du har ikke åpnet dagen ennå. Vil du at jeg starter den?"
- Manager has no department → tool returns `{ ok: false, reason: "no_department" }`
- API timeout → LLM degrades to "Kan ikke hente roster akkurat nå, prøv på nytt om litt"

---

## Journey 2: Manager voice "start dagen" (write-tool with C4)

**Role:** Manager
**Surface:** /dashboard (oversikt variant)

**Precondition:**
- Manager signed in, profile has department
- No `department_session` for today (state `no-session`)
- Manager has C4 `session.open` authority in `engine_authority_config`

**Happy path:**
1. Manager voice: "start dagen" or "open today"
2. LLM picks `openSession` tool, parameters `{ date: today, departmentId: manager.department_id, plannedOpen: "10:00", plannedClose: "22:00" }` (defaults from department_operating_hours)
3. Tool handler wraps in `gatedMutation` per ADR-0204:
   - `engine_authority_config` lookup: `session.open` → granted=true for manager role
   - Calls `openSessionAction` server action
4. Server action inserts `department_session` row, emits `session.opened` event
5. LLM speaks: "Dagen er åpen. 10:00 til 22:00. Du har 4 vakter i dag."
6. UI auto-refreshes via TanStack invalidation → WebDayControl transitions `no-session → ready`

**Postcondition:**
- `department_session.state = active`
- `engine_event` row + `activity_trail` row
- Botsson can now offer write tools (Phase 3 tools require active session)

**Error paths:**
- C4 authority denied (e.g. employee role tried) → tool returns `{ ok: false, reason: "authority_denied", capability: "session.open" }`; LLM speaks "Du har ikke rettighet til å åpne dagen — kontakt admin"
- Session already exists (race) → `openSessionAction` rejects with `already_exists`; tool returns same; LLM speaks "Dagen er allerede åpen"
- Voice-channel restriction (if ADR-0078 extended to write tools): preview-confirm required → LLM speaks "Vil du åpne dagen nå? Si ja for å bekrefte" before invoking

---

## Journey 3: Manager voice "vis avstemming" (navigation tool)

**Role:** Manager
**Surface:** /dashboard (any variant)

**Precondition:**
- Manager signed in, on /dashboard

**Happy path:**
1. Manager voice: "vis avstemming" or "switch to reconciliation"
2. LLM picks `switchVariantView` nav-tool, params `{ variant: "reconciliation" }`
3. Tool handler calls `setAdminView('reconciliation')` (useAdminContext)
4. URL updates `?variant=reconciliation`, ReconciliationView dynamically imports + mounts
5. `reconciliation-tools-bridge.tsx` mounts on view ready → registers reconciliation-scoped tools (lockReconciliation, revertReconciliation, listReconciliation)
6. LLM speaks: "Avstemming åpnet. 3 dager venter på låsing."

**Postcondition:**
- `?variant=reconciliation` in URL
- ReconciliationView mounted, tools registered under `useRegisterTools("reconciliation", ...)`
- engine_world surface state updated (per ADR-0290): current variant = reconciliation

**Error paths:**
- Manager lacks `reconciliation.read` access → variant page renders with empty-state copy; LLM speaks "Du har ikke tilgang til avstemming"
- Dynamic import fails (network) → fallback to error boundary; LLM speaks "Kan ikke åpne avstemming akkurat nå"

---

## Journey 4: Reconciliation variant — Botsson "lås dagen" (variant-scoped write)

**Role:** Manager
**Surface:** /dashboard?variant=reconciliation

**Precondition:**
- Journey 3 completed (reconciliation variant mounted)
- Yesterday's `daily_reconciliation` row exists with state `pending`
- Manager has C4 `reconciliation.lock` authority

**Happy path:**
1. Manager voice: "lås gårsdagen" or "lock yesterday"
2. LLM picks `lockReconciliation` tool (registered by reconciliation-tools-bridge), params `{ date: yesterday }`
3. gatedMutation: C4 `reconciliation.lock` → granted
4. Server action `lockReconciliationAction` (existing in `_actions/`) writes `daily_reconciliation.state = locked`, emits `reconciliation.locked`
5. ReconciliationView refetches → row turns "locked"
6. LLM speaks: "Gårsdagen låst. 4 vakter, 32 timer, 8 200 kr i lønnsgrunnlag."

**Postcondition:**
- `daily_reconciliation.state = locked`, `locked_by = manager.profile_id`, `locked_at = now()`
- `engine_event` + `activity_trail` rows
- Payroll period for that date moves toward eligible-for-close

**Error paths:**
- Authority denied → `{ ok: false, reason: "authority_denied" }`; LLM speaks denial
- Deviations on the day unresolved → tool returns `{ ok: false, reason: "deviations_open", count: N }`; LLM speaks "Du har 2 avvik som ikke er løst. Vil du se dem?"
- Already locked → no-op success with idempotent response; LLM speaks "Dagen er allerede låst"
