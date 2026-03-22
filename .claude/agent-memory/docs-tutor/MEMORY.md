# Docs Tutor Memory

## Last Audit (2026-03-04)

### Phase 1: Full Audit Results

| Page                | Route                  | Status      | Gap Size | Notes                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kom i gang          | /docs/kom-i-gang       | Good        | Small    | Accurate. 5-step wizard matches code concept. Invitation methods match. Minor: code doesn't show a dedicated onboarding wizard route yet.                                                                                                                                     |
| Onboarding          | /docs/onboarding       | Decent      | Medium   | Three-system model (trainee, modulreiser, protokoll) is accurate. 48h rule correct. Sandbox table correct. Missing: no actual journey system code visible yet.                                                                                                                |
| Vaktplan            | /docs/vaktplan         | **Updated** | Large    | Added: DnD, batch actions, monthly view, day control panel, open shifts, publish overview, template save/load/edit. Removed: stale "lag-vaktplan" nav item.                                                                                                                   |
| Ansatte             | /docs/ansatte          | Good        | Small    | Org structure, roles, statuses all match code. Profile per workspace correct.                                                                                                                                                                                                 |
| Oppgaver og rutiner | /docs/oppgaver-rutiner | Decent      | Small    | Driftsøkt lifecycle correct. Hooks table correct. Governance chain correct. No significant code gaps found.                                                                                                                                                                   |
| HACCP               | /docs/haccp            | Decent      | Small    | 7 principles mapping is conceptual. No dedicated HACCP tables in migrations yet — uses governance model. Accurate for design intent.                                                                                                                                          |
| Kommunikasjon       | /docs/kommunikasjon    | **Updated** | Large    | Complete rewrite. Now matches actual DB schema: `chat_conversation` (not `chat_channel`), 3 types (group/dm/ai), `chat_participant`, reactions, reply-to, realtime via Supabase. Added: escalation routing details, notification categories, rate limiting, handoff delivery. |
| Lise AI-assistent   | /docs/ai-assistent     | **Updated** | Large    | Replaced "8 AI-motorer" with "8 kapabiliteter" matching actual `engine_authority_config` table. Authority levels now match code: autonomous/confirm/suggest/read_only/disabled. Added AI config page description.                                                             |
| Rapporter           | /docs/rapporter        | **Updated** | Medium   | Added: actual reconciliation UI structure (day list + approval panel with 3 tabs: Omsetning/Vakter/Avvik). Added: blocking deviations, approve/reject flow, shift approval section.                                                                                           |
| Innstillinger       | /docs/innstillinger    | Decent      | Small    | Stripe, GDPR, languages, integrations all accurate. Opening hours settings component exists.                                                                                                                                                                                  |
| API                 | /docs/api              | Good        | Small    | Large detailed page (~700 lines). Matches workspace-api gateway pattern.                                                                                                                                                                                                      |

### Phase 2: Kommunikasjon Deep Update

Key changes:

- **DB schema mismatch fixed**: Old page referenced "avdeling/team/driftsøkt/egendefinert/direktemelding" channel types from MODULE_9 design doc. Actual DB has `chat_conversation_type` enum with `group`, `dm`, `ai`. Updated to match code.
- **Real features documented**: Reply-to-message, reactions (toggle), search in conversations, system messages, unread count, realtime via Supabase Realtime
- **Added sections**: Escalation routing (3-level chain with timeouts), notification categories table, handoff/briefing delivery table, rate limiting details, announcement read confirmation

### Phase 3: Other Major Updates

1. **AI-assistent**: "8 AI-motorer" was aspirational design doc language. Actual code has 8 capabilities in `engine_authority_config` with 5 authority levels. The capabilities (knowledge, schedule, training, operations, profile, communication, memory, payroll) are the real system.

2. **Vaktplan**: Added DnD drag-and-drop (using @dnd-kit/core), batch action bar, monthly view, day control panel/sheet, open shift dialog, template CRUD (save/load/create/edit), publish overview dialog, absence popover, employee drawer, print support, broadcast dialog, status strip.

3. **Rapporter**: Updated daglig avstemming section to reflect actual reconciliation UI: DayList + DayApproval panels, 3 tabs (Omsetning/Vakter/Avvik), blocking deviations concept, approve/reject with notes.

4. **Navigation**: Updated sidebar items for all 4 changed pages to match actual heading IDs.

5. **Overview page**: Updated descriptions for Kommunikasjon, AI-assistent, and Vaktplan cards.

### Gaps Still Remaining

1. **Onboarding page**: No actual onboarding journey code found. The `onboarding-assistant` route exists but is thin. Module journeys and trainee-modus are design concepts not yet reflected in code.
2. **HACCP page**: Content is accurate for the governance design, but no dedicated HACCP tables exist yet in migrations. Temperature logging is planned.
3. **Oppgaver page**: Driftsøkt/hooks/governance chain is conceptually correct but `department_session` table implementation is slim.
4. **Missing pages**: No dedicated "Sesonger" or "Daglig drift" pages. Season planning has full implementation (`/dashboard/season` with budget, day-factors, hour-factors).
5. **Ansatte page**: Could benefit from mentioning the people module v2 (`/dashboard/people/`) with profile detail pages.
6. **Innstillinger page**: Opening hours settings component exists but page only mentions it generically.

### Known Bugs

- `extractExcerpt()` in `apps/landing/src/lib/user-manual.ts` doesn't strip YAML frontmatter -- sidebar shows `---` as description

### Key Files

- Page template: `apps/landing/src/app/docs/_components/docs-article.tsx`
- Navigation data: `apps/landing/src/app/docs/_data/navigation.ts`
- Overview page: `apps/landing/src/app/docs/page.tsx`
- Layout: `apps/landing/src/app/docs/layout.tsx`
- Nav generation: `apps/landing/src/lib/user-manual.ts`
