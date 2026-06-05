---
title: Mobile Route Inventory
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, routes, inventory, sitemap]
---

# Route Inventory

All 56 route files across `apps/mobile/app/`. Auth layer = Supabase session via `AuthProvider`. Tab group = which tab renders the route.

## Root

| Route path | File | Screen purpose | Auth | Tab group |
|------------|------|----------------|------|-----------|
| `/` | `app/index.tsx` | Redirect → `/(auth)/welcome` | none | — |
| `*` (404) | `app/+not-found.tsx` | Not found fallback | none | — |

## Auth Group — `/(auth)/*`

| Route path | File | Screen purpose | Auth | Tab group |
|------------|------|----------------|------|-----------|
| `/(auth)/welcome` | `(auth)/welcome.tsx` | Entry: invite / search / login paths | none | none |
| `/(auth)/verify` | `(auth)/verify.tsx` | OTP / password login; dual `flow` param | none | none |
| `/(auth)/workspace-select` | `(auth)/workspace-select.tsx` | Multi-workspace picker or auto-redirect | session | none |
| `/(auth)/pending` | `(auth)/pending.tsx` | Waiting for admin approval; realtime poll | session | none |
| `/(auth)/invite/[token]` | `(auth)/invite/[token].tsx` | Deep-link invite token validator | none | none |
| `/(auth)/invite/confirm` | `(auth)/invite/confirm.tsx` | Confirm name/email before OTP | none | none |

## App Group — Home Tab `/(app)/(home)/*`

| Route path | File | Screen purpose | Auth | Tab group |
|------------|------|----------------|------|-----------|
| `/(app)/(home)` | `(home)/index.tsx` | Phase-aware landing: NoShift/Before/During/After | session | Hjem |
| `/(app)/(home)/punch-clock` | `(home)/punch-clock.tsx` | Inline punch-in/out with live timer, action grid | session | Hjem |
| `/(app)/(home)/clockout` | `(home)/clockout.tsx` | Clockout wizard (6-step reconciliation) | session | Hjem |
| `/(app)/(home)/deviation` | `(home)/deviation.tsx` | Report deviation form | session | Hjem |
| `/(app)/(home)/haccp` | `(home)/haccp.tsx` | HACCP logging | session | Hjem |
| `/(app)/(home)/hms` | `(home)/hms.tsx` | HMS overview dashboard | session | Hjem |
| `/(app)/(home)/safety-round` | `(home)/safety-round.tsx` | Safety round checklist | session | Hjem |
| `/(app)/(home)/temp-deviation` | `(home)/temp-deviation.tsx` | Temp deviation entry | session | Hjem |
| `/(app)/(home)/operations` | `(home)/operations.tsx` | Daily operations task calendar | session | Hjem |
| `/(app)/(home)/training` | `(home)/training.tsx` | Training hub (readiness, courses, certs) | session | Hjem |
| `/(app)/(home)/course-detail` | `(home)/course-detail.tsx` | Course detail (navigates to flow-player) | session | Hjem |
| `/(app)/(home)/flow-player` | `(home)/flow-player.tsx` | Procedure step-through player | session | Hjem |
| `/(app)/(home)/team` | `(home)/team.tsx` | Team member list with search | session | Hjem |
| `/(app)/(home)/team/[id]` | `(home)/team/[id].tsx` | Team member detail | session | Hjem |
| `/(app)/(home)/edit-profile` | `(home)/edit-profile.tsx` | Profile edit form | session | Hjem |
| `/(app)/(home)/settings` | `(home)/settings.tsx` | App settings + logout | session | Hjem |
| `/(app)/(home)/availability` | `(home)/availability.tsx` | Availability calendar | session | Hjem |
| `/(app)/(home)/spokesperson-approval` | `(home)/spokesperson-approval.tsx` | Spokesperson approval flow | session | Hjem |

## App Group — Shifts Tab `/(app)/(shifts)/*`

| Route path | File | Screen purpose | Auth | Tab group |
|------------|------|----------------|------|-----------|
| `/(app)/(shifts)` | `(shifts)/index.tsx` | Shift list — ScopeChips + 7-day DayCrewClusters | session | Vakter |
| `/(app)/(shifts)/[id]` | `(shifts)/[id].tsx` | Shift detail — Detaljer/Oppgaver/Emma tabs | session | Vakter |
| `/(app)/(shifts)/create` | `(shifts)/create.tsx` | Create shift form (BFF, ADR-0270) | session | Vakter |
| `/(app)/(shifts)/roster` | `(shifts)/roster.tsx` | Master roster grid (manager view) | session | Vakter |
| `/(app)/(shifts)/swap` | `(shifts)/swap.tsx` | Shift swap request screen | session | Vakter |
| `/(app)/(shifts)/marketplace` | `(shifts)/marketplace.tsx` | Open shift claims marketplace | session | Vakter |
| `/(app)/(shifts)/proposed-plan` | `(shifts)/proposed-plan.tsx` | Bundle proposal accept/reject (ADR-0309) | session | Vakter |

## App Group — Chat Tab `/(app)/(chat)/*`

| Route path | File | Screen purpose | Auth | Tab group |
|------------|------|----------------|------|-----------|
| `/(app)/(chat)` | `(chat)/index.tsx` | Chat + Skranke — channel list + helpdesk queue | session | Chat |
| `/(app)/(chat)/[id]` | `(chat)/[id].tsx` | Conversation detail | session | Chat |
| `/(app)/(chat)/settings` | `(chat)/settings.tsx` | Chat settings | session | Chat |

## App Group — Min Tid Tab `/(app)/(me)/*`

| Route path | File | Screen purpose | Auth | Tab group |
|------------|------|----------------|------|-----------|
| `/(app)/(me)` | `(me)/index.tsx` | Personal hub — stats grid + payslips + quick links | session | Min Tid |
| `/(app)/(me)/notifications` | `(me)/notifications.tsx` | Notifications list | session | Min Tid |
| `/(app)/(me)/design-preview` | `(me)/design-preview.tsx` | Dev-only design QA screen | session | Min Tid |
| `/(app)/(me)/contract` | `(me)/contract/index.tsx` | Contract list — active + history | session | Min Tid |
| `/(app)/(me)/contract/[id]` | `(me)/contract/[id].tsx` | Contract detail + DocuSeal link | session | Min Tid |
| `/(app)/(me)/contract/complete-data` | `(me)/contract/complete-data.tsx` | Fill in missing contract data | session | Min Tid |
| `/(app)/(me)/channel-detail/[id]` | `(me)/channel-detail/[id].tsx` | Channel detail from Me context | session | Min Tid |
| `/(app)/(me)/payroll` | `(me)/payroll/index.tsx` | Payroll hub — overview + bento grid | session | Min Tid |
| `/(app)/(me)/payroll/payslip` | `(me)/payroll/payslip.tsx` | All settled payslips list | session | Min Tid |
| `/(app)/(me)/payroll/payslip-detail` | `(me)/payroll/payslip-detail.tsx` | Payslip detail breakdown | session | Min Tid |
| `/(app)/(me)/payroll/lonnsgrunnlag-detail` | `(me)/payroll/lonnsgrunnlag-detail.tsx` | Lønnsgrunnlag PDF viewer (system browser) | session | Min Tid |
| `/(app)/(me)/payroll/timebank` | `(me)/payroll/timebank.tsx` | Timebank balance + ledger | session | Min Tid |
| `/(app)/(me)/payroll/absence-balance` | `(me)/payroll/absence-balance.tsx` | Absence quota balances | session | Min Tid |
| `/(app)/(me)/payroll/absence-request` | `(me)/payroll/absence-request.tsx` | Request absence + history | session | Min Tid |
| `/(app)/(me)/payroll/supplements` | `(me)/payroll/supplements.tsx` | Register/track supplement claims | session | Min Tid |

## App Group — Hidden Routes

| Route path | File | Screen purpose | Auth | Reason hidden |
|------------|------|----------------|------|---------------|
| `/(app)/(calendar)` | `(calendar)/index.tsx` | Week calendar view (WeekStrip + ItemCards) | session | `href: null` — Phase 3f stub |
| `/(app)/(calendar)/month` | `(calendar)/month.tsx` | Month calendar view | session | `href: null` |
| `/(app)/(calendar)/day/[date]` | `(calendar)/day/[date].tsx` | Day detail | session | `href: null` |
| `/(app)/(komm)` | `(komm)/index.tsx` | Komm inbox (Min kø + Kanaler) | session | `href: null` — absorbed into Chat tab |
| `/(app)/(komm)/[channelId]` | `(komm)/[channelId].tsx` | Komm ticket detail with resolve FAB | session | `href: null` |
| `/(app)/(queue)` | `(queue)/index.tsx` | Helpdesk ticket queue | session | `href: null` — legacy |
| `/(app)/(queue)/[ticketId]` | `(queue)/[ticketId].tsx` | Ticket detail | session | `href: null` — legacy |
| `/(app)/journey/[id]/guided` | `journey/[id]/guided.tsx` | Guided journey thin client (ADR-0132/0133) | session | `href: null` |
