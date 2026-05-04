---
title: "Plan — shift-system-polish"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [plan, mobile, shift, vaktliste, punch, bff]
---

# Plan — shift-system-polish

> Branch: `feat/mobile-shift-system-polish` | Worktree: `~/dev/smartout.ai-mobile-wt-2` | Base: `campaign/mobile` | Module: mobile | Started: 2026-05-04

## Trigger

Bug: `useCreateShift` enqueued `day_category: "regular"` — ikke i `public.day_category` enum (`morning|midday|afternoon|evening|night|weekend`). Mobile shift-create var ute av sync med vaktplan-popup på web (`AddShiftDialog.tsx` + `addShiftAction.ts`). Mangler: `profileId`, `reason` audit-felt, `gateAction` C4-permission, server-side workspace-tz `day_category` derivation, `source='manual_admin'`, `is_published=true`. Direkte supabase-insert via offline-kø bypasser hele auditing-laget.

## Goal

Konvergér mobile shift-create + vaktliste + punch mot web canonical write-paths via BFF-wrap. Mobile blir thin-client (ADR-0132). Single source of truth for shift-creation = `addShiftAction`. Audit, gate, og tariff-tz arves fra server. Polish hele vaktliste-systemet underveis.

## Hard constraints

- **ADR-0132** — Mobile thin client; AI/capability traffic gjennom BFF.
- **ADR-0133** — Web composes (D1–D5); mobile executes (D6 + C4). Shift-create er compose-verb; mobile blir thin client mot web compose.
- **ADR-0134** — Telemetry kontrakt: `getProfileContext()` resolver `workspace_id` + `actor_id` før `emit()`. Empty-string fallbacks forbidden.
- **ADR-0151** — Server-derived `workspace_id`. BFF leser fra JWT/profile, aldri fra request body.
- **ADR-0078** — Channel guards. Shift-creation er chat/system, ikke voice (ingen PII overslag).
- **ADR-0204** — Capability tools via `gatedMutation` (gjelder server-side action).
- **ADR-0265** — Sortie merges til `campaign/mobile` via `/close-feature`, ikke direkte til `development`.

## Surfaces in scope

| Surface | Path | Hva sjekkes |
|---|---|---|
| Create-shift | `apps/mobile/app/(app)/(shifts)/create.tsx` + `use-create-shift.ts` | BFF-wrap, profileId, reason 8-tegn, dropp client tz-derivation |
| Vaktliste | `apps/mobile/app/(app)/(shifts)/index.tsx` + `useShifts` | Filter, sortering, status-pill, tap → detalj, empty/error states |
| Detalj | shift-detail / shift-hub | Felt-paritet med web `shift-modal` |
| Punch | `apps/mobile/.../shift-clock/*` | Clock-in/out, breaks, offline-resume, Aml §10-2 audit |
| Sync | `apps/mobile/src/lib/sync/action-map.ts` + `schemas.ts` | Drop `create_shift` action; behold punch-handlere |
| BFF | `apps/web/src/app/api/mobile/shifts/route.ts` (ny) | Auth + delegerer `addShiftAction`, JWT-derived workspace |

## Phases

### Phase 0 — Discovery (Explore agent, haiku)

Map full mobile shift-surface + web canonical paths + delta-tabell. Ingen kode.

**Output:** `docs/audits/2026-05-04-mobile-shift-surface-map.md`
- Liste over alle mobile shift-mutation call-sites
- Liste over alle web canonical write-paths (`addShiftAction`, `useShiftClock`, `use-roster`, `useEmployeeRoster`)
- Delta-tabell: hva mobile gjør lokalt som web gjør server-side
- Sync-action-handlere som er affected
- Punch-flyten end-to-end (mobile → supabase → triggers)

### Phase 1 — Lov-sjekk (lovsen, sonnet, read-only)

Analyse mot norsk arbeidsrett + tariff. Alle viktige arkitekturspørsmål går først til lovsen.

**Spørsmål:**
1. Aml §14-6 — hvilke bokstaver er affected ved manuell shift-creation? Audit-trail-krav for `source=manual_admin`.
2. Aml §10-2 — krav til arbeidstidsregistrering. Punch in/out — hva må logges, hvor lenge?
3. Aml §10-9 — pause-registrering. Mobile breaks-input — er dette tilstrekkelig?
4. Riksavtalen — kveld/natt/helg-tillegg. Korrekt `day_category`-bucket vs lov-tekst (06–12 morning vs 14:00 afternoon: stemmer det med Riksavtalen §3?). Tz-drift mellom workspace + device — risk-assessment.
5. Override-flow — manager overstyrer unavailable/absent person. Hvilken audit-trail kreves? `activity_trail.data.override_reason` tilstrekkelig?
6. C4-governance — skal mobile-bruker ha `roster.add_shift_manual`-capability? Eller bare web-admins?

**Output:** `docs/audits/2026-05-04-lovsen-shift-system-rapport.md`
- Confidence-merket per påstand
- Konkrete krav til `addShiftAction` og BFF
- Eskalerings-flag (advokat? Mattilsynet?)

### Phase 2 — Plan-verify + ADR (system-steward, opus)

Verifiser plan + lovsen-rapport mot ADR-0132/0133/0134/0151/0204/0265. Lag ADR-utkast.

**Output:**
- ADR `00XX-mobile-shift-authoring-via-bff.md` (proposed)
  - Context: mobile-create gjennom BFF, ikke direct supabase
  - Decision: mobile UI beholdes, alle writes via `/api/mobile/shifts`
  - Consequences: dropper offline-create-shift; punch-kø beholdt
  - References: ADR-0132/0133/0134/0151
- Plan-godkjenning eller redesign-krav

### Phase 3a — BFF + capability (botsson-harness-builder, sonnet)

`POST /api/mobile/shifts` route som wrapper `addShiftAction`. JWT-derived workspace per ADR-0151.

**Output:**
- `apps/web/src/app/api/mobile/shifts/route.ts`
- Zod request schema (ingen `workspace_id` fra body)
- Delegerer til `addShiftAction({ profileId, startAtISO, endAtISO, role, reason, departmentId? })`
- Returnerer `{ ok, error?, schedule_shift_id? }`
- Rate-limiting hvis Upstash konfigurert

### Phase 3b — Mobile refaktor (walkai-bridge-builder, sonnet)

`create.tsx` + `useCreateShift` reskrivning + actionMap-cleanup.

**Output:**
- `create.tsx` + profileId-Select (ansatt-picker fra `useWorkspaceProfiles`)
- `create.tsx` + reason textarea (min 8 tegn validation)
- `useCreateShift` ringer BFF, ikke `enqueue()`
- Drop client-side `deriveDayCategory`
- `actionMap.create_shift` → fjernet eller deprecation-stub
- `schemas.ts` → fjern `createShiftSchema` (eller behold med deprecation-warning)

### Phase 3c — UI polish (frontend-designer, sonnet)

Vaktliste + detalj + punch Nordic-Split-puss. Spring-physics, glass-cards, empty-states.

**Output:**
- Vaktliste: filter-chips (i dag / uke / måned), status-pills, sortering, empty-state CTA
- Detalj: felt-paritet med `shift-modal`, tariff-info sticky bottom
- Punch: clock-in/out feedback, break-resume, offline-banner

### Phase 4 — Review (code-reviewer, sonnet)

Diff-review hele sortien. Findings → fixes før merge.

**Output:** `docs/reviews/2026-05-04-shift-system-polish-review.md`

## Acceptance criteria

- [ ] `pnpm --filter web typecheck` grønn
- [ ] `pnpm --filter @smartout/mobile typecheck` grønn (etter `pnpm install`)
- [ ] `pnpm --filter @smartout/mobile test` grønn
- [ ] PWA-test (port 8083): create-shift med valid profileId + reason → toast success + vaktliste re-fetch
- [ ] PWA-test: create-shift med invalid reason (< 8 tegn) → submit blocked + inline error
- [ ] PWA-test: punch-in → punch-out → vaktliste viser oppdatert status
- [ ] Lovsen-rapport vedlagt + alle HIGH-severity-funn addressert eller deferred med ADR
- [ ] ADR `00XX-mobile-shift-authoring-via-bff.md` proposed + registrert i `0000-decision-log.md`
- [ ] Decision log inneholder alle nye ADRer
- [ ] HANDOFF skrevet med decisions + learnings + next steps
- [ ] Alle 4 journeys dokumentert i `docs/journeys/`

## Journeys (declared up front)

1. **Manager-create-shift-mobile** — manager tappet vaktliste-fab → ny vakt-form → velg ansatt + dato + tid + rolle + begrunnelse → submit → BFF validerer → server-action insert → toast + retur til vaktliste.
2. **Employee-view-vaktliste** — ansatt åpner vaktliste-tab → ser sortert vaktliste (kommende først) → filter (i dag / uke / måned) → tap vakt → detalj-skjerm.
3. **Employee-punch-in-out** — ansatt på vakt → tap "Stempel inn" → bekreftelse → arbeider → tap "Pause" → tap "Tilbake fra pause" → tap "Stempel ut" → bekreftelse + oppsummering.
4. **Manager-override-unavailable** — manager velger ansatt som er sykmeldt → varsel-banner → fortsetter med utfyllende begrunnelse → submit logger override-reason til audit-trail.

## Out of scope

- Native push-driven D6 hooks (separate sortie per ADR-0133)
- Camera evidence per ADR-0136 (separate)
- Biometric C4-confirmation (separate)
- LiveKit voice-create (forbidden per ADR-0078 — PII-channel-restriction)
- Offline create-shift queue (deferred — defer-ADR hvis trengs)

## Risks

- **Workspace-tz-drift** — mobile-bruker i annen tz enn workspace. BFF-server-derivation løser dette, men gamle køede shifts (om noen) kan ha drift. Migration-script ikke nødvendig (kø ble aldri populated).
- **Profile picker UX** — mobile-screen er smal; large workspace-rosters trenger search/filter i picker.
- **Offline-create-regression** — managers som forventer offline-create vil få "online required"-feilmelding. UX-mitigation: tydelig banner + queue-for-later-knapp som lagrer draft lokalt (ikke insert).
- **BFF rate-limiting** — manuell-create kan misbrukes. Gate-action gir C4-cap; BFF legger Upstash-rate-limit på toppen hvis tilgjengelig.

## Mantra

> "Web composes, mobile executes." Mobile er thin client. Server eier audit, gate, tz, lov.
