---
title: "Journey — Botsson Admin Chat + InputRequest Primitive"
feature: botsson-chat-input-request
branch: feat/botsson-chat-input-request
status: done
created: 2026-04-08
updated: 2026-04-08
module: botsson
tags: [journey, botsson, chat, input-request, pii, contracts]
---

# Journey — Botsson Admin Chat + InputRequest Primitive

> Gives admins a typed-input chat surface to delegate work to Mr. Botsson. Adds a
> PII-safe `InputRequest` primitive so tools can collect sensitive data without
> ever passing it through the conversation stream. Wires contract creation as
> the first capability behind it.

## Context

This feature implements decisions locked in by the Contract Composition Engine
council (2026-04-07), specifically:

- **ADR-0077** — Contract intake PII handling, 3-layer defence model
- **ADR-0078** — Engine process channel restriction (voice forbidden for PII)

It is the first delivery of the Botsson admin worker surface. Prior work
scoped Botsson as voice-first via EmmaOverlay; this adds the typed-input
counterpart so admins can chat AND voice-talk with the same agent, with the
channel enforced at the tool boundary for PII-sensitive actions.

## Who this is for

**Admin / Owner** (role = `admin` or `owner` in the active workspace).
Employees and managers do not get Botsson admin chat — it's a delegation surface
for people who have authority over workspace mutations.

---

## Journey 1: Admin creates a contract via chat from the Contracts page

**Precondition:**
- Admin is signed in with role `admin` or `owner` in a workspace
- At least one employment contract template exists for the workspace
- At least one employee profile exists in the workspace
- `OPENROUTER_API_KEY` is set on the server

**Steps:**

1. Admin navigates to `/dashboard/contracts`
   → Contracts page renders with existing contracts list
   → A new action button "Lag kontrakt" (Create contract) is visible
2. Admin clicks "Lag kontrakt"
   → Page dispatches `window.dispatchEvent(new CustomEvent('botsson:open', { detail: { kind: 'create_contract' } }))`
   → EmmaOverlay (mounted in DashboardShell) listens for this event and opens Botsson
   → BotssonArena switches to the `admin-chat` view
   → AdminChatView renders with a priming system message hinting at the context
3. Admin types: "Lag kontrakt for Lise Hansen, 20 timer i uka, start 1. mai"
   → BotssonChat POSTs to `/api/botsson/chat` with workspaceId, userMessage, primeContext
4. API route authenticates, checks admin/owner role, runs `runBotssonAgent`
   → Botsson agent calls `list_employees` tool → finds Lise Hansen
   → Calls `list_contract_templates` → picks a matching template
   → Calls `create_employee_contract` → creates draft row in `employment_contract`
   → Returns text: "Draft opprettet for Lise Hansen (kontrakt-ID: 1234). Vil du sende den nå?"
5. BotssonChat renders the text reply + any tool result summaries
   → Admin sees "Draft opprettet for Lise Hansen (kontrakt-ID: 1234)"
6. Admin types: "Ja, send den"
   → Another chat turn runs; Botsson calls `send_employee_contract(id=1234)`
   → Contract status moves from `draft` to `sent`; DocuSeal notification fires
   → Botsson replies with confirmation text

**Postcondition:**
- A row exists in `employment_contract` with status `sent`
- Outbound notification recorded in activity trail
- Chat history persists in the BotssonProvider view stack for the session

**Error paths:**
- Not signed in → `401 Unauthorized` JSON from `/api/botsson/chat`
- Signed in but not admin → `403 Forbidden`; chat UI surfaces "Du har ikke
  tilgang til å bruke Botsson admin-chat" banner
- Template not found → Botsson asks admin which template to use
- `OPENROUTER_API_KEY` missing → 500 error with explicit "OPENROUTER_API_KEY is
  not set" message in server logs; UI shows generic "Botsson er utilgjengelig"
- Model tool-call loop exceeds `stepCountIs(10)` → Botsson returns with whatever
  was accomplished so far; admin can continue the conversation

---

## Journey 2: Admin creates a contract from an employee profile

**Precondition:**
- Admin signed in, admin/owner role
- Viewing `/dashboard/people/[profileId]` for a specific employee
- Employee has no active contract yet

**Steps:**

1. Admin is on the employee profile page
   → The profile shows a "Lag kontrakt" button in the actions area
2. Admin clicks the button
   → Page dispatches `botsson:open` with `{ kind: 'create_contract', profileId, profileName }`
   → EmmaOverlay opens Botsson in admin-chat view
   → The priming context is passed as `primeContext` on the first `/api/botsson/chat` POST
3. Botsson greets admin with a context-aware opener:
   "Jeg ser du vil lage en kontrakt for {profileName}. Hvilken template skal jeg bruke?"
4. Admin replies with template name or natural-language description
   → Same flow as Journey 1 from step 4 onward

**Postcondition:** Same as Journey 1.

**Error paths:** Same as Journey 1, plus:
- `profileId` in primeContext doesn't match any employee → Botsson surfaces the
  mismatch and asks admin to confirm

---

## Journey 3: Tool requests PII — InputRequest rendered inline

**Precondition:**
- Admin in admin-chat with Botsson
- A task in progress that requires PII (e.g., finalize contract → needs bank details)

**Steps:**

1. Botsson calls a tool that needs PII (e.g., `complete_payroll_profile`)
2. Instead of asking for PII in chat text, the tool returns an
   `InputRequestDescriptor` built via `buildInputRequest()` in
   `packages/ai/src/primitives/input-request`
3. Server-side channel guard runs:
   - Reads the descriptor's `allowedChannels` (e.g., `['chat']`)
   - Asserts current session channel is in the allow list
   - PII fields force chat-only — any attempt to emit over voice throws
     `ChannelGuardError` before the descriptor leaves the tool
4. `runBotssonAgent` collects the descriptor into `inputRequests[]` and returns
   it as part of `BotssonAgentResult`
5. `/api/botsson/chat` forwards `inputRequests` in the response body
6. BotssonChat renders each descriptor using the `BotssonInputRequest` UI
   component (`packages/ui/src/components/botsson-input-request.tsx`)
   → Inline form fields: bank account, address, etc.
   → Each field has its own validation (Zod-backed)
7. Admin fills in the form and clicks submit
   → The component POSTs the values back as a follow-up chat turn
   → The input data never appears in the message stream as plain text — it's
     attached as structured input associated with the original tool call
8. Botsson re-runs the tool with the PII filled in; the tool writes it directly
   to the target row (e.g., `employee_payroll_profile`)

**Postcondition:**
- PII is persisted in the target table
- No PII appears in chat transcript, model context, or logs
- `engine_event` records that the input_request was completed (fields listed
  by label only, never by value)

**Error paths:**
- Admin abandons the form → descriptor stays in the chat view but is not
  submitted; on next turn Botsson can re-issue or ask about progress
- Validation fails → inline field errors; form does not submit
- Guard fails (engineering error — a voice-channel session somehow reaches a
  PII tool) → `ChannelGuardError` thrown server-side; chat shows generic
  "Noe gikk galt med input-forespørselen" message; full error logged

---

## Journey 4: Admin opens Botsson from anywhere via custom event

**Precondition:** Admin on any `/dashboard/*` page.

**Steps:**

1. Any component dispatches `window.dispatchEvent(new CustomEvent('botsson:open', { detail: primeContext }))`
2. EmmaOverlay's event listener fires
3. BotssonProvider sets the view stack to `admin-chat`
4. Overlay slides in, chat input focused

**Postcondition:** Botsson admin chat is open and primed with the given context.

**Error paths:**
- Overlay not mounted (should never happen inside DashboardShell) → event is a no-op

---

## Surfaces touched

| Surface | File | Change |
|---|---|---|
| Contracts page | `apps/web/src/app/dashboard/contracts/page.tsx` | "Lag kontrakt" button dispatching `botsson:open` |
| Employee profile | `apps/web/src/app/dashboard/people/[id]/page.tsx` | "Lag kontrakt" button with profile context |
| Botsson arena | `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | AdminChatView wired into view stack |
| Botsson provider | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | `admin-chat` view type added |
| Botsson chat UI | `apps/web/src/app/Botsson/_components/BotssonChat.tsx` | New file — chat transcript + input + InputRequest renderer |
| Chat API | `apps/web/src/app/api/botsson/chat/route.ts` | New route — auth guard + runBotssonAgent |
| Botsson agent | `packages/ai/src/agents/botsson.ts` | New — wraps Vercel AI SDK + capability tools |
| InputRequest primitive | `packages/ai/src/primitives/input-request/*` | New — types, builder, channel guard |
| InputRequest UI | `packages/ui/src/components/botsson-input-request.tsx` | New — inline form widget |

## What is NOT in this branch

- **Voice channel integration** — runtime `channel` parameter is reserved in
  `runBotssonAgent` input but not yet wired to Ultravox
- **More than one capability** — only `contractCapability` is surfaced. Schedule,
  payroll, governance capabilities are follow-up work
- **Persistent chat history** — chat state lives in the BotssonProvider view stack
  per session; no `engine_session` row yet
- **Intent classifier / router** — tools are flat-mapped from all active
  capabilities, no dynamic selection per turn
- **Telemetry emit() for chat turns** — API route does not yet emit. Follow-up:
  wire `emit('botsson.chat.turn')` with redacted payload

See `HANDOFF-botsson-chat-input-request.md` for the full debt list and next steps.
