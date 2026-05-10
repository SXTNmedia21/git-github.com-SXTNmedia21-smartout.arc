---
title: Development Dashboard — campaign:botsson-arena
status: live
updated: 2026-05-10
last-reconciled: 2026-05-10T18:42Z
last-event: /status regenerate (scoped) — phase-f0 perimeter merged
module: meta
scope: campaign:botsson-arena
tags: [dashboard, worktrees, campaigns, git-state]
---

# Development Dashboard — campaign:botsson-arena

> **Scope:** campaign:botsson-arena. Other campaigns hidden.
> Run `/status` from `~/dev/smartout.ai` (main repo on `development`) for global view.
> Pure git state. Last reconciled: 2026-05-10T18:42Z

## Campaign

| Branch | Last Commit | Dirty | vs origin/development | Last Sync |
|---|---|---|---|---|
| `campaign/botsson-arena` | 13 min ago — feat(merge): feat/botsson-arena-phase-f0-perimeter into campaign/botsson-arena | 0 | 1 behind, 58 ahead | 3 hours ago |

## Active Sub-Sorties

_None._ Phase F0 perimeter sub-sortie merged. Next sub-sortie creates `~/dev/smartout.ai-botsson-arena-wt-N`.

## Free Slots

**camp:botsson-arena pool:** wt-1 through wt-20 (all free)

## Pending Journeys

_None active._ Recent F0 journeys (declared, status post-merge):

| Journey File | Status |
|---|---|
| `JOURNEY-phase-f0-landing-livekit-voice.md` | post-merge — verify on preview |
| `JOURNEY-phase-f0-multi-tenant-voice.md` | post-merge — verify on preview |

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
