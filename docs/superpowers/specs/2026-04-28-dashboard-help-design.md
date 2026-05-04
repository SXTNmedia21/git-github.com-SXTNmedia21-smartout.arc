---
title: "/dashboard/help — Multi-Tier Help Hub Design"
status: approved
updated: 2026-04-28
created: 2026-04-28
module: help
tags: [help, botsson, helpdesk, accessibility, panic-first, design-spec, council-2026-04-28]
---

# /dashboard/help — Design Spec (Council-Approved Rescope)

> **Verdict source:** System Council 2026-04-28 (5 reviewers: steward, supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer). Verdict: REJECT AS SPECIFIED — APPROVE RESCOPED SUCCESSOR. Trust Gate: CONDITIONAL PASS (G1–G4 merge-blockers).
>
> **Derived from:** Pontus's brainstorming intent ("ingen skal besøke uten å føle 100% trygghet og support") + 12-question Q&A strawman (rejected as written, intent preserved).

---

## North Star

A user lands on `/dashboard/help` in one of three cognitive states. The page must serve all three without compromise:

- **Panic** — something is broken or scary (locked out, payroll wrong, unsafe situation). Time-to-help < 5 seconds.
- **Hunt** — known target, looking for a specific thing ("hvor er X?"). Time-to-target < 10 seconds.
- **Explore** — open question, low pressure ("hva kan Botsson hjelpe meg med?"). Engagement-friendly.

The page is for **admin/manager** primarily, **employee secondary** (mobile owns employee help separately per ADR-0133).

---

## Core Architecture (Approved)

### One page, three concerns, no conflation

| Concern | Where it lives | What /help does |
|---------|----------------|-----------------|
| **Governance content (K1b)** — policy, protocol, procedure, runbook, knowledge_test, control_list | `policy` / `protocol` / governance tables | Renders + searches existing content; does NOT introduce new content type |
| **Helpdesk runtime** — tickets, SLA, assignment | `engine_state` per ADR-0161; `channel.helpdesk_enabled` per ADR-0165; capability `helpdesk_query` (🟢 registered) | Hosts ticket-creation entry points (panic bar + footer); thread continuation lives in Komm |
| **AI agent surface** — Botsson | `agent-router` (ADR-0073) + `mr-botsson` mission scope (already wired on `/dashboard/help` in DashboardShell.tsx:72) | Chat hero on page (Runtime A only — `/api/botsson/chat`) |

### Three Botsson runtimes — only Runtime A reaches capabilities

Per `system-agent-coordinator` Phase 3 finding:

| Runtime | Path | Authority | Capability registry | Used by /help |
|---------|------|-----------|---------------------|---------------|
| **A** | `/api/botsson/chat` → Stage Engine `agent-router.ts` | gate_action enforced | All 15 capabilities | YES — page hero |
| **B** | Ultravox client tools (`BotssonTools.ts`) — voice | NONE | NONE (fixed browser tools) | Continuation only — corner orb DOCKED state |
| **C** | `runBotssonAgent` (`packages/ai/src/agents/botsson.ts`) | — | Hardcoded 5 of 15 (DEAD CODE) | NEVER — flagged for deletion |

**Constraint:** Page hero is chat-only. Voice (Runtime B) can join the same `engine_state` for continuity but cannot answer KB queries (no capability registry). Voice fallback for KB query: "Det spørsmålet svarer jeg på i chat — bytt over?"

---

## Page Layout (panic-first, classic-leaning)

Single column, max-w-3xl center, no sidebar. Vertical hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 0: PANIC BAR (sticky 56px, top)                        │
│  🔓 Jeg er låst ute · 📅 Noe er feil med vakta · 👤 Menneske │
├─────────────────────────────────────────────────────────────┤
│ TIER 1: BOTSSON CHAT HERO (cap 480px, Runtime A only)       │
│  "Hei {firstName} — hva trenger du hjelp med?"               │
│  [input field]              ⌘K hint                          │
├─────────────────────────────────────────────────────────────┤
│ TIER 2: 4 QUICK-PATH CARDS (role-personalized)              │
│  [Vakter & vaktbytte]   [Lønn & timer]                       │
│  [Onboarding]           [Avvik & HMS]                        │
├─────────────────────────────────────────────────────────────┤
│ TIER 3: MEST BRUKT NÅ (5 hand-curated KB articles)          │
│  Plain link list — no card chrome                            │
├─────────────────────────────────────────────────────────────┤
│ TIER 4: REMOVED for v1 (was tour-takeover; deferred to v1.5) │
├─────────────────────────────────────────────────────────────┤
│ TIER 5: KONTAKT FOOTER (svartider per kanal + status badge) │
└─────────────────────────────────────────────────────────────┘
```

**Tier semantics:**

- **Tier 0 (Panic Bar):** Three buttons. Each opens a confirmation drawer (NOT modal, NOT one-click destructive). Drawer routes to existing `helpdesk_query.openTicket` capability with category metadata. Always visible during scroll. WCAG 2.2 *Consistent Help* — same place every time.
- **Tier 1 (Botsson hero):** Geist Sans heading (NOT Instrument Serif — wrong tone for help). Single input. Capped at 480px tall — does not dominate fold. Greeting personalized via `firstName`. **No aurora, no Emma illustration, no immersive backdrop** — wrong surface (those belong to `/Botsson` arena).
- **Tier 2 (Quick paths):** 4 cards, role-personalized. Click navigates to KB section, NOT chat. Hunters skip Botsson entirely.
- **Tier 3 (Mest brukt):** 5 articles, hand-curated frontmatter for v1. NO RAG yet (deferred to v2). Plain `<ul>` list, lift-on-hover, no card chrome (40% chrome reduction principle).
- **Tier 5 (Footer):** Honest svartider per kanal + system status badge. Trust through transparency.

### Botsson dual-surface composition

Corner orb (Runtime B) and page hero (Runtime A) **share one `engine_state`**:

- Default state on /help: corner orb DOCKED (faded, scale 0.9, opacity 0.5, non-interactive).
- User scrolls past hero (>600px): corner orb returns to ARMED.
- User clicks Panic Bar item: corner orb fully dismissed for 30s (aria-live announcement).

One conversation, two surfaces. Single-state, no divergence.

---

## 5 Falsifiable Inclusivity Invariants

"World's most inclusive" replaced with measurable invariants. The marketing line lives in copy ("Bygget for alle — også når du ikke har tid eller energi til å lete"). The spec ships testable obligations.

| # | Invariant | Test method | Owner |
|---|-----------|-------------|-------|
| **I-1** | `prefers-reduced-motion: reduce` → zero looping animation on /help. Orb static gradient, aurora killed, particle layer not rendered. | Playwright with `reducedMotion: 'reduce'`. Assert no `animation-name` other than `none` on visible elements. | E2E suite |
| **I-2** | Every state-change (loading, error, empty, success) communicates via TWO independent channels: text + icon, OR text + position. Color alone forbidden. | Storybook a11y addon + manual greyscale screenshot review. | UI |
| **I-3** | Page operable at 400% zoom (1280px → 320px effective) without horizontal scroll, without content loss. | Playwright viewport 320×800 + `page.evaluate(() => document.body.style.zoom = 4)`. Assert no `overflow-x: scroll`. | E2E suite |
| **I-4** | LIX <40 for empathy microcopy, LIX <50 for technical articles. "Forklar enkelt" toggle re-renders content via server-side capability rewrite (NOT client-side). | LIX-score check in CI on `nb` strings (script: `apps/web/scripts/lix-check.ts`). | i18n CI |
| **I-5** | TTS output: every KB article + Botsson reply has "Les opp" button using browser-native `SpeechSynthesis`. Voice INPUT forbidden per ADR-0078. Toggle persists per profile. | Playwright clicks "Les opp", asserts `speechSynthesis.speaking === true`. | UI |

**Rejected for v1 inclusivity scope:** WCAG 2.2 AAA (table-stakes is AA), OpenDyslexic font, multi-language beyond NO+EN (PL/LT/AR deferred per signal). Add as v6 invariant if signal demands.

---

## Empati-tone Microcopy (canonical phrases)

Specific phrases, not categories. Every error state names the most likely cause + offers the action. Reassurance via specificity, not soft adjectives.

| State | Wrong | Right |
|-------|-------|-------|
| Botsson unavailable | "Botsson is unavailable." | *"Botsson er offline akkurat nå. Et menneske svarer innen 4 timer på hverdager. Klikk her for å sende meldingen som e-post."* |
| Search no results | "No results." | *"Ingen artikler matchet '{query}'. Prøv: vakt, lønn, vaktbytte. Eller spør Botsson — han forstår fritekst."* |
| Auth error | "Authentication failed." | *"Vi kunne ikke logge deg inn. Du er ikke utestengt. Mest sannsynlig: feil passord (75%) eller MFA-kode utløpt (20%). Tilbakestill passord."* |
| Network error | "Network error." | *"Vi når ikke serveren akkurat nå. Det du skrev er trygt — vi sender det så snart vi får tilbake nett."* |

Empty states never use the word "empty" — they describe what *would* be there.

---

## Trust Gate Merge-Blockers (G1–G4)

**These are merge-blockers for v1. PR cannot land without all four resolved.**

### G1: `kb_query` capability registered + bound to `searchWorkspaceDocs`

Today: `searchWorkspaceDocs` exists at `packages/ai/src/tools/workspace-docs.ts:71` but is unregistered. `tool-selector.ts:106-115` returns `[]` for `intent='knowledge'`. Any "Spør Botsson om håndboken"-UI lies until this is wired.

**Required:**
- New capability `packages/ai/src/capabilities/kb_query/` with `index.ts` + `tools.ts`.
- Registered in `packages/ai/src/capabilities/registry.ts`.
- Listed in `packages/ai/src/capabilities/types.ts` `CapabilityName` union.
- `tool-selector.ts` resolves `intent='knowledge'` → `kb_query` capability tools (not empty fallthrough).
- Authority seed migration with sensible default (read-only, scope: own workspace).
- Integration test: agent receives "hvor er kontrakten min?" → tool fires → returns chunks.

### G2: Voice fallback "bytt til chat" for KB queries

Runtime B (Ultravox voice) has no capability registry. If user asks Botsson via voice "where is my contract?", Runtime B cannot reach `kb_query`. Today's fallthrough behavior is silent empty `[]` per `tool-selector.ts:106-115`.

**Required:**
- Voice client tool (`BotssonTools.ts`) detects KB-query intent and returns: *"Det spørsmålet svarer jeg på i chat — vil du bytte over?"* with a UI surface to switch to chat (corner orb expand).
- Test: Ultravox session with KB query → voice does NOT attempt empty answer; returns chat-handoff message.

### G3: Helpdesk creation routes via `helpdesk_query.openTicket` capability

NEVER side-channel inserts. Panic bar buttons must route through the existing capability so `emit()` reaches `activity_trail` AND `engine_event`.

**Required:**
- `/dashboard/help/_components/PanicBar.tsx` calls `openTicketAction` Server Action.
- `openTicketAction` dispatches `helpdesk_query.openTicket` capability (not raw insert).
- Integration test: panic-bar click → both `activity_trail` AND `engine_event` receive `helpdesk.ticket.created`.
- Verifies parity per ADR-0152 amendment + L-0094 phantom-emit anti-pattern.

### G4: Q4 (RAG-journeys), Q10 (emergency self-serve), Q11.d (cross-page takeover) explicitly OUT-OF-SCOPE

Each promise must be deferred in spec + code comments + UI copy. No partial implementations that imply readiness.

**Required:**
- Spec lists these as v2 explicitly (this document).
- Code: no stubs, no "coming soon" buttons, no greyed-out actions hinting future capability.
- UI copy: if user asks "Forklar enkelt" (Q4 dependency), use server-side rewrite of EXISTING content — do NOT promise auto-generated articles.

---

## Phase Plan

### v1 (3 weeks) — what ships

**Frontend:**
- Tier 0 Panic Bar with 3 buttons → drawer with two-step confirm → `helpdesk_query.openTicket`
- Tier 1 Botsson chat hero (Runtime A only)
- Tier 2 4 role-personalized quick-path cards
- Tier 3 5 hand-curated KB articles (frontmatter-driven, no RAG)
- Tier 5 Kontakt footer with svartider + status badge
- Corner orb DOCKED state on /help (Runtime B)
- 5 invariants I-1 through I-5
- TTS output via browser SpeechSynthesis
- Critical-action drawers with two-step confirm

**Backend:**
- `kb_query` capability registered + bound to `searchWorkspaceDocs` (G1)
- Voice fallback for KB queries (G2)
- Panic bar wires to existing `helpdesk_query.openTicket` (G3)

**Telemetry (new emit sites):**
- `help.search_performed` — workspaceId + actor + query + result_count
- `help.article_opened` — workspaceId + actor + article_id + source (curated)
- `help.escalated_to_ticket` — workspaceId + actor + ticket_id (engine_state.id)
- `help.tts_invoked` — workspaceId + actor + content_id + duration

All require workspaceId + profileId non-empty per ADR-0134.

### v1.5 (4–8 weeks after v1)
- Helpdesk thread continuation UI on /help (today lives only in Komm)
- Same-page tour harness ("Show me" #1 — highlight existing button on current page)
- Auto-update workspace_doc_chunk on `handbook_chapter` / `policy` / `protocol` edit (event-driven re-ingest)

### v2 (12+ weeks, separate campaigns)
- **B6 doc-ingest pipeline** — periodic re-embed of `docs/journeys/<slug>/` + `docs/modules/MODULE_*.md` into `workspace_doc_chunk` (or new `platform_doc_chunk` table — workspace scoping decision still open). Closes Q4 phantom contract.
- **D4 page-takeover harness** — generalize Schedule's proposal-confirmation pattern. New tools (`simulate_click`, `submit_form`, `wait_for_state`) + cross-runtime bridge between Stage Engine and DOM. Closes Q11.d phantom contract.
- **Per-emergency capabilities** (Q10) — `lock_workspace`, `mfa_reset`, `gdpr_export`, `terminate_sessions` — each ships with own ADR + capability + authority seed + emit registration. Each is its own 2-4 week project.

### Rejected outright (not v2, not later)
- "Botsson as literal cascade orchestrator" — `agent-router` (ADR-0073) does this. Botsson is conversational entry point, not router replacement. (See ADR-0220.)
- Voice-first KB queries — ADR-0078 channel restrictions plus Runtime B has no capability registry.
- /help as primary helpdesk page — Komm remains the helpdesk hub. /help routes to it; does not replace it. (See ADR-0219.)

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Two Botsson runtimes (chat hero + corner orb) silently diverge — user types in one, voice doesn't see context | HIGH | Single `engine_state` per user session on /help. Both surfaces read/write same state. E2E test: type in hero → corner orb voice answers context-aware. |
| 2 | `kb_query` capability ships unbound or stubbed — "Spør Botsson"-UI lies | HIGH | G1 merge-blocker. Code-review confirms `tool-selector.ts` reaches `searchWorkspaceDocs` for `intent='knowledge'`. Integration test: ask Botsson "hvor er kontrakten min?" → tool fires → result returned. |
| 3 | Helpdesk panic bar bypasses canonical `emit()` — `activity_trail` + `engine_event` parity broken (L-0094) | MEDIUM | G3 merge-blocker. Use existing `helpdesk_query.openTicket` capability, never insert directly. Verify both destinations receive event. |
| 4 | "Forklar enkelt" implemented client-side — translation drifts, not auditable | MEDIUM | I-4 invariant: server-side rewrite via capability tool. Each rewrite logged. Avoid client-only "simplification". |
| 5 | BOTSSON-SYSTEM-MAP.md staleness creates false signal for next council/developer | MEDIUM | Phase 7 task: update L4/L5 status to 🟢. Add "Last verified against code" timestamp. (See L-0150.) |

---

## Cross-cutting law audit

- **Workspace scope (Law 1):** all reads and writes resolve `workspace_id` from auth session. RLS gates all DB access. No service-role escape proposed for v1.
- **gate_action (Law 2):** every mutation goes through `gate_action`. Panic-bar tickets route through `helpdesk_query.openTicket` (already gated, authority seeded). KB queries are read-only (gate_action read pattern). No new mutations introduced beyond ticket creation.
- **Channel guard (ADR-0078, ADR-0163, Law 3):** chat-only enforcement on `kb_query` (PII-adjacent). Voice fallback message when KB query arrives via voice.
- **Telemetry IDs (ADR-0134, Law 4):** every new emit site lists workspaceId + profileId requirement. No empty-string fallbacks.
- **No-service-role-to-L1 (Law 5):** ingest function (server-side) uses service-role internally; browser never invokes it directly. v2 expansion of ingest preserves this.
- **Mobile boundary (ADR-0133, Law 6):** /help is web-only (admin authoring surface). Mobile employee help is separate route + thin client.

---

## References

- **Council 2026-04-28** — System Council session, full 5-reviewer panel
- **ADR-0073** — agent-router as orchestrator (locks "orchestrator" semantics)
- **ADR-0078** — engine_process channel restriction (voice/PII forbidden)
- **ADR-0091** — gate_action mandatory for mutations
- **ADR-0099** — Unified Authority Gate
- **ADR-0133** — Web composes, mobile executes
- **ADR-0134** — Mobile telemetry contract (workspace_id + profile_id required)
- **ADR-0152** — Activity-trail + engine_event parity contract
- **ADR-0161** — Helpdesk ontology: ticket = engine_state (Alt D)
- **ADR-0163** — ADR-0078 amendment, allowedChannels mandatory for PII
- **ADR-0165** — Progressive channel discriminator (`helpdesk_enabled` flag)
- **ADR-0197** — Phantom contracts class rule
- **ADR-0219** — /dashboard/help as Multi-Tier Hub (proposed, this council)
- **ADR-0220** — Botsson as Conversational Front Door (proposed, this council)
- **ADR-0221** — KB Capability Registration as Merge Gate (proposed, this council)
- **L-0094** — Phantom emit anti-pattern
- **L-0124** — Phantom body anti-pattern
- **L-0146** — Phantom consumer pattern
- **L-0147** — Phase 3 chair self-reversal pattern (this council)
- **L-0148** — "Orchestrator" trap word in AI specs (this council)
- **L-0149** — Phantom contracts in Q&A specs (this council)
- **L-0150** — BOTSSON-SYSTEM-MAP staleness cycle (this council)
- **BOTSSON-SYSTEM-MAP.md** — needs update (L4 helpdesk_query 🔴 → 🟢, L5 trending 🟢)

---

## Approval

- **Pontus Lindroth** — 2026-04-28: APPROVED rescoped v1 + 4 G-conditions
- **System Council** — 2026-04-28: REJECT AS SPECIFIED, APPROVE RESCOPED SUCCESSOR
