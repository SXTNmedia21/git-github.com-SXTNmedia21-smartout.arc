---
title: "Phase 3f — Inbound Importer Audit for (home)/* paths"
status: complete
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [audit, mobile, phase-3f, deeplinks, route-absorption, handoff]
sortie: feat/mobile-phase-3f-home-absorption (3f.1)
council: 2026-05-14 G2 (5 reviewers, GO WITH CHANGES)
handoff-to: 3f.2 / 3f.3 / 3f.4 follow-up sorties
---

# Phase 3f — Inbound Importer Audit for `(home)/*` paths

## Why this doc exists

Council G2 verdict 2026-05-14 reversed audit A1's "0 cross-folder route importers" claim (Steward Phase 5 Self-Reversal §1.5 — 7th codified L-0147 precedent). 25+ external sites target `(home)/*` paths via 7 distinct importer-class patterns. Future sorties (3f.2/3f.3/3f.4) must retarget ALL of these before any `(home)/*` file moves OR is deleted.

## Importer-class taxonomy (7 patterns)

| Class | Pattern | Files where found | Risk if missed |
|-------|---------|-------------------|----------------|
| 1. Push deeplink registry | `packages/notifications/src/deep-links.ts` event → path map | 2 hardcoded targets | Push notifications 404 mid-rollout |
| 2. Nav table | Hardcoded `router.push` in `ActionBar` / `HomeHeader` | 7 hardcoded routes | Tab-bar buttons 404 |
| 3. Phase-view components | `DuringShiftView` / `NoShiftView` / `SettingsSheet` body `router.push` calls | 8 sites | Shift-card actions 404 |
| 4. Capability tool route table | `apps/mobile/src/lib/botsson-tools.ts` voice-tool deep-link table | 2 entries (deviation, haccp) | Botsson voice-tools 404 |
| 5. Prioritize-actions | `apps/mobile/src/lib/prioritize-actions.ts` recommendation engine | 2 entries (`/(app)/(home)` root) | Recommendation engine 404 |
| 6. Cross-tab `router.push` | Sibling tabs invoking `(home)/X` directly | 4 sites | Tab-to-tab navigation 404 |
| 7. Page context literal | `apps/mobile/src/hooks/queries/use-botsson-chat.ts` page-context string | 1 entry | Stage-engine page-context wrong |

## Full inbound importer list (25 sites)

### Class 1 — Push deeplink registry

`packages/notifications/src/deep-links.ts`

| Line | Event | Current target | Server emitter | Recommended retarget (per A3) |
|------|-------|----------------|----------------|-------------------------------|
| 50 | `deviation_reported` | `/(app)/(home)/deviation` | `supabase/migrations/20260324065817_fix_push_triggers_profile_id.sql:4-36` trigger `trigger_push_deviation_reported` on `INSERT INTO public.deviation` | `/(app)/(shifts)/deviation` (matches A2 ABSORB target) |
| 62-65 | `reconciliation_pending_signoff` | `/(app)/(home)/clockout?sessionId=<id>&source=push` | `supabase/migrations/20260516150000_push_dispatch_clockout_link.sql:29-90` trigger on session status `active→pending_signoff` | `/(app)/(shifts)/clockout?sessionId=<id>` |

**Payload compatibility:** Both retargets are **path-only** (payload fields preserved). No server-side change required if mobile consumer accepts existing param names.

### Class 2 — Nav table

`apps/mobile/src/components/navigation/ActionBar.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 14 | `/(app)/(home)/operations` | `/(app)/(calendar)/operations` (per A2 — date-anchored) |
| 15 | `/(app)/(home)/training` | `/(app)/(me)/training` |
| 16 | `/(app)/(home)/hms` | **FAB AddSheet entry** (per Frontend Q6 verdict — Nordic Split way) OR temporary keep until 3f.4 |

`apps/mobile/src/components/home/HomeHeader.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 47 | `/(app)/(home)/haccp` | `/(app)/(shifts)/haccp` |
| 48 | `/(app)/(home)/training` | `/(app)/(me)/training` |
| 49 | `/(app)/(home)/hms` | FAB AddSheet entry OR temporary keep |
| 50 | `/(app)/(home)/punch-clock` | `/(app)/(shifts)/punch-clock` |

### Class 3 — Phase-view + sheet components

`apps/mobile/src/components/home/DuringShiftView.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 106 | `/(app)/(home)/punch-clock` | `/(app)/(shifts)/punch-clock` |
| 143 | `/(app)/(home)/operations` | `/(app)/(calendar)/operations` |
| 163 | `/(app)/(home)/operations` | `/(app)/(calendar)/operations` |
| 241 | `/(app)/(home)/deviation` | `/(app)/(shifts)/deviation` |

`apps/mobile/src/components/home/DuringShiftView.v2.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 222 | `/(app)/(home)/punch-clock` | `/(app)/(shifts)/punch-clock` |
| 293 | `/(app)/(home)/deviation` | `/(app)/(shifts)/deviation` |

`apps/mobile/src/components/home/NoShiftView.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 168 | `/(app)/(home)/training` | `/(app)/(me)/training` |

`apps/mobile/src/components/home/SettingsSheet.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 145 | `/(app)/(home)/edit-profile` | `/(app)/(me)/edit-profile` |

### Class 4 — Capability tool route table

`apps/mobile/src/lib/botsson-tools.ts`

| Line | Current target | Retarget |
|------|----------------|----------|
| 66 | `/(app)/(home)/deviation` | `/(app)/(shifts)/deviation` |
| 67 | `/(app)/(home)/haccp` | `/(app)/(shifts)/haccp` |

### Class 5 — Prioritize-actions

`apps/mobile/src/lib/prioritize-actions.ts`

| Line | Current target | Retarget |
|------|----------------|----------|
| 98 | `/(app)/(home)` root | `/(app)/(shifts)` (default tab for shift-actions) |
| 111 | `/(app)/(home)` root | `/(app)/(shifts)` |

### Class 6 — Cross-tab `router.push`

| File:Line | Current target | Retarget |
|-----------|----------------|----------|
| `apps/mobile/app/(app)/(shifts)/[id].tsx:421` | `/(app)/(home)/punch-clock` | `/(app)/(shifts)/punch-clock` (intra-tab) |
| `apps/mobile/app/(app)/(chat)/index.tsx:616` | `/(app)/(home)/settings` | `/(app)/(me)/settings` |
| `apps/mobile/app/(app)/(me)/index.tsx:68` | `/(app)/(home)/settings` | `/(app)/(me)/settings` (intra-tab) |
| `apps/mobile/app/(app)/(me)/index.tsx:229` | `/(app)/(home)/settings` | `/(app)/(me)/settings` (intra-tab) |

### Class 7 — Page context literal

`apps/mobile/src/hooks/queries/use-botsson-chat.ts`

| Line | Current | Retarget |
|------|---------|----------|
| 367 | pageContext literal `"(app)/(home)"` | Replace with dynamic pathname OR remove (stage-engine page-context derivation) |

### NotificationScreen — push deeplink-handler render targets

`apps/mobile/src/components/notifications/NotificationScreen.tsx`

| Line | Current target | Retarget |
|------|----------------|----------|
| 75 | `/(app)/(home)/punch-clock` | `/(app)/(shifts)/punch-clock` |
| 87 | `/(app)/(home)/operations` | `/(app)/(calendar)/operations` |
| 93 | `/(app)/(home)/training` | `/(app)/(me)/training` |
| 105 | `/(app)/(home)/team` | `/(app)/(shifts)/team` |

### `_layout.tsx` self-reference

`apps/mobile/app/(app)/_layout.tsx` (tab bar)

- Hidden screen registration `<Tabs.Screen name="(home)" options={{ href: null }} />` — must be removed in 3f.4 (final folder delete)

## Total

**~25 distinct importer sites** across 12 source files (excluding intra-(home)/ imports). 7 importer-class patterns. **Order requirement (Council G2):** retarget ALL 25 sites + 2 server-emitted push deeplinks BEFORE any `(home)/*` file moves or is deleted in 3f.2/3f.3/3f.4.

## Retarget order (Council-synthesized)

| Sortie | Action | Sites |
|--------|--------|-------|
| **3f.1 (this sortie)** | DOCUMENT (this audit). DELETE only `shift-hub.tsx` (verified 0 inbound). | n/a |
| **3f.2** | RETARGET 2 push deeplinks (deep-links.ts) + 12 site retargets for (shifts) absorption + fix ADR-0287/0134 on temp-deviation + edit-profile + ABSORB 8 files into (shifts) | 14 sites |
| **3f.3** | RETARGET 6 site retargets for (me) absorption + L-0177 fail-fast on spokesperson + ABSORB 6 files into (me) | 6 sites |
| **3f.4** | RETARGET 4 site retargets for (calendar) absorption + FAB-AddSheet replace for hms.tsx + page-context literal cleanup + ABSORB operations + DEFER availability + DELETE folder + remove `<Tabs.Screen name="(home)">` from `_layout.tsx` + clean ADR-0133 R5 amendment for availability | 5 sites |

## Component-folder note (L-0251 candidate)

`apps/mobile/src/components/home/` ≠ `apps/mobile/app/(app)/(home)/`. Component folder survives route deletion. Verified consumers (post route deletion):

- `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:36,254` — imports `AfterShiftView`
- Intra-folder: `SettingsSheet`, `HomeHeader`, `DuringShiftView`, `DuringShiftView.v2`, `NoShiftView` mutually consume

**Decision deferred to 3f.4:** Should `apps/mobile/src/components/home/` rename to `apps/mobile/src/components/shift/` (or similar) once `(home)/` route deletes? Council G2 frontend reviewer flagged this; defer to 3f.4 sortie planning.

## ADR-flagged items (Council G2 handoff)

| File | ADR risk | Owner sortie | Required fix |
|------|----------|--------------|--------------|
| `temp-deviation.tsx:162` | ADR-0287 (direct `.update()` without gatedMutation) | 3f.2 | Wrap in capability tool with `gate_action` OR explicit ADR-0287 carve-out |
| `edit-profile.tsx:115` | ADR-0134 + ADR-0287 + ADR-0133 R3 (direct `supabase.from("profile").update()`, no emit, no getProfileContext) | 3f.2 | Add `getProfileContext()` + `emit('profile.updated')` + Server Action wrap |
| `spokesperson-approval.tsx:47` | ADR-0151 (`(supabase as any)` read by URL row-ID, RLS-only) | 3f.3 | Add explicit `if (row.workspace_id !== profile.workspace_id) throw L-0177-error` at L70 post-fetch |
| `team.tsx` + `team/[id].tsx` | ADR-0267 PII (email + phone surfaced via 3 direct supabase reads) | 3f.2 | RLS audit + ADR-0267 fence OR route through capability tool |
| `availability.tsx` (9 LOC) | ADR-0133 R5 (D2 authoring — RRULE weekly templates via `AvailabilityScreen`) | 3f.3 or separate | ADR-0133 R5 amendment OR defer to web |

## Council G2 references

- Steward Phase 3 verdict: GO WITH CHANGES (7th L-0147 codified precedent — Chair Self-Reversal on A1 "0 cross-folder importers" claim)
- Supervisor: Order inversion required (retarget FIRST, absorb LATER)
- Agent-Coord: matrix defended + 5 ADR flags verified
- Harness: Trust Gate per-file (clockout/punch-clock UNVERIFIED, need body re-trace in 3f.2)
- Frontend: Tab overload risk — `(shifts)` needs sub-routing for 8 absorptions; `operations.tsx` may duplicate existing calendar weekly strip (verify before absorb)

## Cross-references

- ADR-0268 `docs/decisions/0268-tabbar-canonical-layout.md` (canonical Phase 3f mandate)
- ADR-0133 (mobile Execute-only boundary)
- ADR-0134 (mobile telemetry fail-fast)
- ADR-0151 (server-derive identity on writes)
- ADR-0267 (booking PII access control — applicable to team PII)
- ADR-0287 (gated-mutation mandatory on capability tools)
- L-0249 — ADR cross-reference content-drift (prior sortie)
- L-0250 — Route-group absorption requires inbound-importer audit (this sortie, new)
- L-0251 — Component-folder location aligns with route-folder during moves (this sortie, new)
- L-0177 — Fail-fast row-not-found on body-supplied references
- L-0176 — Docstring-vs-body drift (relevant to deviation.tsx:94, haccp.tsx:124 comment claims)

## Status

**Complete.** 3f.2 onwards consume this audit as authoritative retarget map.
