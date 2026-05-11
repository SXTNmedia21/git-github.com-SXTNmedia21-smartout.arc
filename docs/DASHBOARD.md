---
title: Development Dashboard — main repo
status: live
updated: 2026-05-11
last-reconciled: 2026-05-11
last-event: /start-feature nyheter-engagement-wave-a (sortie wt-1)
module: meta
scope: development+campaign:botsson-arena
tags: [dashboard, worktrees, campaigns, git-state]
---

# Development Dashboard

> **Scope:** main repo (development) + campaign:botsson-arena snapshot.
> Run `/status` from `~/dev/smartout.ai` for global regenerate.

## Active Worktrees (sortie pool)

| Worktree | Branch | Feature | Started |
|---|---|---|---|
| `~/dev/smartout.ai-wt-1` | `feat/nyheter-engagement-wave-a` | nyheter-engagement-wave-a | 2026-05-11 |
| `~/dev/smartout.ai-wt-3` | (existing — see git worktree list) | — | — |
| `~/dev/smartout.ai-wt-7` | (existing — see git worktree list) | — | — |

## Free Slots (sortie pool)

**main pool (wt-N):** wt-2, wt-4, wt-5, wt-6, wt-8, wt-9, wt-10, wt-11, wt-12, wt-13, wt-14, wt-15, wt-20

---

## Campaign view (botsson-arena snapshot, last reconciled 2026-05-10T18:42Z)

## Campaign

| Branch | Last Commit | Dirty | vs origin/development | Last Sync |
|---|---|---|---|---|
| `campaign/botsson-arena` | 13 min ago — feat(merge): feat/botsson-arena-phase-f0-perimeter into campaign/botsson-arena | 0 | 1 behind, 58 ahead | 3 hours ago |

## Active Sub-Sorties

_None._ Phase F0 perimeter sub-sortie merged. Next sub-sortie creates `~/dev/smartout.ai-botsson-arena-wt-N`.

## Free Slots

**camp:botsson-arena pool:** wt-1 through wt-20 (all free)

## Pending Journeys

| Journey File | Feature | Status |
|---|---|---|
| `JOURNEY-nyheter-engagement-wave-a-manager-publishes-targeted-announcement.md` | nyheter-engagement-wave-a | draft |
| `JOURNEY-nyheter-engagement-wave-a-manager-pins-critical-announcement.md` | nyheter-engagement-wave-a | draft |
| `JOURNEY-nyheter-engagement-wave-a-employee-sees-pinned-on-next-session.md` | nyheter-engagement-wave-a | draft |
| `JOURNEY-nyheter-engagement-wave-a-manager-unpins-outdated-announcement.md` | nyheter-engagement-wave-a | draft |
| `JOURNEY-nyheter-engagement-wave-a-push-arrives-with-operational-priority.md` | nyheter-engagement-wave-a | draft |
| `JOURNEY-phase-f0-landing-livekit-voice.md` | botsson-arena (campaign) | post-merge — verify on preview |
| `JOURNEY-phase-f0-multi-tenant-voice.md` | botsson-arena (campaign) | post-merge — verify on preview |

## In-Flight ADRs (campaign-only, not yet on development)

| ID | Title | Status on campaign |
|---|---|---|
| 0276 | adr-0107-amendment-provider-independence | accepted (campaign), pending merge |
| 0282 | voice-plane-consolidation-livekit-only | accepted (campaign), R6 step 8 superseded |
| 0000 | decision-log (registry) | updated with 0276 + 0282 flips |

_All other ADRs (0277–0291) live on `development` — see global DASHBOARD or `docs/decisions/`._

## Anomalies (this campaign)

_None._ Campaign is 1 commit behind dev — within green threshold. Sync via `/sync-campaign` if next sub-sortie needs latest dev.

---

_5 other campaigns + 2 sub-sorties hidden. Run `/status` from `~/dev/smartout.ai` for global view._
