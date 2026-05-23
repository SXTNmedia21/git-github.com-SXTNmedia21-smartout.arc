---
title: "Journey — Server defends send_message against tampered channel_id (cross-workspace)"
feature: inline-confirm-card-send-message
journey: resume-tamper-defense
status: draft
verified_at: null
e2e_test: null
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [journey, botsson, security, trust-boundary, hitl, send-message, l-0177-defense, adr-0151]
---

# Journey: Server defends send_message against tampered channel_id

**Role:** adversarial-admin (compromised browser, XSS injection, curl-replay post-token-theft)

**Precondition:**
- Admin authenticated with `communication` capability for workspace W1
- Workspace W1 has channel "Vakter" (channel_id = `vakter-w1-uuid`)
- Workspace W2 (foreign) exists with channel "Vakter-W2" (channel_id = `vakter-w2-uuid`)
- Admin draft-renders message to `vakter-w1-uuid` — happy-send steps 1-4 complete
- Adversary intercepts browser POST to inject foreign channel_id

## Adversarial Path → Defense

1. Adversary intercepts POST `/api/botsson/chat` with `client_tool_results` body
2. Adversary mutates result: `{proposal_id, action:"confirm"}` → `{proposal_id, action:"confirm", patch:{channel_id:"<vakter-w2-uuid>", content:"NEW BODY TARGETING FOREIGN WORKSPACE"}}`
3. Stage-engine resumes LLM with tampered result
4. LLM calls `send_message({channel_id:"<vakter-w2-uuid>", content:"NEW BODY...", confirm:true, proposal_id})`
5. **DEFENSE 1 — Server re-derives workspace_id from session context (ADR-0151)** — `ctx.workspaceId = W1` from JWT, NEVER body. Even if patch includes `workspace_id`, ignored.
6. **DEFENSE 2 — Server re-resolves channel via RLS** — query: `supabase.from("channel").select().eq("id", body.channel_id).eq("workspace_id", ctx.workspaceId)`. `vakter-w2-uuid` belongs to W2, RLS returns ZERO rows. Tool returns error: "Kan ikke sende melding — kanal finnes ikke eller er inaktiv".
7. **DEFENSE 3 — `editable_fields` whitelist (ADR-0398 §Resume-Payload Trust Boundary)** — descriptor's `actions[id="edit"].editable_fields = ["body"]` (channel_id NOT whitelisted). On resume, body-supplied `channel_id` filtered out before commit-phase logic. Channel re-derived from ORIGINAL draft (proposal_id correlation).
8. **DEFENSE 4 — RPC UNIQUE on `client_message_id`** — replay protection. Even if tampered call passes DEFENSE 2/3 by happenstance, RPC enforces single-INSERT per UUID.

**Postcondition:**
- ZERO new rows in `channel_message` (DEFENSE 2 fails channel lookup)
- W2's channel `vakter-w2-uuid` UNTOUCHED — no message INSERT
- W2's workspace data UNTOUCHED in all scenarios
- activity_trail: `inline_confirm_card.shown` (draft) + NO `inline_confirm_card.confirmed` (defense rejected)
- Error response in chat: "Kan ikke sende melding — kanal finnes ikke eller er inaktiv"

## Threat Model Coverage (send_message-specific)

| Attack vector | Defense |
|---|---|
| Cross-workspace publish via body-supplied workspace_id | DEFENSE 1 — ADR-0151 ctx.workspaceId from JWT |
| Cross-workspace channel_id swap | DEFENSE 2 — RLS-scoped channel lookup rejects foreign UUID |
| Body-supplied channel_id bypassing draft state | DEFENSE 3 — editable_fields whitelist excludes channel_id |
| Replay attack on consumed proposal_id | DEFENSE 4 — RPC UNIQUE on client_message_id |
| Body mutation injecting different recipients | RLS at channel_member level — foreign profile_ids not visible |
| Stale-state attack: channel deleted between draft + commit | Re-resolution on commit — sees current state, returns "kanal inaktiv" |

## Error Paths (defense-rejection observable states)

- **Defense rejects → user sees fallback text** → LLM verbalizes error → admin can retry with explicit re-draft. NO silent success on tampered channel.
- **Defense rejects but card shows "resolved-success"** → BUG. Card UI must reflect actual server outcome.
- **Telemetry leak: `inline_confirm_card.confirmed` emitted even on rejection** → BUG. Server emits only after channel_message INSERT succeeds.

## Verification

- [ ] Implementation matches DEFENSE 1-4 with file:line citations in HANDOFF
- [ ] E2E test at `apps/e2e/tests/inline-confirm-card-send-message/resume-tamper-defense.spec.ts` — Playwright intercepts POST, swaps channel_id to foreign W2 UUID, asserts NO INSERT in W2 + error response
- [ ] Manual security audit (lovsen agent OR code-reviewer) — confirms DEFENSE 3 enforced in tool body, NOT assumed from RLS
- [ ] Resume-payload trust boundary code-traced — ctx.workspaceId used everywhere, body never trusted, editable_fields whitelist filters channel_id
- [ ] L-0177 silent-fallback absent — no `if (body.channel_id) ctx.channelId = body.channel_id` pattern

**Mark `status: verified` after Pontus runs `close-feature.sh 6` + confirms security audit (boxes 3-5).**
