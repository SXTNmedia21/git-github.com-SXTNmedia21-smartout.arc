---
title: "/dashboard/help v1 — Multi-Tier Hub Handoff"
status: complete
layer: handoff
created: 2026-04-28
updated: 2026-04-28
module: dashboard-help
tags: [help, kb-query, helpdesk, panic-bar, botsson, m1, campaign-core-module]
---

# HANDOFF — Dashboard Help v1 (M1)

> **Trust Gate:** ALL FOUR merge-blockers (G1, G2, G3, G4) PASS. Phantom contracts class-rule (ADR-0197 + L-0146) PASS. Cleared for merge to `campaign/core-module`.
>
> Status: **complete**. One documented Task 7 deviation (capability bypass with parity preserved) — does not block merge.

---

## Summary

`/dashboard/help` is now a multi-tier knowledge hub (ADR-0219), not a helpdesk page. Five tiers shipped:

- **Tier 0** — Panic Bar (3 buttons → engine_state ticket via gate_action + dual emit)
- **Tier 1** — Botsson Chat Hero (Runtime A only — chat → stage-engine, KB-aware via kb_query capability)
- **Tier 2** — Quick-Path Cards (4 role-personalized navigation cards; employee onboarding card scoped to employees)
- **Tier 3** — Curated Articles (static list with TtsButton; v2 will replace with RAG over `workspace_doc_chunk`)
- **Tier 5** — Kontakt Footer (responsible-rep + escalation contact)

Voice fallback (`kb_query_voice_fallback`) registered via `HelpVoiceToolsBridge` so Runtime B (Ultravox) cleanly redirects KB queries to chat instead of returning empty answers.

KB capability (`kb_query`) is now formally registered, bound to intent `knowledge`, and seeded for every workspace at level `read_only` / min_role `employee`.

**Scope vs. v1 plan:** all of M1 shipped. M2 (helpdesk thread continuation), M3 (doc-ingest pipeline), Q4/Q10/Q11.d explicitly excluded — see "Known debt".

---

## Trust Gate Verdicts

### G1 — `kb_query` registered + bound — **PASS**

| Check | Citation | Verdict |
|---|---|---|
| `kbQueryCapability` exists with `allowedChannels:["chat"]`, `emitPrefix:"kb"` | `packages/ai/src/capabilities/kb_query/index.ts:13–23` | PASS |
| `CapabilityName` union includes `"kb_query"` | `packages/ai/src/capabilities/types.ts:8` | PASS |
| Registry imports + registers `kbQueryCapability` | `packages/ai/src/capabilities/registry.ts:19,43` | PASS |
| `intent.capability==="knowledge"` → `"kb_query"` map; no empty `[]` fallthrough at old lines 106–115 | `packages/ai/src/router/tool-selector.ts:101–129` (comment block 102–104 documents the prior empty fallthrough is gone) | PASS |
| Intent classifier mentions `kb_query` in `knowledge:` system-prompt line | `packages/ai/src/router/intent-classifier.ts:86` | PASS |
| Migration `20260519000002_kb_query_authority_seed.sql` exists, idempotent CROSS JOIN, `level=read_only` | `supabase/migrations/20260519000002_kb_query_authority_seed.sql:48–55` (`SELECT … FROM workspace w ON CONFLICT (workspace_id, capability) DO NOTHING`, `level='read_only'`) | PASS |

### G2 — Voice fallback registered — **PASS**

| Check | Citation | Verdict |
|---|---|---|
| `useHelpVoiceFallbackKit` registers tool that speaks "bytt til chat" message | `apps/web/src/app/dashboard/help/_hooks/useHelpVoiceFallback.ts:31–36, 53–57` | PASS |
| `HelpVoiceToolsBridge` wires `useRegisterTools("help", kit)` | `apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx:14–18` | PASS |
| Bridge mounted | `apps/web/src/app/dashboard/help/page.tsx:27,91` (`<HelpVoiceToolsBridge />`) | PASS |

### G3 — Panic Bar emits to BOTH channels — **PASS** (Task 7 deviation documented)

Task 7 deviation: `open-helpdesk-ticket-action.ts` reimplements `helpdesk_query.openTicket` logic instead of calling the capability tool directly. **Rationale (file header lines 11–15):** capability tools expect `AgentToolContext` from agent-router; a Server Action is a different call path. Both paths emit identical telemetry events to satisfy L-0094 parity. Pattern mirrors `komm/thread/[channelId]/_actions/resolve-ticket.ts`.

| Check | Citation | Verdict |
|---|---|---|
| Server Action emits `help.escalated_to_ticket` AND `helpdesk.query.opened` | `_actions/open-helpdesk-ticket-action.ts:240–272` | PASS |
| `help.escalated_to_ticket` routes to activity_trail + engine_event | `packages/telemetry/src/registry.ts:8282–8285` (`destinations: ["posthog", "activity_trail", "engine_event"]`) | PASS |
| `helpdesk.query.opened` routes to activity_trail + engine_event | `packages/telemetry/src/registry.ts:7245–7248` (`destinations: ["posthog", "logger", "activity_trail", "engine_event"]`) | PASS |
| `gateAction()` called BEFORE mutation (ADR-0091/0099) | `_actions/open-helpdesk-ticket-action.ts:106–118` (gate before channel insert + engine_state insert) | PASS |
| Both `emit()` calls fire BEFORE `return ok:true` (no L-0124 phantom-body) | `_actions/open-helpdesk-ticket-action.ts:240–272 → 276` (return on line 276 follows both awaited emits) | PASS |
| `nonEmpty` workspace_id + actor_id (ADR-0193, ADR-0134) | `_actions/open-helpdesk-ticket-action.ts:242–243, 261–262` | PASS |

### G4 — Q4/Q10/Q11.d explicitly out-of-scope — **PASS**

Grep over `apps/web/src/app/dashboard/help/` for `workspace_doc_chunk` write, `lock_workspace`, `mfa_reset`, `gdpr_export`, `simulate_click`, `submit_form`, `page_takeover`:

- 3 occurrences of `workspace_doc_chunk` — **all are TODO comments referencing v2 RAG migration**, not writes (`CuratedArticlesList.tsx:16`, `page.tsx:74`, `_data/curated-articles.ts:15`).
- 0 occurrences of `lock_workspace`, `mfa_reset`, `gdpr_export`, `simulate_click`, `submit_form`, `page_takeover`.

PASS — no partial implementations of out-of-scope items.

### Phantom contracts class-rule (ADR-0197 + L-0146) — **PASS**

| Producer | Consumer | Trace |
|---|---|---|
| `kb_query` capability (`searchKb` tool) | BotssonChat (via `tool-selector.ts:101–129` — `intent.capability==="knowledge"` dispatch) | PASS |
| `kb_query_voice_fallback` tool | `help-voice-tools-bridge.tsx` (`useRegisterTools("help", kit)`, line 16) → mounted from `page.tsx:91` | PASS |

Both producer→consumer chains are wired end-to-end. No phantom contracts.

---

## Decisions Made

- [ADR-0219](../decisions/0219-dashboard-help-multi-tier-hub.md) — `/dashboard/help` as multi-tier hub (Tier 0–5), not a helpdesk page. Status: proposed → ready to promote on merge.
- [ADR-0220](../decisions/0220-botsson-conversational-front-door-not-orchestrator.md) — Botsson is a conversational front door, not a cascade orchestrator (per L-0148 trap word). Status: proposed.
- [ADR-0221](../decisions/0221-kb-capability-registration-merge-gate.md) — KB capability registration as merge gate (G1). Status: proposed.

---

## Learnings Captured

- [L-0147](../learnings/0147-phase-3-chair-self-reversal-pattern.md) — Phase 3 chair self-reversal pattern (council process).
- [L-0148](../learnings/0148-orchestrator-trap-word-in-ai-specs.md) — "Orchestrator" is a trap word in AI agent specs.
- [L-0149](../learnings/0149-phantom-contracts-in-qa-specs.md) — Phantom contracts in Q&A specs (parent of ADR-0197).
- [L-0150](../learnings/0150-botsson-system-map-staleness-cycle.md) — `BOTSSON-SYSTEM-MAP` staleness cycle.

---

## Known Deviations

### Task 7 — Server Action reimplements capability tool logic (G3 partial compromise)

**What:** `open-helpdesk-ticket-action.ts` does NOT call `helpdesk_query.openTicket` capability tool. It reimplements the channel/engine_state insert logic in-line.

**Why:** Capability tools expect `AgentToolContext` (workspace_id, profile_id, supabase admin/user clients, channel, processId, engineStateId) supplied by `agent-router.ts`. A Server Action runs in the Next.js request cycle and has no such context — the call paths are structurally different. Calling the tool from a Server Action would require synthesizing an `AgentToolContext` from `auth.getUser()`, which conflates the two trust paths and re-introduces the ADR-0078 channel-guard surface area.

**Mitigation:** Both call paths emit IDENTICAL telemetry events (`helpdesk.query.opened` + `help.escalated_to_ticket`) routed to the same destinations (activity_trail + engine_event). L-0094 parity preserved. `gate_action` enforced for both (capability='helpdesk_query', action_type='create').

**Reference:** mirrors existing pattern in `apps/web/src/app/dashboard/komm/thread/[channelId]/_actions/resolve-ticket.ts`.

**Decision deferred to user:** accept as documented exception, OR refactor in M2 by extracting shared `openTicketCore(ctx)` helper that both the capability tool and the Server Action call. Recommended path: defer (current code is safe, parity is real, refactor saves no measurable risk).

---

## Known Debt

| Item | Reference | Owner |
|---|---|---|
| `axe-core` not installed in `apps/e2e/package.json` — `help-accessibility.spec.ts` axe assertion is skipped pending `@axe-core/playwright` install | `apps/e2e/tests/help-accessibility.spec.ts` (TODO M1.5) | M1.5 follow-up |
| M2 — helpdesk thread continuation (resume conversation in /komm thread after panic-bar escalation) | ADR-0219 §Phase Plan v2 | M2 sub-sortie |
| M3 — doc-ingest pipeline (auto-update `workspace_doc_chunk` on handbook edit) | Q4 (out of scope v1), `_data/curated-articles.ts:15`, `page.tsx:74` | M3 sub-sortie |
| Q10 — per-emergency capabilities (`lock_workspace`, `mfa_reset`, `gdpr_export`) | Q10 (out of scope v1) | Future spec |
| Q11.d — page-takeover harness ("Show me") | Q11.d (out of scope v1) | Future spec |
| BotssonChatHero `workspaceId` prop wired post-spec — `page.tsx` modified to pass `ctx.workspaceId` | `apps/web/src/app/dashboard/help/page.tsx:65` | Included in this HANDOFF commit |

---

## Next Steps

1. **Merge campaign/core-module M1 → development** once design-spec ADRs (0219/0220/0221) flip from `proposed` → `accepted`.
2. **M2 sub-sortie** — helpdesk thread continuation (open the engine_state ticket as a chat thread on /komm). Spawn via `/start-feature m2-thread-continuation` from the campaign worktree.
3. **M1.5 axe-core install** — small chore, `pnpm --filter @smartout/e2e add -D @axe-core/playwright`, then unskip the axe block in `help-accessibility.spec.ts`.
4. **M3 sub-sortie** — doc-ingest pipeline. Larger scope — needs its own spec + ADR (`workspace_doc_chunk` write contract, embeddings refresh strategy).

---

## Files Changed (M1 vs `development`)

### New capability + intent wiring
- `packages/ai/src/capabilities/kb_query/index.ts` — capability definition (G1)
- `packages/ai/src/capabilities/kb_query/tools.ts` — `searchKb` tool binding
- `packages/ai/src/capabilities/kb_query/__tests__/tools.test.ts` — unit tests
- `packages/ai/src/capabilities/types.ts` — `kb_query` added to `CapabilityName` (line 8)
- `packages/ai/src/capabilities/registry.ts` — import + register (lines 19, 43)
- `packages/ai/src/router/tool-selector.ts` — `knowledge` → `kb_query` mapping (lines 101–129; closes empty-fallthrough trap)
- `packages/ai/src/router/intent-classifier.ts` — system-prompt update (line 86)

### Database
- `supabase/migrations/20260519000002_kb_query_authority_seed.sql` — idempotent authority seed for every workspace

### Telemetry
- `packages/telemetry/src/registry.ts` — added `help.*` events with proper routing destinations (lines 5591, 8278–8294)

### Help page (`apps/web/src/app/dashboard/help/`)
- `page.tsx` — multi-tier orchestration shell, mounts `HelpVoiceToolsBridge`
- `loading.tsx` — skeleton fallback
- `_actions/open-helpdesk-ticket-action.ts` — Panic Bar Server Action (G3)
- `_components/PanicBar.tsx`, `PanicConfirmDrawer.tsx` — Tier 0
- `_components/BotssonChatHero.tsx` — Tier 1
- `_components/QuickPathCards.tsx` — Tier 2
- `_components/CuratedArticlesList.tsx`, `TtsButton.tsx` — Tier 3
- `_components/KontaktFooter.tsx` — Tier 5
- `_data/curated-articles.ts`, `queries.ts` — static data + DAL
- `_hooks/useHelpVoiceFallback.ts` — voice fallback kit (G2)

### Botsson harness wiring
- `apps/web/src/app/Botsson/_components/help-voice-tools-bridge.tsx` — registers help kit (G2)

### Tests
- `apps/e2e/tests/journey-help-v1.spec.ts` — E2E G3 emit-parity verify
- `apps/e2e/tests/help-accessibility.spec.ts` — a11y invariants (axe block skipped — M1.5)

### Docs
- `docs/decisions/0219-dashboard-help-multi-tier-hub.md`
- `docs/decisions/0220-botsson-conversational-front-door-not-orchestrator.md`
- `docs/decisions/0221-kb-capability-registration-merge-gate.md`
- `docs/learnings/0147-phase-3-chair-self-reversal-pattern.md`
- `docs/learnings/0148-orchestrator-trap-word-in-ai-specs.md`
- `docs/learnings/0149-phantom-contracts-in-qa-specs.md`
- `docs/learnings/0150-botsson-system-map-staleness-cycle.md`
- `docs/superpowers/specs/2026-04-28-dashboard-help-design.md`
- `docs/plans/CAMPAIGN-core-module.md`
- `docs/handoffs/HANDOFF-dashboard-help-v1.md` (this file)
