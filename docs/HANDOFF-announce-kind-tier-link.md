---
title: "HANDOFF — Announcement V2: kind / tier / entity-link"
status: done
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [announcements, v2, kind, tier, entity-link, rpc, komm, handoff, campaign-ui-shell]
---

# HANDOFF — Announcement V2: kind / tier / entity-link

> Branch: `campaign/ui-shell`
> Session: 2026-05-18 (Track A–H work stream)
> Spec: `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md`

---

## Summary

V2 ships the kind/tier/entity-link extension of the Smartout announcement domain. The Wave A
schema was a flat `channel_message` row. V2 adds `announcement_meta` — a sidecar table that
carries `announcement_kind`, `announcement_tier`, `entity_link_type`, and `linked_entity_id` —
plus a new `publish_announcement_atomic` RPC that writes both rows atomically and drives
tiered channel fan-out.

Six migrations shipped (M0–M6). Both composer-side hooks (`use-send-announcement`,
`use-send-broadcast`) and the Day-Control server action (`send-broadcast-action.ts`) are now
migrated to the atomic RPC. Integration tests pass. Track E (composer pickers), Track G
(mobile EntityLinkCTA mount), and Track F secondary-path DRY-refactor are explicitly deferred
(see Known Issues).

### What shipped

| Track | Deliverable | Commit reference |
|---|---|---|
| M0 | `is_manager_in_workspace` helper | `d86edc734` |
| M1 | 3 enums: `announcement_kind`, `announcement_tier`, `announcement_link_type` | `942288527` |
| M2 | `announcement_meta` sidecar table + dual-auth RLS | `6a26b5d87` |
| M3 | `fn_publish_announcement_notifications` fan-out helper | `33d75db3a` |
| M4 | `publish_announcement_atomic` RPC | `d580dad3b` |
| M5 | Announcement guard on `channel_message` notification trigger | `7d97a69dd` |
| M6 | Extend `get_channel_messages` with sidecar columns | `bb5fcc83c` |
| Telemetry | 3 `announcement.*` events registered | `c8dffb40a` |
| Emit helper | `emitAnnouncementPublished` wired in primary path | `9afe417d2` |
| Hook migration | `use-send-announcement` → atomic RPC | `b30bb9da1` |
| Hook migration | `use-send-broadcast` → atomic RPC | `9bf7881c7` |
| Server action | `send-broadcast-action` → atomic RPC with defense-in-depth gate | `de01aae9c` |
| Mobile | TierBadge component | `ad5867593` |
| Integration tests | `publish_announcement_atomic` RPC test suite | `222f39db3` |

---

## Decisions Made

### D1 — ADR-0369 Option B: RPC body fan-out (not trigger-only)

**Context:** Initial V1 spec proposed trigger-only fan-out. Council REJECT surfaced that
trigger-only is invisible to capability layer and untestable without DB-level hooks.

**Decision:** Option B — `publish_announcement_atomic` RPC performs the fan-out inline via
`fn_publish_announcement_notifications`. Trigger is still present as fallback but the primary
path is the RPC body.

**Precedent:** Chair self-reversal #10 per L-0294 — orchestrator accepted council REJECT and
re-spec'd before implementation.

Reference: `docs/decisions/0369-announcement-atomicity-rpc-body-fanout.md`

---

### D2 — ADR-0370 Option B: extend communication capability (not new capability)

**Context:** V2 publish tools could live in a new `announcement_v2` capability or be added
to the existing `communication` capability.

**Decision:** Option B — extend `communication` capability. New `publish_announcement`
tool added alongside existing `broadcast.send`. Defense-in-depth: Day-Control server action
calls `broadcast.send` (capability gate) THEN `publish_announcement_atomic` RPC (DB gate).
Two-layer guard on the most sensitive path.

Reference: `docs/decisions/0370-capability-boundary-for-announcement-surface.md`

---

### D3 — ADR-0371 Option A: preserve tool API contract (no DB schema collapse)

**Context:** Option B proposed collapsing `channel_message` to only store the sidecar ID,
removing Wave A backward compatibility.

**Decision:** Option A — `channel_message` table is unchanged. `announcement_meta` is an
additive sidecar with FK back to `channel_message.id`. Wave A rows remain valid. Wave A
hooks continue to work after migration to atomic RPC (RPC writes meta with defaults if
kind/tier not supplied).

Reference: `docs/decisions/0371-announcement-schema-contract-preserved.md`

---

## Learnings

### L-0312 — SET CONSTRAINTS ALL DEFERRED does not defer triggers

**What happened:** M4 integration test attempted to use `SET CONSTRAINTS ALL DEFERRED` to
wrap the atomic insert without firing the notification trigger mid-test. The trigger fired
anyway.

**Why:** `SET CONSTRAINTS ALL DEFERRED` defers FK constraint checks, not trigger execution.
Triggers are not deferrable in PostgreSQL unless explicitly declared with `DEFERRABLE` in the
trigger definition (rare, rarely useful).

**Fix:** Integration test was restructured to clean up `notification_outbox` rows after the
fact rather than trying to prevent their creation.

Reference: `docs/learnings/0312-set-constraints-all-deferred-does-not-defer-triggers.md`

---

### L-0313 — Phase 2.5 grep must search ALTER TYPE ADD VALUE (3rd occurrence → ADR-grade)

**What happened:** A Phase 2.5 fact-check for enum extension used `grep` on enum names in
`database.types.ts` and found the types present. Migration reviewer concluded the migration
was already applied. In reality a sibling migration had added the VALUE to the enum but the
types file was regenerated before the check.

**Why matters:** `ALTER TYPE ... ADD VALUE` is irreversible in a single transaction. Checking
the types file alone is insufficient — need to grep `supabase/migrations/` for the exact
`ADD VALUE` statement to confirm source-of-truth.

**Rule:** Phase 2.5 enum checks MUST grep migrations for `ADD VALUE`, not just the types file.
3rd occurrence — promote to ADR.

Reference: `docs/learnings/0313-phase-2-5-grep-must-search-alter-type-add-value.md`

---

### L-0314 — Capability-key drift between spec pseudocode and router

**What happened:** Spec pseudocode used `communication.publish_announcement` as the capability
key. Router registration used `komm.publish_announcement`. Intent classifier diverged.
Mid-session agent was routing to wrong capability.

**Fix:** Canonical key is the router registration. Spec pseudocode is illustrative, not
authoritative. Before ship, grep `packages/ai/src/router/` for the actual registered key.

Reference: `docs/learnings/0314-capability-key-drift-between-spec-pseudocode-and-router.md`

---

### L-0315 — callGateAction signature is positional, not callback

**What happened:** Track D build agent passed an options object as the second argument to
`callGateAction`. Correct signature is positional: `callGateAction(action, context)`. The
options-object pattern compiles (TypeScript accepts it as `context`) but the gate receives
an unexpected shape and silently passes through.

**Fix:** Always check the concrete function signature in `packages/ai/src/gate/` before
writing gate call sites. The options-object form is a common trap from other gate libraries.

Reference: `docs/learnings/0315-callgateaction-signature-positional-not-callback.md`

---

## Known Issues / Debt

### Track E — Composer pickers not shipped (deferred)

**What's missing:** `AnnouncementKindPicker`, `AnnouncementTierPicker`, and `EntityLinkPicker`
UI components. Hooks have been migrated to the atomic RPC, but the composers
(`ComposeAnnouncement`, `AnnounceSheet`, `QuickBroadcast`) do not yet expose kind/tier/link
picker inputs.

**Impact:** All V2 announcements today are published with defaults: `kind='workspace_news'`,
`tier='work'`, no entity-link. The data contract is live; the UI is not.

**Reason deferred:** RAM-constrained session — typecheck hook timeouts prevented safely
editing web compositor files without risk of corrupting other staged work.

**Next sortie:** Track E-rest. Estimated 3 UI components + 3 hook wiring changes.

---

### Track G — Mobile EntityLinkCTA + ChannelMessageBubble mount not shipped (deferred)

**What's missing:** EntityLinkCTA component (not yet created) and the mount point inside
`ChannelMessageBubble` that would render TierBadge + EntityLinkCTA on the mobile komm screen.

**Impact:** Mobile users see the TierBadge (component exists), but entity-link CTA does not
render. Deep-link to linked entity not available on mobile.

**Reason deferred:** Same RAM constraint as Track E.

**Next sortie:** Track G. After Track E pickers are verified, entity-link data will flow
end-to-end and Track G mount becomes testable.

---

### Track F secondary paths — emit scope-cut

**What it is:** `use-send-broadcast.ts` and `send-broadcast-action.ts` (Track F secondary
path) emit `communication.broadcast_sent` only. They do NOT call `emitAnnouncementPublished`
helper. V2 announcement analytics (`announcement.published`, `announcement.external_tier_triggered`,
`announcement.read`) land only via the primary path (`use-send-announcement` via
`publish_announcement`).

**Impact:** Day-Control broadcasts and AnnounceSheet quick-broadcasts generate one telemetry
event (`communication.broadcast_sent`), not the three-event V2 chain. Analytics will
under-count V2 tier/kind distribution for those surfaces.

**Why accepted:** DRY-refactor requires touching three files simultaneously (hook, action,
emit helper) under RAM constraint. Risk of partial commit causing pre-push typecheck timeout
was high. Scope-cut accepted for v1 ship.

**Next session:** Consolidate emit paths in a single focused PR. Estimated 1 hour, no RAM
pressure outside web hook files.

---

## Recovery Note

All V2 work (Tracks A–G, ~25 commits) was lost to `git reset --hard origin/campaign/ui-shell`
mid-session due to a tooling incident. Work was recovered via 25 cherry-picks from git reflog
by the recovery agent. All commits verified intact by SHA match against reflog. Branch tip
at recovery: `7aebc757f`.

If similar incidents occur: `git reflog show HEAD~50..HEAD` captures the SHA history.
`git cherry-pick <sha>` individually is safer than range cherry-pick when the reflog
contains interleaved non-work commits.

---

## Next Steps

1. **Track E-rest** — Composer pickers (`AnnouncementKindPicker`, `AnnouncementTierPicker`,
   `EntityLinkPicker`). Start fresh session with RAM headroom. Estimated: 1 sortie.
2. **Track G** — Mobile EntityLinkCTA mount + ChannelMessageBubble V2 render. After Track E
   verified. Estimated: 1 sortie.
3. **Track F polish** — DRY-refactor emit paths; unify secondary paths onto `emitAnnouncementPublished`.
   Estimated: 0.5 sortie.
4. **E2E activation** — Flip `describe.skip` to `describe` in
   `apps/e2e/specs/announcement-kind-tier.spec.ts` after Track E ships. Fill in Playwright
   steps. Estimated: 1 sortie with Playwright fixtures.
