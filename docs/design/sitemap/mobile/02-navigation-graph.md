---
title: Mobile Navigation Graph
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, navigation, graph, sitemap]
---

# Navigation Graph

Every outgoing `router.push`, `router.replace`, and `<Link href>` per source screen. "Back" navigation (hardware back / `router.back()`) is implicit for all stack screens and is not listed.

## Root / Auth Entry

| From | Call | To | Notes |
|------|----|-----|-------|
| `app/index.tsx` | `<Redirect>` | `/(auth)/welcome` | Always |
| `(auth)/welcome` | `router.push` | `/(auth)/verify?flow=login` | Login button |
| `(auth)/welcome` | — | `/(auth)/invite/[token]` | Deep link |
| `(auth)/verify` | `router.replace` | `/(auth)/workspace-select` | Auth success |
| `(auth)/verify` | `router.replace` | `/(auth)/pending` | No profiles found |
| `(auth)/verify` | `router.replace` | `/(auth)/welcome` | Cancel |
| `(auth)/workspace-select` | `router.replace` | `/(auth)/pending` | 0 profiles |
| `(auth)/workspace-select` | `router.replace` | `/(app)/(home)` | 1 or selected profile |
| `(auth)/pending` | `router.replace` | `/(auth)/workspace-select` | Approved (realtime) |
| `(auth)/pending` | `router.replace` | `/(auth)/welcome` | Cancel |
| `(auth)/invite/[token]` | `router.push` | `/(auth)/invite/confirm` | Token valid |
| `(auth)/invite/[token]` | `router.replace` | `/(auth)/welcome` | Token invalid |
| `(auth)/invite/confirm` | `router.push` | `/(auth)/verify?flow=invite` | Confirm data |

## Home Tab — `/(app)/(home)`

| From | Call | To | Notes |
|------|----|-----|-------|
| `(home)/index.tsx` | `router.push` | `/(app)/(home)/settings` | Menu icon (top-left) |
| `(home)/index.tsx` | — | `NotificationSheet` | NotificationBell (bottom sheet, no route change) |
| `(home)/index.tsx` | renders | `ActionBar` | Shared bar — see ActionBar section |
| `(home)/punch-clock.tsx` | `router.push` | `/(app)/(home)/settings` | Menu icon |
| `(home)/settings.tsx` | `router.replace` | `/(auth)/welcome` | Logout |
| `(home)/settings.tsx` | `router.push` | `/(app)/(home)/edit-profile` | Profile row |
| `(home)/hms.tsx` | `router.push` | `/(app)/(home)/temp-deviation` | Temp dev card |
| `(home)/hms.tsx` | `router.push` | `/(app)/(home)/safety-round` | Safety round card |
| `(home)/hms.tsx` | `router.push` | `/(app)/(home)/deviation` | "Meld Avvik" FAB |
| `(home)/training.tsx` | `router.push` | `/(app)/(home)/course-detail?id=X` | Course card tap |
| `(home)/training.tsx` | `router.push` | `/(app)/(home)/flow-player` | Procedure row |
| `(home)/course-detail.tsx` | `router.push` | `/(app)/(home)/flow-player` | "Start kurs" CTA |
| `(home)/team.tsx` | `router.push` | `/(app)/(home)/team/${profileId}` | Member row tap |
| `(home)/operations.tsx` | `router.push` | `/(app)/(home)/haccp` | HACCP action card |
| `(home)/operations.tsx` | `router.push` | `/(app)/(shifts)` | "Vakter" filter chip |
| `(home)/operations.tsx` | `router.push` (self) | `/(app)/(home)/operations` | "Oppgaver" card (re-opens self) |

## ActionBar (rendered on Home + Min Tid)

| Button | To |
|--------|----|
| Oppgaver | `/(app)/(home)/operations` |
| Opplæring | `/(app)/(home)/training` |
| Sikkerhet | `/(app)/(home)/hms` |
| Lønn | `/(app)/(me)/payroll` |

## Shifts Tab — `/(app)/(shifts)`

| From | Call | To | Notes |
|------|----|-----|-------|
| `(shifts)/index.tsx` | `handleShiftTap` | no navigation yet | DetailSheet Phase 3e — not wired, tap is no-op |
| `(shifts)/[id].tsx` | `router.push` | `/(app)/(shifts)/swap?shiftId=X` | Swap button |
| `(shifts)/[id].tsx` | `router.push` | `/(app)/(home)/punch-clock` | "Stemple inn" CTA |

## Chat Tab — `/(app)/(chat)`

| From | Call | To | Notes |
|------|----|-----|-------|
| `(chat)/index.tsx` | `router.push` | `/(app)/(chat)/${conversationId}` | Conversation row |
| `(chat)/index.tsx` | `router.push` | `/(app)/(chat)/${channelId}` | Channel deep link |
| `(chat)/index.tsx` | `router.push` | `/(app)/(chat)/settings` | Settings gear |
| `(chat)/index.tsx` | `router.push` | `/(app)/(home)/settings` | Menu icon |
| `(chat)/index.tsx` | `router.push` | BFF sheet | New conversation (sheet, no route) |

## Min Tid Tab — `/(app)/(me)`

| From | Call | To | Notes |
|------|----|-----|-------|
| `(me)/index.tsx` | `router.push` | `/(app)/(home)/settings` | Menu icon |
| `(me)/index.tsx` | `router.push` | `/(app)/(me)/payroll` | Lønn stat card |
| `(me)/index.tsx` | `router.push` | `/(app)/(me)/payroll/timebank` | Timebank stat card |
| `(me)/index.tsx` | `router.push` | `/(app)/(me)/payroll/absence-balance` | Saldo stat card |
| `(me)/index.tsx` | `router.push` | `/(app)/(me)/payroll/absence-request` | Fravær CTA card |
| `(me)/index.tsx` | `router.push` | `/(app)/(me)/payroll/payslip` | "Se alle" + payslip rows |
| `(me)/index.tsx` | `router.push` | `/(app)/(me)/contract` | Arbeidskontrakt quick link |
| `(me)/index.tsx` | `router.push` | `/(app)/(home)/settings` | Personvern quick link |
| `(me)/payroll/index.tsx` | `router.push` | `./payslip` | Payslips bento card |
| `(me)/payroll/index.tsx` | `router.push` | `./absence-request` | Absence bento card |
| `(me)/payroll/index.tsx` | `router.push` | `./timebank` | Timebank bento card |
| `(me)/payroll/index.tsx` | `router.push` | `./supplements` | Supplements bento card |
| `(me)/payroll/index.tsx` | `router.push` | `./lonnsgrunnlag-detail?id=X` | Lønnsgrunnlag row |
| `(me)/payroll/payslip.tsx` | `router.push` | `./payslip-detail?id=X` | Payslip row |
| `(me)/contract/index.tsx` | `router.push` | `/(app)/(me)/contract/${id}` | Active/history row |
| `(me)/contract/[id].tsx` | `router.push` | `/(app)/(me)/contract/complete-data` | Complete data CTA |

## Calendar Tab (hidden but reachable via `/(app)/(calendar)`)

| From | Call | To |
|------|------|----|
| `(calendar)/index.tsx` | `router.push` | `/(app)/(shifts)` — Vakter filter chip |
| `(calendar)/index.tsx` | `router.push` | `/(app)/(calendar)/month` — Month toggle |
| `(calendar)/month.tsx` | `router.push` | `/(app)/(calendar)/day/${date}` — Day cell tap |
| `(calendar)/month.tsx` | `router.replace` | `/(app)/(calendar)` — Back to week toggle |

## Komm / Queue (hidden)

| From | Call | To |
|------|------|----|
| `(komm)/index.tsx` | `router.push` | `/(app)/(komm)/${channelId}` — ticket row |
| `(komm)/index.tsx` | `router.push` | `/(app)/(chat)/${id}` — channel row |
| `(komm)/[channelId].tsx` | `router.replace` | `/(app)/(komm)` — ticket not found |
| `(queue)/index.tsx` | `router.push` | `/(app)/(queue)/${ticketId}` |
| `(queue)/[ticketId].tsx` | `router.replace` | `/(app)/(queue)` — not found fallback |

## FAB Layer

| Gesture | Action |
|---------|--------|
| Tap | `router.replace("/(app)/(home)")` |
| Swipe layer 1 (≥80 px) | Opens `AddSheet` (bottom sheet, no route) |
| Swipe layer 2 (≥160 px) | Opens `AddSheet` + `BotssonSheet` stacked |
