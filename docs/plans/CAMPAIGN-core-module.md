---
title: "Campaign — core-module"
status: active
updated: 2026-04-28
created: 2026-04-28
module: Core
tags: [campaign, roadmap]
---

# Campaign — core-module

> Branch: `campaign/core-module` | Worktree: /home/sxtnl/dev/smartout.ai-core-module | Module: Core | Started: 2026-04-28

## Vision

Build the **core trygghet-and-support layer** of Smartout: every user landing on the dashboard — admin, manager, employee, in panic, hunting, or exploring — finds their next step in under 5 seconds. Pontus's intent: "ingen skal besøke uten å føle 100% trygghet og support". The campaign delivers this through (a) the rescoped `/dashboard/help` multi-tier hub, (b) the `kb_query` capability that ends the phantom-registration gap, (c) helpdesk-thread continuation surfaces, and (d) the same-page tour harness — all without phantom contracts.

This is the **core** campaign because it touches three system pillars at once:
- **Cascade content layer (K1b)** — workspace_doc_chunk + governance content + curated articles
- **Helpdesk runtime** — engine_state + helpdesk_query capability + Komm continuation
- **Botsson conversational entry** — Runtime A only, ADR-0220 boundary enforced

Council 2026-04-28 verdict: REJECT AS SPECIFIED — APPROVE RESCOPED SUCCESSOR. Trust Gate: CONDITIONAL PASS on G1–G4. ADRs 0219/0220/0221 + L-0147/0148/0149/0150 captured.

## Scope

### In scope
- **v1 (3w)** — `/dashboard/help` panic-first 5-tier hub. Plan: `docs/superpowers/plans/2026-04-28-dashboard-help-v1.md` (19 tasks).
- **`kb_query` capability** — bind existing `searchWorkspaceDocs` so `intent='knowledge'` resolves (G1).
- **Voice fallback** — Runtime B "bytt til chat" handoff for KB queries (G2).
- **Panic-bar helpdesk creation** — routes through existing `helpdesk_query.openTicket` (G3).
- **5 inclusivity invariants** — I-1 reduced motion, I-2 dual-channel state, I-3 400% zoom, I-4 LIX + Forklar enkelt, I-5 TTS output.
- **v1.5 (4-8w later)** — helpdesk thread continuation UI on `/help`, same-page tour harness, auto-update workspace_doc_chunk on `handbook_chapter`/`policy`/`protocol` edit.
- **v2 (12+w)** — B6 doc-ingest pipeline (RAG over journeys), D4 page-takeover harness (cross-page), per-emergency capabilities (lock_workspace, mfa_reset, gdpr_export).

### Out of scope (rejected outright per council)
- "Botsson as literal cascade orchestrator" — `agent-router` (ADR-0073) does this. Botsson is conversational entry point, never router replacement.
- Voice-first KB queries — ADR-0078 forbids voice for PII-adjacent flows; Runtime B has no capability registry.
- `/help` as primary helpdesk page — Komm remains canonical helpdesk thread surface.

### Out of scope for this campaign (separate campaigns)
- Helpdesk Phase 2 (auto-assign, SLA visualizers) — owned by `campaign/helpdesk`.
- Botsson Arena overlay implementation (Emma illustration, immersive backdrop) — owned by `campaign/botsson-arena` (Phase D3).
- Mobile help surface — ADR-0133 boundary; mobile owns its own thin-client help.

## Milestones

### M1 — `/dashboard/help` v1 ships (3 weeks, ~2026-05-19)

Implements `docs/superpowers/plans/2026-04-28-dashboard-help-v1.md`. Sub-sortie: `dashboard-help-v1`.

- [ ] **M1.1** — `kb_query` capability registered + bound (Tasks 1-5 of plan, G1).
- [ ] **M1.2** — Telemetry registry + Server Action + helpdesk routing (Tasks 6-7, G3).
- [ ] **M1.3** — Page tiers 0-5 built (Tasks 8-13).
- [ ] **M1.4** — Voice fallback registered (Task 14, G2).
- [ ] **M1.5** — E2E + accessibility tests pass (Tasks 15-16).
- [ ] **M1.6** — All 4 G-gates verified, polish pass, HANDOFF written (Tasks 17-19).

**Verify:** `pnpm turbo typecheck` green, `pnpm --filter @smartout/e2e test journey-help-v1 + help-accessibility` green, axe-core 0 critical violations, manual smoke on `/dashboard/help` shows panic bar → ticket flow.

### M2 — v1.5: helpdesk thread + same-page tour (4-8 weeks after M1)

Sub-sorties:
- [ ] **M2.1** — Helpdesk thread continuation UI on `/help` (read-only consumer of Komm `channel_message` + `engine_state`).
- [ ] **M2.2** — Same-page tour harness (Botsson `ui.navigate_to` + `ui.highlight_element` consumed on `/help` for guided tours of help-page itself).
- [ ] **M2.3** — Auto-update on `handbook_chapter` / `policy` / `protocol` edit (event-driven re-ingest into `workspace_doc_chunk`).

**Verify:** new E2Es per sub-sortie, existing M1 invariants still PASS.

### M3 — v2: doc-ingest pipeline + cross-page takeover (12+ weeks)

These are **promotion candidates for their own campaigns** if scope grows:
- [ ] **M3.1** — B6 doc-ingest expansion: read `docs/journeys/<slug>/` + `docs/modules/MODULE_*.md` from disk → chunk + embed → `workspace_doc_chunk` (or new `platform_doc_chunk`). Closes Q4 phantom contract per L-0149.
- [ ] **M3.2** — D4 page-takeover harness: new tools (`simulate_click`, `submit_form`, `wait_for_state`) + cross-runtime bridge between Stage Engine and DOM. Closes Q11.d phantom contract.
- [ ] **M3.3** — Per-emergency capabilities (Q10): `lock_workspace`, `mfa_reset`, `gdpr_export`, `terminate_sessions` — each is its own ADR + capability + authority seed (likely 2-4 weeks each).

**Promotion gate:** if any of M3.1/3.2/3.3 reaches 4+ weeks of effort or 3+ ADRs, promote to its own campaign.

## Falsifiable Invariants (CI-enforced where possible)

| # | Invariant | Test | Owner |
|---|-----------|------|-------|
| **I-1** | prefers-reduced-motion → zero looping animation on `/help` | `apps/e2e/tests/help-accessibility.spec.ts` | E2E |
| **I-2** | Every state-change uses 2 channels (text + icon, never color alone) | manual greyscale audit at PR time | UI review |
| **I-3** | 400% zoom no-break (320×800 + zoom) | `help-accessibility.spec.ts` | E2E |
| **I-4** | LIX <40 empati / <50 teknisk on curated articles | manual measurement v1; CI gate v1.5 | content + CI |
| **I-5** | TTS output yes (browser SpeechSynthesis), voice INPUT NO | `help-accessibility.spec.ts` + ADR-0078 audit | UI + ADR-0078 |
| **G1** | `kb_query` registered + bound; `tool-selector.ts:106-115` empty fallthrough removed | runtime smoke check | merge-block |
| **G2** | Voice receives "bytt til chat" when KB intent detected, never empty answer | E2E ultravox session | merge-block |
| **G3** | Panic-bar tickets emit `help.escalated_to_ticket` AND `helpdesk.query.opened` to BOTH `activity_trail` + `engine_event` | `journey-help-v1.spec.ts` | merge-block |
| **G4** | Q4/Q10/Q11.d explicitly out-of-scope, no partial implementations | grep audits at PR time | review |
| **PHANTOM** | Every new capability tool has a registered consumer (per L-0146) — trace producer → consumer end-to-end | `close-feature` checklist | merge-block |
| **MAP-FRESH** | BOTSSON-SYSTEM-MAP.md `verified_against_code` ≤ 7 days old when cited in council briefings (per L-0150) | manual verification per Phase 2.5 | council |

## Cross-cutting law audit (campaign-wide)

- **Workspace scope (Law 1)** — all reads + writes resolve `workspace_id` from auth session. No service-role on browser-callable surfaces.
- **gate_action (Law 2)** — every mutation goes through `gate_action`. M2.1+ writes go through `helpdesk_query.openTicket`; M3.3 emergency actions each get own seed.
- **Channel guard (ADR-0078, ADR-0163, Law 3)** — chat-only enforcement on `kb_query` (PII-adjacent). Voice fallback message when KB query arrives via voice.
- **Telemetry IDs (ADR-0134, Law 4)** — every new emit site lists `workspaceId` + `profileId` `NonEmptyString` requirement.
- **No-service-role-to-L1 (Law 5)** — ingest functions (server-side) use service-role internally; browser never invokes directly.
- **Mobile boundary (ADR-0133, Law 6)** — `/help` is web-only. Mobile employee help is separate route.

## Phantom-Contract Watch (per L-0094 / L-0124 / L-0146 / L-0149)

Campaign explicitly tracks the four phantom-contract shapes:

| Shape | Risk in this campaign | Mitigation |
|-------|------------------------|------------|
| Phantom emit (L-0094) | New `help.*` events declared, `emit()` not wired | Task 6+7 of v1 plan + telemetry registry test |
| Phantom body (L-0124) | Server Action returns `ok:true` without DB side effect | Task 7 wraps `helpdesk_query.openTicket` capability — body is real |
| Phantom consumer (L-0146) | `kb_query` writes to `workspace_doc_chunk` queries no consumer reads | `kb_query` is read-only — no write path; consumer is the chat hero (`BotssonChat`) |
| Phantom Q&A (L-0149) | Q&A spec format encourages confident answers without code-trace | Council 2026-04-28 caught all three (Q4 RAG, Q11.c "never stale", Q11.d "Show me") and deferred to v2 |
| Phantom registration (L-0149 + ADR-0221) | Tool exists in code but unbound to capability | G1 merge-blocker forces verification before "Spør Botsson"-UI ships |

## Key references

- **Spec:** `docs/superpowers/specs/2026-04-28-dashboard-help-design.md`
- **v1 implementation plan:** `docs/superpowers/plans/2026-04-28-dashboard-help-v1.md`
- **ADRs (proposed, this council):** ADR-0219 multi-tier hub · ADR-0220 Botsson conversational front door (bans "orchestrator") · ADR-0221 KB capability registration merge gate
- **Learnings (this council):** L-0147 Phase 3 chair self-reversal · L-0148 "orchestrator" trap word · L-0149 phantom Q&A specs · L-0150 BOTSSON-SYSTEM-MAP staleness cycle
- **Council session log:** `docs/council/COUNCIL-LOG.md` 2026-04-28 entry
- **System map:** `docs/architecture/BOTSSON-SYSTEM-MAP.md` — `verified_against_code: 2026-04-28`
- **Anchor ADRs:** ADR-0073 (agent-router) · ADR-0078 (channel restriction) · ADR-0091/0099 (gate_action) · ADR-0134 (mobile telemetry) · ADR-0152 (activity_trail + engine_event parity) · ADR-0161/0165 (helpdesk ontology) · ADR-0193 (NonEmptyString) · ADR-0197 (phantom contracts class rule)

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).
All campaign-specific decisions registered here.

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
