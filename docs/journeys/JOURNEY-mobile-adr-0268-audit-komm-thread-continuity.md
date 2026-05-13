---
title: "Journey — Helpdesk threads reachable after (komm) tab-removal"
feature: mobile-adr-0268-audit
journey: komm-thread-continuity
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, helpdesk, komm, adr-0163, adr-0268]
---

# Journey: Helpdesk threads reachable after `(komm)` tab-removal

**Role:** any authenticated user (employee, manager, admin)

**Precondition:**
- ADR-0268 has removed `(komm)` from the navigable tab bar (status confirmed via `apps/mobile/app/(app)/_layout.tsx` having `(komm)` as `href: null` hidden entry)
- ADR-0163 (kanaler-som-helpdesk) absorption path implemented OR documented as future scope
- User has at least one historical helpdesk thread (created in legacy `(komm)` tab) OR a current notification of a new helpdesk message

## Happy Path

1. User receives push notification "Ny helpdesk-melding" → System resolves deeplink via `packages/notifications/src/deep-links.ts`
2. Deeplink targets Chat surface (per ADR-0163 absorption) OR the hidden `(komm)/[channelId]` route → User lands on the helpdesk thread
3. User reads thread + replies → System persists message via existing helpdesk capability
4. User opens Chat tab manually → System lists all conversations including helpdesk threads in the same list
5. User taps a helpdesk thread → System opens the thread in Chat surface (not the deleted `(komm)` tab)

**Postcondition:**
- No 404 on any helpdesk thread URL
- No "tab not found" rendering
- Telemetry events from helpdesk interactions still emit via `getProfileContext()` (ADR-0134)
- ADR-0163 absorption either functional OR documented as deferred with continuity fallback

## Error Paths

- **Scenario:** Push deeplink targets `(komm)/[channelId]` and absorption not yet wired → System falls back to hidden `(komm)` route which still renders content (since `href: null` only removes from tab bar, route still exists). No 404.
- **Scenario:** User searches Chat for a helpdesk message before ADR-0163 absorption complete → Search returns helpdesk messages from legacy storage IF ADR-0163 unified store live; otherwise returns empty + toast "Search across helpdesk coming soon".
- **Scenario:** New helpdesk thread initiated by support → Routed to Chat thread list (per ADR-0163) OR queued in `(komm)` legacy table. Either path must be reachable.

## Verification

- [ ] Implementation matches the steps above OR continuity fallback (hidden `(komm)` route) documented
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — OR Council verdict that E2E is gated on ADR-0163 absorption completion
- [ ] Manually tested: push notification → deeplink → thread renders without error
- [ ] Council (run-council) signed off on continuity story — required per ADR-0268 accept-checklist item 4

**Mark `status: verified` in frontmatter when all four boxes are checked.**
