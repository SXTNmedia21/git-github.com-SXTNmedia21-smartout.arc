---
name: E2E recorder spec drift — selectors vs current DOM
description: Drift points caught during Phase 2c audit of botsson-recorder E2E specs; use as checklist when any test targets Guardian or Botsson chat.
type: project
---

Drift discovered during Phase 2c (2026-04-23) when auditing the three
`apps/e2e/tests/botsson-recorder/*` specs against current code. Every
one of these was a real selector mismatch, not a stylistic choice.

**Why:** The Phase 1e draft specs were written against the ADR spec
documents, not the landed code. Phase 2 composition (Monitor-as-host,
tabbed-details, specific aria-labels) diverged from the ADR phrasing.
**How to apply:** Before writing any new Guardian or Botsson E2E,
verify selectors live against the component files below.

## Guardian page layout (apps/web/src/app/platform-admin/guardian/)

- Root page renders `<GuardianDashboard>` which is **tabbed**:
  `Oversikt` / `Live Monitor` / `Analyse` (Radix Tabs, values
  `overview`/`monitor`/`analytics`). Default = `overview`.
- SessionList lives only under the `monitor` tab. To reach it from a
  cold page load you MUST do
  `page.getByRole("tab", {name: /live monitor/i}).click()`.
- Inside the monitor, the right pane has its OWN sub-tabs
  (`Info` / `Replay`) implemented as custom `<TabButton>` components,
  NOT Radix — they render `<button>` not `<tab>`. Use
  `page.getByRole("button", {name: "Replay"})`.
- AdminActionDrawer trigger is a button with
  `aria-label="Open admin actions drawer"`. The drawer dialog
  announces as `aria-label="Session admin actions"`.
- TurnCard flag button is absolute-positioned, `aria-label="Flag turn"`,
  opacity 0 resting, 100 on group-hover. Playwright click works without
  explicit hover because the element IS in the DOM.

## BotssonChat (apps/web/src/app/Botsson/_components/BotssonChat.tsx)

- Message bubble has `data-role={message.role}`. `role` is `"user"` or
  `"assistant"` — **not `"agent"`**. Specs that look for
  `[data-role='agent']` WILL NEVER MATCH.
- Chat input placeholder is
  `"Skriv en melding til Botsson … (Enter for å sende, Shift+Enter for ny linje)"`.
  Regex `/Skriv en melding/i` matches. Do not use `/Skriv til Emma/` —
  that string never appears.

## BotssonShell / BotssonSticky (orb → arena morphing)

- The Botsson **orb** is a `<div>` with pointer events, NOT a
  `<button>`. `page.getByRole("button", {name: /botsson|emma/i})` will
  NOT find it. The orb morphs to `sticky` on click, then to `arena`
  on further click.
- The "Start Emma" button (`aria-label="Start Emma"`) only exists in
  the STICKY density inside `BotssonSticky.tsx`, and only before a
  voice session is connected.
- Chat access path: orb click → sticky → click sticky body → arena
  renders BotssonArena which contains the chat input. This is a multi-
  step DOM morph, not a single `.click()`.

## SessionList turn-count selector

- Turn count pill renders `{recorder.turn_count}t` (e.g. `"5t"`,
  `"12t"`) ONLY when `useRecorderSessions()` has recorder aggregate
  for the session's `session_id`. The pill lives in the bottom-right
  cluster of a `<button>` row.
- Playwright selector `page.getByRole("button").filter({hasText: /\dt$/})`
  matches correctly — `hasText` does substring/regex, not full-string.
- Requires BOTH live WS session (`useGuardianSocket`) AND recorder rows
  for the same `session_id`. You cannot seed only one side.

## DB-layer assertion beats DOM scan for whisper isolation

For the ADR-0078/ADR-0185 whisper-never-user-facing invariant, asserting
against `agent_session_recording` rows where
`turn_kind IN ('agent_response','tool_result')` is strictly stronger
than scanning the chat DOM for a token. A DB check catches leakage
into:
- Current Arena chat UI
- LogView tool-result previews
- Mobile app (future)
- Any replay mirror / export

Design: insert whisper via BFF (exercises auth + C4 gate + emit), then
query recorder for the assistant turn that consumed it, assert token
absence in `content_redacted`.
