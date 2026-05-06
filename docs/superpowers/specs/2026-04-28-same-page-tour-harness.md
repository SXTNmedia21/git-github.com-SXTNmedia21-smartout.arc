---
title: "Same-Page Tour Harness on /dashboard/help (M2.2)"
status: draft
created: 2026-04-28
updated: 2026-04-28
module: Core
campaign: core-module
milestone: M2.2
tags: [help, botsson, tour, ui-tools, page-tool-kit]
---

# Same-Page Tour Harness on `/dashboard/help`

> M2.2 of campaign/core-module. Botsson can guide users *within* `/dashboard/help` itself — point at panic bar, point at quick-paths, walk through tiers — using two new page-scoped tools: `ui.navigate_to` and `ui.highlight_element`.

## Problem

After M1 + M2.1, `/dashboard/help` has rich content (panic bar, chat hero, quick paths, curated articles, kontakt footer, active-ticket badge). A first-time visitor cannot ask Botsson "show me where to ask for help" and have Botsson visually point at it. Botsson's chat in Tier 1 can talk *about* the page but cannot *act on* it.

The Botsson harness already supports per-page client tool kits (M1 wired `HelpVoiceToolsBridge` for `kb_query_voice_fallback`). Same shape can host page-action tools. The question is the contract for those tools — what they expose, what they refuse, and how they degrade under reduced motion.

## Goal

Add two page-scoped tools registered on `/dashboard/help` (and reusable by future pages):

- `ui.navigate_to({ target_id })` — smooth-scroll the page to a known anchor (`panic-bar`, `chat-hero`, `quick-paths`, `curated-articles`, `kontakt-footer`, `active-ticket-badge`). Returns `{ ok, scrolled_to }`.
- `ui.highlight_element({ target_id, label, duration_ms? })` — apply an outline overlay + small floating label to a known anchor. Auto-dismisses after `duration_ms` (default 5000). Returns `{ ok, highlighted }`.

Both tools live in a new `apps/web/src/app/Botsson/_components/help-tour-tools-bridge.tsx`, registered via `useRegisterTools("help", kit)` (mirrors M1 voice-fallback pattern).

## Scope

### In scope

- New page-tool kit `helpTourKit` exporting both tools.
- `HelpTourToolsBridge` Client Component mounted from `/dashboard/help/page.tsx` alongside the existing voice bridge.
- Anchor allow-list defined as a TypeScript const at `apps/web/src/app/dashboard/help/_lib/tour-anchors.ts` — only these `target_id` values are valid.
- DOM manipulation: pure read-only (scroll, overlay div). NO mutation, no Server Action, no DB write.
- Reduced-motion respect: `prefers-reduced-motion: reduce` → instant scroll instead of smooth, static outline (no flash animation).
- Telemetry: `help.tour_step_invoked` (per tool call) + `help.tour_completed` (when 3+ steps invoked in same chat session). Routing: posthog + activity_trail.
- Tour cancellation: clicking anywhere outside the highlight overlay, OR ESC key, clears all active highlights and emits `help.tour_cancelled`.

### Out of scope

- Cross-page navigation (handled by existing `ui.navigate_to_page` if it exists on Botsson; this M2.2 tool is same-page-only).
- Authoring tour scripts / curated guided tours stored in DB — Botsson generates step sequences from chat context; no persistent tour records.
- Mobile (ADR-0133 — mobile owns its own tour layer).
- Voice-driven tours (Runtime B has no DOM access — text channel only per ADR-0078).
- Form-fill / click simulation (Q11.d in M3 v2 scope).

## Falsifiable Invariants

| # | Invariant | Test |
|---|-----------|------|
| **I-1** | Anchor allow-list is exhaustive — `ui.navigate_to` and `ui.highlight_element` reject unknown `target_id` with `{ ok: false, reason: "unknown_target" }` | E2E |
| **I-2** | `prefers-reduced-motion: reduce` disables smooth-scroll (instant jump) and disables flash animation (static outline only) | E2E |
| **I-3** | ESC key OR off-target click clears all highlights and emits `help.tour_cancelled` | E2E |
| **I-4** | `ui.highlight_element` overlay renders ABOVE all `/help` content but BELOW any open Sheet/Dialog (z-index layering) | manual check + visual regression if available |
| **G-RO** | Tour tools never call `emit()` for `*.opened` events, never insert/update DB. Grep `help-tour-tools-bridge.tsx` and `tour-anchors.ts` returns 0 mutation paths. | merge-block |
| **G-ANCHORS** | Every `target_id` in the allow-list maps to an existing `id` attribute on `/dashboard/help` page render (CI grep: each anchor const has at least one matching `id="<anchor>"` in dashboard/help/) | merge-block |

## Open Questions

- Q1: Should `ui.highlight_element` support multiple active highlights at once (chained tour) or only one at a time? (Default: one at a time, new highlight clears prior.)
- Q2: When user is on /help and Botsson decides to invoke `ui.navigate_to` from the chat hero, should focus management (`element.focus()`) kick in for accessibility? (Default: yes — set tabindex=-1 if needed and call .focus() so screen readers announce.)
- Q3: `help.tour_completed` threshold — 3 steps or "session ended without cancel"? (Default: 3+ same-session step invocations within 60s window.)

## References

- ADR-0219 — `/dashboard/help` multi-tier hub (M1)
- ADR-0220 — Botsson conversational front door (M1) — tour tools fit "intent classifier" + "cross-runtime bridge" framing, NOT "orchestrator"
- ADR-0133 — mobile boundary
- ADR-0078 — channel restriction (chat-only for tour invocation; voice channel gets `kb_query_voice_fallback` redirect)
- M1 HANDOFF — `docs/handoffs/HANDOFF-dashboard-help-v1.md` (HelpVoiceToolsBridge pattern)
- M2.1 HANDOFF — `docs/handoffs/HANDOFF-m2-thread-continuation.md` (page Server Component composition pattern)
