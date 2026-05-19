---
title: Announcements — Blueprint
status: placeholder
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [module, announcements, blueprint, plan, phases]
---

# Announcements — Blueprint

> Implementation plan for closing the gaps in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). **No active blueprint** — content pending design sortie.

## Status

The Announcements module shipped Wave A (notification priority branching, audience picker, pin/unpin + PinnedStrip) per `docs/modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md`.

**Wave B (Kind/Tier/Entity-Link) — REJECTED 2026-05-18.** First spec at `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md` failed council review with 6 blockers + 7 must-fixes. Trust Gate 8/8 FAIL. Three architectural decisions deferred to ADRs ([0369](../../decisions/0369-announcement-atomicity-rpc-body-fanout.md), [0370](../../decisions/0370-capability-boundary-for-announcement-surface.md), [0371](../../decisions/0371-announcement-schema-contract-preserved.md)) and four learnings logged ([0312](../../learnings/0312-set-constraints-all-deferred-does-not-defer-triggers.md), [0313](../../learnings/0313-phase-2-5-grep-must-search-alter-type-add-value.md), [0314](../../learnings/0314-capability-key-drift-between-spec-pseudocode-and-router.md), [0315](../../learnings/0315-callgateaction-signature-positional-not-callback.md)). Re-draft required before re-submission.

The next blueprint will sequence the gaps inventoried in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) after Wave B re-spec lands. Decision pending: which subset of gaps to address first, and whether the work is one phased blueprint or multiple independent sorties.

## Candidate phases (unsequenced — draft only)

Listed for reference. Sequencing, scope, and ADR boundaries to be defined in a design brainstorming session.

| Candidate | Closes gaps |
|---|---|
| **Sub-kind + entity-link** | §3.1 + §3.2 — adds `announcement_kind` enum, polymorphic entity-link mechanism, and personaltreff ↔ staff_event coupling |
| **Tier classification** | §3.3 — adds tier enum (social/work/external) driving notification priority + UI styling |
| **Mobile read parity** | §3.5 — dedicated bulletin layout, pinned strip, reactions, card view |
| **Home widget** | §3.6 — read-only widget for employees on mobile home (NoShiftView) and web home (when employee web home surface exists) |
| **Chat "+" inline-attach** | §3.7 — plus-icon affordance in chat composer to inline-publish announcement / task / event from conversation context |
| **Audience resolver consolidation** | §3.8 — single shared resolver, web + agent adapters |
| **Capability-gate harmonization** | §3.9 — route direct-Supabase composers through `callGateAction` to match agent path |
| **Read-receipt batch** | §3.10 — single RPC for feed read-receipt counts |
| **Norwegian i18n** | §3.11 — fill missing keys |
| **Scheduled publish** | §3.12 — adds `publish_at` column + cron consumer |
| **Edit-after-publish** | §3.13 — adds edit composer + "edited" indicator |
| **Expiry / auto-archive** | §3.14 — adds `expires_at` column + archive surface |

## Dependencies between candidates

- Sub-kind + entity-link is **schema-load-bearing** for several downstream candidates: tier rendering, mobile read parity (card layout differs by kind), chat "+" inline-attach (kind picker), home widget (kind-aware grouping).
- Mobile read parity depends on Wave A web parity being canonical; no new authoring surface introduced (ADR-0133 boundary holds).
- Capability-gate harmonization is independent and can ship as a small sortie any time.
- Audience resolver consolidation is independent of all other candidates.

## Authoring rules (for the future blueprint author)

When this file is replaced with an active blueprint:

- Each phase must declare falsifiable acceptance criteria (per `superpowers:writing-plans` skill).
- Schema changes require an ADR before merge.
- Cross-module schema changes (anything that adds columns to `channel_message`) require coordination with the communication module owner.
- Mobile authoring is OFF the table per ADR-0133 — phases that touch mobile are read-side only.
- New capability tools require a seed migration before merge (L-0066).
- Telemetry registry additions require BOTH `SmartoutEvent` union entry AND `EVENT_ROUTING` map entry (recurrence trap).
- Every phase ends with a journey doc + test plan.

## See also

- [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) — gap inventory with severity.
- [MODULE_ANNOUNCEMENTS.md](./MODULE_ANNOUNCEMENTS.md) — current-state overview.
- `docs/modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md` — completed Wave A plan (reference for plan structure).
