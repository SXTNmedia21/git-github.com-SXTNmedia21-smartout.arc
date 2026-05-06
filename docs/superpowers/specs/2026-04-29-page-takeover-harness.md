---
title: "Page-Takeover Harness — Botsson can act on the page (M3.2)"
status: draft
created: 2026-04-29
updated: 2026-04-29
module: Core
campaign: core-module
milestone: M3.2
risk_level: high
tags: [help, botsson, takeover, ui-tools, page-tool-kit, cross-runtime, gate-action]
---

# Page-Takeover Harness — "Show me" / "Do it for me"

> M3.2 of campaign/core-module. Botsson goes from *talking about* the page (M2.2 tour) to *acting on* it. Three new client tools registered per-page: `ui.simulate_click`, `ui.submit_form`, `ui.wait_for_state`. Closes the Q11.d phantom contract from M1 spec.
>
> **HIGH RISK** — voluntary mutation by AI agent on user's behalf. Spec front-loads safety: every action is preview-confirmed, gate-checked at runtime, and reversible-by-default. No silent execution.

## Problem

After M2.2, Botsson can navigate + highlight DOM elements. But "vis meg hvor du klikker for å åpne en sak" still requires the user to do the click themselves. M1 spec implied this was OK ("I can show you where") but Q11.d ("Show me") was deferred as phantom contract — Botsson promised more than it could deliver.

The user-visible promise: *"Botsson, åpne en helpdesk-sak for meg"* → Botsson asks confirmation, then performs panic-bar click + confirms drawer + creates ticket. User saves cognitive load on multi-step flows.

The *technical* problem: bridging the Stage Engine (server) to the DOM (client) for real action. This is fundamentally different from M2.2 (read-only DOM scroll/highlight). It changes the trust contract.

## Goal

Add three page-scoped client tools that let Botsson perform DOM actions IN A CONTROLLED WAY:

- `ui.simulate_click({ target_id, label })` — click a known, allow-listed button. Always shows a 3-second "About to click X" preview overlay before firing. ESC cancels.
- `ui.submit_form({ form_id, field_values, label })` — fill named fields + submit. Always shows a preview drawer of "I will set: name=X, role=Y, then click Submit". ESC cancels. Confirms before fire.
- `ui.wait_for_state({ predicate, timeout_ms })` — wait until a known DOM/state condition is met (e.g. "panic-bar drawer is open"). No mutation, just observation. Returns `{ ok: true, met: bool, elapsed_ms }`.

Each tool is gated server-side via `gateAction` capability `page_takeover` (new) at INVOCATION time. Confirm-or-cancel UI is mandatory. Allow-list of click targets + form schemas are static — Botsson cannot synthesize arbitrary selectors.

## Scope

### In scope (v1)

- New `ui.simulate_click` + `ui.submit_form` + `ui.wait_for_state` tools.
- Per-page allow-list of clickable target_ids (extends M2.2 TOUR_ANCHORS pattern with action variants).
- Per-page form_id allow-list with explicit field schemas (Zod-validated client-side + re-validated server-side via gateAction).
- Mandatory preview overlay (extends M2.2 TourHighlight + adds confirmation chip "Klikk for å bekrefte / ESC for å avbryte").
- Server-side `gateAction("page_takeover", "<action>")` at invocation. Authority seed per-action. Default deny (admin role only initially).
- Telemetry: `page_takeover.action_proposed` + `page_takeover.action_confirmed` + `page_takeover.action_cancelled` + `page_takeover.action_executed`. Routed posthog + activity_trail. Audit trail mandatory.
- Allow-list initial scope:
  - `/dashboard/help` — `panic_bar_human_button` (the "Jeg trenger et menneske" panic action, which already has its own confirmation drawer via Sheet — double-confirm).
  - That's it for v1. Each new takeover target requires its own ADR.

### Out of scope (v1, v2 candidates)

- Free-form selector synthesis ("Botsson, click the third blue button on this page") — never. Allow-list only.
- Multi-step macros (`open_ticket_for_locked_out_user`) — defer to v2 mission orchestration.
- Forms with sensitive PII fields (employment contracts, payroll) — explicit ADR required per-field.
- Cross-page takeover — single page only in v1.
- Mobile (ADR-0133 boundary).
- Voice-driven takeover — explicitly forbidden in v1 (chat-only). ADR-0078 channel restriction extended.

## Falsifiable Invariants

| # | Invariant | Test |
|---|-----------|------|
| **I-1** | Every takeover action shows preview overlay BEFORE firing. Tool implementation must call previewAction() before action.execute(). | E2E + grep |
| **I-2** | ESC cancels preview without executing. Off-target click cancels. | E2E |
| **I-3** | Preview persists ≥3000ms (visual+confirm chip) before allowing confirm — prevents reflexive confirm-clicks. | E2E |
| **I-4** | Allow-list is static — only target_ids in TAKEOVER_TARGETS const are accepted. Unknown ids return `{ok: false, reason: "unknown_target"}`. | E2E |
| **I-5** | Form field values match Zod schema at server-side gateAction call (re-validated, not just client-trusted). | unit + E2E |
| **G-AUDIT** | Every action_executed event MUST have matching action_proposed + action_confirmed predecessors in same session. Otherwise: phantom execution. | activity_trail audit |
| **G-GATE** | gateAction("page_takeover", action) called BEFORE every execution. Test: skip gate → execution short-circuits with explicit failure. | unit |
| **G-DEFAULT-DENY** | Authority seed defaults `level=disabled` for page_takeover. Admin must explicitly enable per-workspace via authority config UI (not in v1 scope, but seed must default-deny). | migration audit |

## Open Questions

- Q1: Should preview overlay block keyboard/pointer to rest of page (modal-style) or be ghosted (still interactive)? Default: modal-blocking on body except overlay confirm chip + cancel area. Reason: prevents user from clicking other things mid-preview and ending up in a confused state.
- Q2: When Botsson invokes `simulate_click` on a button that opens a Sheet/Drawer with its own confirmation, is the takeover scope (a) the click only, user does the second confirm? OR (b) Botsson can chain through both? Default: (a). Each takeover step is one user-confirmation. No chaining.
- Q3: How does authority seed look? Default `level=disabled` per-workspace, admin must opt-in. Per-action capability slug? Granular: `page_takeover.help.panic_bar_human_button`? Coarse: `page_takeover.help.*`? Default: granular per target_id.
- Q4: Failure mode — if `simulate_click` clicks a button that errors, what does Botsson see? Default: tool returns `{ok: true, executed: true}` regardless of post-click state. Botsson's own subsequent observation (or wait_for_state) detects failure. Don't conflate "I clicked" with "the click succeeded downstream."
- Q5: Does this need ADR-0078 channel-restriction extension? Default: yes — chat-only. Voice gets a polite refusal.

## References

- ADR-0219 — `/dashboard/help` multi-tier hub (M1)
- ADR-0220 — Botsson conversational front door (not orchestrator)
- ADR-0078 — channel restriction (this spec extends to forbid voice for takeover)
- ADR-0091/0099 — gate_action mandatory for mutations (this spec adds capability `page_takeover`)
- ADR-0193 — NonEmptyString brand (telemetry payloads)
- ADR-0133 — mobile boundary
- M1 HANDOFF — Q11.d "Show me" deferred
- M2.2 spec — same-page tour (read-only DOM)
- L-0149 — phantom contracts in Q&A specs
- Existing pattern: M2.2 useHelpTour + TourHighlight + tour-anchors allow-list
- New capability: `page_takeover` — defined in this campaign, ADR pending
