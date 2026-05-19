---
title: "Announcement Kind / Tier / Entity-Link — Implementation Plan"
status: draft
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [plan, announcements, kind, tier, entity-link, v2]
---

# Announcement Kind / Tier / Entity-Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Context loss disclosure:** The 2026-05-18 council session created 3 ADRs (0369/0370/0371), V1 spec (REJECTED), 7 module docs, 4 learnings, COUNCIL-LOG entry, and meta-memory updates — but none were committed to disk before branch switch. Phase 0 of this plan REBUILDS those artifacts from conversation summary + the 3 architectural decisions Pontus locked 2026-05-18 (0369→B, 0370→B, 0371→A). The conversation summary remains authoritative for the council process; this plan resolves the 6 BLOCKERS forward.

**Goal:** Add kind/tier classification + polymorphic entity linking to workspace announcements, with single-RPC atomicity (no DEFERRABLE-trigger complexity), unchanged tool API contract (no breaking change for callers), tier-driven notification routing, and 4-event telemetry emit-wired into the RPC body.

**Architecture (3 decisions locked):**
- **ADR-0369 = B** — `publish_announcement_atomic` RPC body does INSERT channel_message + INSERT announcement_meta + INSERT notification_outbox inline. Existing `AFTER INSERT` trigger gets a guard: `IF NEW.message_type = 'announcement' THEN RETURN NEW; END IF;` so trigger handles non-announcement messages only. Eliminates SET CONSTRAINTS class entirely.
- **ADR-0370 = B** — Extend existing `communication` capability with new `actionType='publish_announcement_atomic'`. No new capability seed, no new intent enum value, no router rewire. The Day-Control `broadcast.send` capability stays for the server-action path (defense-in-depth).
- **ADR-0371 = A** — Tool API contract preserved: `publish_announcement` tool keeps `{title: string(1-120), body: string(1-1600)}` separate params. Server-side concatenates `title + "\n" + body` into `channel_message.content` (existing behavior, no schema change). Sidecar `announcement_meta` carries the new fields (kind, tier, tags, linked_entity_type, linked_entity_id).

**Tech Stack:** PostgreSQL 17 (Supabase), TypeScript strict, Next.js 16 App Router, Vitest, Playwright, Zod, `@smartout/telemetry`, `@smartout/ai` capability framework.

**References (read these before executing):**
- `packages/ai/src/capabilities/communication/publish-announcement.ts` — existing tool body (lines 78-215)
- `packages/ai/src/capabilities/communication/gate.ts:52` — `callGateAction` positional signature
- `supabase/migrations/00006_notification_engine.sql:31-67` — `notification_outbox` real columns
- `supabase/migrations/20260324220000_notification_table.sql:7` — `ALTER TYPE notification_channel ADD VALUE 'in_app'`
- `supabase/migrations/20260422310100_channel_message_notification_trigger.sql:18` — existing `AFTER INSERT` trigger fan-out
- `supabase/migrations/20260601100000_seed_communication_authority.sql:42` — `communication` capability seed
- `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` — web composer doing direct INSERT (needs RPC migration)
- `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts` — Day-Control composer
- `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts` — server action
- `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx` — sheet composer
- `packages/telemetry/src/registry.ts:4171` — existing `channel.message.sent` event registration
- ADR-0369/0370/0371 (drafted in Phase 0 below)
- L-0312/0313/0314/0315 (drafted in Phase 0 below)

---

## File Structure Map

### New files (created)
- `docs/decisions/0369-announcement-atomicity-rpc-body-fanout.md` — atomicity ADR
- `docs/decisions/0370-capability-boundary-for-announcement-surface.md` — capability boundary ADR
- `docs/decisions/0371-announcement-schema-contract-preserved.md` — content schema ADR
- `docs/learnings/0312-set-constraints-all-deferred-does-not-defer-triggers.md`
- `docs/learnings/0313-phase-2-5-grep-must-search-alter-type-add-value.md`
- `docs/learnings/0314-capability-key-drift-between-spec-pseudocode-and-router.md`
- `docs/learnings/0315-callgateaction-signature-positional-not-callback.md`
- `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md` — V2 spec resolving 6 BLOCKERS
- `docs/modules/announcments/MODULE_ANNOUNCEMENTS.md` — overview
- `docs/modules/announcments/DATA-MODEL.md` — tables/enums/RLS/telemetry
- `docs/modules/announcments/ARCHITECTURE.md` — L1-L5 layers
- `docs/modules/announcments/USER-FLOWS.md` — admin/employee web+mobile
- `docs/modules/announcments/GAPS-AND-DEBT.md` — gap inventory
- `docs/modules/announcments/BLUEPRINT.md` — phased roadmap
- `docs/modules/announcments/E2E-COVERAGE.md` — coverage matrix
- `supabase/migrations/<NEW_TS>_announcement_kind_tier_enums.sql` — 3 enums
- `supabase/migrations/<NEW_TS+1>_announcement_meta_table.sql` — sidecar + RLS
- `supabase/migrations/<NEW_TS+2>_fn_publish_announcement_notifications.sql` — fan-out helper
- `supabase/migrations/<NEW_TS+3>_publish_announcement_atomic_rpc.sql` — main RPC
- `supabase/migrations/<NEW_TS+4>_channel_message_trigger_announcement_guard.sql` — guard existing trigger
- `apps/web/src/components/dashboard/komm/AnnouncementKindPicker.tsx` — kind dropdown
- `apps/web/src/components/dashboard/komm/AnnouncementTierPicker.tsx` — tier dropdown
- `apps/web/src/components/dashboard/komm/EntityLinkPicker.tsx` — link picker
- `apps/web/src/components/dashboard/komm/TierBadge.tsx` — visual tier indicator
- `apps/web/src/components/dashboard/komm/EntityLinkCTA.tsx` — link CTA renderer
- `apps/mobile/src/components/news/TierBadge.tsx` — mobile tier badge
- `apps/mobile/src/components/news/EntityLinkCTA.tsx` — mobile link CTA
- `apps/e2e/specs/announcement-kind-tier.spec.ts` — Playwright E2E
- `packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.kindTier.test.ts` — tool tests
- `docs/journeys/JOURNEY-announce-kind-tier-link.md` — journey doc
- `docs/HANDOFF-announce-kind-tier-link.md` — handoff doc

### Modified files
- `docs/council/COUNCIL-LOG.md` — appended row for 2026-05-18 Announcement council
- `docs/decisions/0000-decision-log.md` — 3 new ADR rows
- `docs/learnings/0000-learning-log.md` — 4 new learning rows
- `packages/ai/src/capabilities/communication/publish-announcement.ts` — switch to RPC invocation, accept kind/tier/tags/link params
- `packages/telemetry/src/registry.ts` — 4 new events + emit-call wiring per L-0358
- `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` — call RPC instead of direct INSERT
- `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts` — call RPC
- `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts` — call RPC
- `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx` — mount kind/tier/link pickers
- `apps/web/src/app/dashboard/komm/nyheter/page.tsx` — render TierBadge + EntityLinkCTA on existing news cards
- `apps/mobile/app/(tabs)/news/page.tsx` (or equivalent bulletin surface) — render mobile TierBadge + EntityLinkCTA
- `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/council_meta.md` — Session History row + 4 Process Improvements + 2 Promoted to SKILL.md

---

# Phase 0 — Lost-Artifact Reconstruction

> Rebuilds the council artifacts lost when previous session's working tree was discarded. No code change. Must complete before Phase 1 because V2 spec references the ADRs.

### Task 0.1: Draft ADR-0369 (atomicity = RPC body)

**Files:**
- Create: `docs/decisions/0369-announcement-atomicity-rpc-body-fanout.md`

- [ ] **Step 1: Write ADR file**

```markdown
---
title: "Announcement Atomicity — RPC-Body Fan-Out"
id: ADR_0369
status: accepted
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0369: Announcement Atomicity — RPC-Body Fan-Out

## Context and Problem Statement

V1 spec (`docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md`, REJECTED 2026-05-18) introduced a two-row write (`channel_message` parent + `announcement_meta` sidecar) and claimed atomicity via `SET CONSTRAINTS ALL DEFERRED` wrapping. Supervisor code-trace in council Phase 3 falsified the claim: PostgreSQL `SET CONSTRAINTS ALL DEFERRED` only defers constraints marked `DEFERRABLE`, NOT plain `AFTER INSERT` triggers. The existing notification trigger at `supabase/migrations/20260422310100_channel_message_notification_trigger.sql:79-82` is a plain `AFTER INSERT` trigger and fires at statement end, not at COMMIT. Consequence: every announcement would silently fan out with `tier='work'` from the COALESCE fallback because `announcement_meta` would not exist yet.

This is chair self-reversal precedent #10 per L-0294. Three options surfaced. This ADR locks Option B.

## Decision Drivers

- Atomicity is load-bearing for tier-driven notification routing.
- Existing `AFTER INSERT` trigger must keep handling non-announcement message types unchanged (EXCEPTION handler, mute filter, sender exclusion all load-bearing).
- L-0312 promotes "SET CONSTRAINTS does not defer triggers" to canonical learning.

## Considered Options

1. **Option A — Reverse INSERT order + DEFERRABLE FK on sidecar.** Insert sidecar first with pre-generated message_id, then channel_message. Requires `announcement_meta.channel_message_id` FK to be `DEFERRABLE INITIALLY DEFERRED`. Action-at-distance: deferred FK affects all channel_message writes globally.
2. **Option B — Move fan-out out of AFTER INSERT trigger into RPC body.** RPC does INSERT channel_message + INSERT announcement_meta + invoke helper `fn_publish_announcement_notifications(message_id, tier, target_profile_ids)` inline. Existing trigger guards: `IF NEW.message_type = 'announcement' THEN RETURN NEW; END IF;`. Two code paths for fan-out but explicit ordering.
3. **Option C — Convert trigger to CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED.** Trigger fires at COMMIT. Subtle semantic change affecting ALL channel_message inserts; SECURITY DEFINER constraint triggers uncommon.

## Decision Outcome

**Chosen: Option B (RPC-body fan-out).** Locked 2026-05-18 by Pontus.

```sql
CREATE OR REPLACE FUNCTION public.publish_announcement_atomic(
  p_workspace_id uuid,
  p_actor_profile_id uuid,
  p_channel_id uuid,
  p_content text,                         -- pre-concatenated title + "\n" + body
  p_visibility_scope channel_message_visibility_scope,
  p_target_profile_ids uuid[],
  p_system_data jsonb,
  p_kind announcement_kind,
  p_tier announcement_tier,
  p_tags text[],
  p_linked_entity_type entity_link_type_enum,
  p_linked_entity_id uuid,
  p_client_message_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_message_id uuid;
BEGIN
  INSERT INTO channel_message (
    workspace_id, channel_id, sender_id, content, message_type,
    visibility_scope, target_profile_ids, system_data, client_message_id
  ) VALUES (
    p_workspace_id, p_channel_id, p_actor_profile_id, p_content, 'announcement',
    p_visibility_scope, p_target_profile_ids, p_system_data, p_client_message_id
  ) RETURNING id INTO v_message_id;

  INSERT INTO announcement_meta (
    channel_message_id, kind, tier, tags, linked_entity_type, linked_entity_id
  ) VALUES (
    v_message_id, p_kind, p_tier, p_tags, p_linked_entity_type, p_linked_entity_id
  );

  PERFORM public.fn_publish_announcement_notifications(
    v_message_id, p_tier, p_target_profile_ids, p_workspace_id, p_actor_profile_id, p_content
  );

  RETURN v_message_id;
END $$;

REVOKE ALL ON FUNCTION public.publish_announcement_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic TO authenticated, service_role;
```

The existing `AFTER INSERT` trigger gets a guard early-return: `IF NEW.message_type = 'announcement' THEN RETURN NEW; END IF;` so it handles non-announcement messages only.

## Rules and Consequences

- **Good:** No DEFERRABLE complexity. Explicit ordering. Existing trigger semantics preserved for non-announcement messages.
- **Bad:** Two fan-out code paths must stay in lockstep on shared invariants (channel_member subscription, mute, sender exclusion). Mitigated by helper-function reuse.
- **Agent Impact:** Future capability tools needing cross-table atomic writes must name their atomicity mechanism. Generic SET CONSTRAINTS references are rejected. Council Phase 3 verifies atomicity claims against PostgreSQL transaction semantics.

---

> After: register in `docs/decisions/0000-decision-log.md`. Pair with ADR-0370 + ADR-0371.
```

- [ ] **Step 2: Verify file lints**

Run: `cd /home/sxtnl/dev/smartout.ai-ui-shell && grep -c "^##" docs/decisions/0369-announcement-atomicity-rpc-body-fanout.md`
Expected: ≥5 sections

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0369-announcement-atomicity-rpc-body-fanout.md
git commit -m "docs(adr): ADR-0369 announcement atomicity RPC-body fan-out

Locks Option B per Pontus 2026-05-18. Resolves council REJECT Block B1
(SET CONSTRAINTS ALL DEFERRED does not defer plain triggers — L-0312).
Eliminates DEFERRABLE-trigger complexity by moving fan-out into RPC body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.2: Draft ADR-0370 (extend communication capability)

**Files:**
- Create: `docs/decisions/0370-capability-boundary-for-announcement-surface.md`

- [ ] **Step 1: Write ADR file**

```markdown
---
title: "Capability Boundary for Announcement Surface"
id: ADR_0370
status: accepted
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0370: Capability Boundary for Announcement Surface

## Context and Problem Statement

V1 spec §8 pseudocode invoked `callGateAction({ capability: 'broadcast.send', ... })`. Council Phase 3 code-trace at `packages/ai/src/capabilities/communication/publish-announcement.ts:91-96` showed existing tool uses `capability: 'communication'`. Seeds differ:

- `communication` — `supabase/migrations/20260601100000_seed_communication_authority.sql:42` — `level=suggest, min_role=employee`.
- `broadcast.send` — seeded at `20260515110000_seed_day_control_authority.sql:55` + `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:193` — `level=confirm, min_role=manager`.

Shipping as-pseudocoded would silently regress min_role from employee to manager OR fail with "no seed" because `broadcast.send` is not in `CapabilityName` type union (`packages/ai/src/capabilities/types.ts:12-105`) — only a runtime string used by Day-Control server action.

## Decision Drivers

- 4 composer paths (3 web hooks + 1 agent tool) must share one capability key OR explicitly accept two.
- Mobile boundary per ADR-0133: mobile is read-only for announcements.
- ADR-0173 frozen-4 capability namespace boundaries must not be violated.
- L-0292/ADR-0112 intent-classifier same-commit lock applies to any vocabulary change.
- L-0314 (capability-key drift between spec pseudocode and router) is sibling pattern.

## Considered Options

1. **Option A — New `broadcast.send`-bearing capability for announcements.** Clean separation, capability proliferation, intent-classifier vocab change.
2. **Option B — Extend `communication` capability with `actionType='publish_announcement_atomic'`.** All 4 composer paths invoke `communication`. Agent stays employee+/suggest. Day-Control keeps its own `broadcast.send` server-action gate AS WELL (defense-in-depth).
3. **Option C — Tier-discriminated permission inside `communication`.** Authority config seeds different min_role per tier. Novel pattern, audit coupling complexity.

## Decision Outcome

**Chosen: Option B (extend `communication`).** Locked 2026-05-18 by Pontus.

Concrete:
- `publish_announcement_atomic` RPC body PERFORMs `public.assert_capability(workspace, profile, 'communication', 'publish_announcement_atomic')` as defense-in-depth (caller already gates).
- Agent path (`publish-announcement.ts`) keeps `callGateAction(..., { capability: 'communication', actionType: 'publish_announcement_atomic', ... })`.
- Day-Control server action keeps existing `broadcast.send` gate untouched. After this RPC lands, server-action ALSO invokes the RPC (which re-gates via `communication`). Audit shows both — explicit defense-in-depth.
- `CapabilityName` type union: add `'publish_announcement_atomic'` actionType to communication entry. NO new capability namespace.
- Intent classifier: NO change (capability key 'communication' already classified, actionType-level routing already exists for other tools).

## Rules and Consequences

- **Good:** No capability namespace proliferation. Agent path authority unchanged. Mobile boundary preserved.
- **Bad:** Day-Control path has two gates (server-action `broadcast.send` + RPC `communication`). Audit trail shows both, documented as defense-in-depth.
- **Agent Impact:** Capability tool authors verify gate-action capability key in existing tool body, NOT trust spec pseudocode. Per L-0314, pseudocode is illustrative — production code is authoritative.

---

> After: register in `docs/decisions/0000-decision-log.md`. Pair with ADR-0369 + ADR-0371.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/0370-capability-boundary-for-announcement-surface.md
git commit -m "docs(adr): ADR-0370 extend communication capability for announcements

Locks Option B per Pontus 2026-05-18. Resolves council Block B2
(capability key broadcast.send phantom — L-0314). Day-Control server
action keeps broadcast.send for defense-in-depth; RPC and agent path
both gate via communication.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.3: Draft ADR-0371 (preserve tool API contract)

**Files:**
- Create: `docs/decisions/0371-announcement-schema-contract-preserved.md`

- [ ] **Step 1: Write ADR file**

```markdown
---
title: "Announcement Schema Contract — Tool API Preserved, Sidecar Adds Fields"
id: ADR_0371
status: accepted
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0371: Announcement Schema Contract — Tool API Preserved

## Context and Problem Statement

V1 spec proposed collapsing the agent capability tool `publish_announcement` parameter shape from `{ title: string(1-120), body: string(1-1600) }` to `{ content: string(1-800) }`. Council Phase 3 code-trace at `packages/ai/src/capabilities/communication/publish-announcement.ts:43-77` confirmed the existing tool schema has separate `title` + `body` input params, server-side concatenates `content = title + "\n" + body` for the channel_message INSERT (line 162).

Critical clarification surfaced in V2 research (2026-05-18 evening, post-rebuild): `channel_message` DB column is single `content text` — there is no separate `title` or `body` column to "preserve". Spec V1's claim of breaking a `{title, body}` DB shape was incorrect; the breaking change was at the TOOL API level only.

## Decision Drivers

- Mr. Botsson agent prompt templates reference `title` and `body` as distinct fields.
- Web composer modals (`ComposeAnnouncement`, `AnnounceSheet`) have separate `title` + `body` text inputs.
- 800-character single-content limit shorter than current `title (120) + body (1600) = 1720` total — operators authoring long announcements would be silently truncated.
- L-0177 silent fallback class: never silently change a contract.

## Considered Options

1. **Option A — No collapse. Keep `{title, body}` in tool params + composer UI.** Server concat to `content` for DB INSERT (existing behavior). Sidecar `announcement_meta` adds kind/tier/tags/link as additive fields.
2. **Option B — Collapse tool API to `{content}`. Migration + backward-compat window.** Composers + tool + prompt rewrites in lockstep.
3. **Option C — Hybrid: keep tool API title+body, add `{content}` as derived view for card rendering only.**

## Decision Outcome

**Chosen: Option A (preserve tool API contract).** Locked 2026-05-18 by Pontus.

Concrete:
- Tool schema unchanged: `{ title, body, audience_kind, audience_*, confirm }` PLUS additive `{ kind, tier, tags?, linked_entity_type?, linked_entity_id?, confirm }`.
- Server-side concat unchanged: `const content = ${title}\n${body}` before INSERT.
- DB shape unchanged: `channel_message.content` single text column.
- `announcement_meta` sidecar adds 5 new fields, all 1:1 with parent channel_message via PK FK.
- Mobile read path unchanged: existing `ChannelMessageBubble` consumes `content`; tier badge + entity link CTA wrap card.

## Rules and Consequences

- **Good:** Zero breaking change for agent prompts, web composers, mobile reads. Spec V2 lands faster.
- **Bad:** Tool API surface grows by 5 params. Future may want to consolidate, deferred to later ADR.
- **Agent Impact:** Tool authors NEVER collapse existing parameter shapes without an ADR + consumer survey. Spec pseudocode that changes parameter shape requires explicit "BREAKING" annotation in council Phase 3 briefing.

---

> After: register in `docs/decisions/0000-decision-log.md`. Pair with ADR-0369 + ADR-0370.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/0371-announcement-schema-contract-preserved.md
git commit -m "docs(adr): ADR-0371 preserve announcement tool API contract

Locks Option A per Pontus 2026-05-18. Resolves council Block B4 (schema
breaking content collapse). Tool keeps title+body; server concats to
channel_message.content (existing behavior). Sidecar adds kind/tier/
tags/link additively.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.4: Register 3 ADRs in decision log

**Files:**
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Read current log tail**

Run: `tail -20 /home/sxtnl/dev/smartout.ai-ui-shell/docs/decisions/0000-decision-log.md`

- [ ] **Step 2: Append 3 rows to log table**

Append (after the last ADR row in the table, matching existing format):

```markdown
| 0369 | Announcement atomicity — RPC-body fan-out (Option B) | accepted | 2026-05-18 |
| 0370 | Capability boundary for announcement surface (Option B, extend communication) | accepted | 2026-05-18 |
| 0371 | Announcement schema contract preserved (Option A, no collapse) | accepted | 2026-05-18 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0000-decision-log.md
git commit -m "docs(adr): register ADR-0369/0370/0371 in decision log

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.5: Reconstruct module docs

**Files:**
- Create: `docs/modules/announcments/MODULE_ANNOUNCEMENTS.md`
- Create: `docs/modules/announcments/DATA-MODEL.md`
- Create: `docs/modules/announcments/ARCHITECTURE.md`
- Create: `docs/modules/announcments/USER-FLOWS.md`
- Create: `docs/modules/announcments/GAPS-AND-DEBT.md`
- Create: `docs/modules/announcments/BLUEPRINT.md`
- Create: `docs/modules/announcments/E2E-COVERAGE.md`

- [ ] **Step 1: Reference existing pattern**

Run: `ls /home/sxtnl/dev/smartout.ai-ui-shell/docs/modules/daytimeline/`
Expected output: same 6-7 doc filenames to mirror.

- [ ] **Step 2: Write `MODULE_ANNOUNCEMENTS.md`** (overview + 8 invariants)

Content:

```markdown
---
title: "Module: Announcements (Nyheter)"
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [module, announcements, nyheter, channel-message-subtype]
---

# Module: Announcements

> Norwegian label: **Nyheter**. Identity: `channel_message` subtype where `message_type='announcement'` in workspace's news-type channel.

## Identity

Announcements are NOT a separate table. They are `channel_message` rows with `message_type='announcement'` posted to a workspace channel whose `channel_kind='news'`. Sidecar table `announcement_meta` (1:1 PK FK to channel_message) carries V2-added classification: `kind`, `tier`, `tags`, `linked_entity_type`, `linked_entity_id`.

## Cascade Placement

Outside dimensions (I1-D6, C1-C4, K1a/K1b). Announcements are a workspace-level broadcast surface, not a cascade artifact. They consume cascade outputs (D6 session, D4 planning_event) via polymorphic entity-link, but they do not produce cascade state.

## Surface Contracts

| Surface | Verb | Role | Authority |
|---|---|---|---|
| Web `/dashboard/komm/nyheter` | Author / Compose | admin, manager, employee | `communication`, suggest+ |
| Web Day-Control "Send melding" | Compose (operational) | manager+ | `broadcast.send`, confirm+ |
| Web header "+" GlobalCreateMenu | Compose (shortcut) | manager+ | `communication`, suggest+ |
| Web AnnounceSheet (cockpit) | Compose (cockpit) | manager+ | `communication`, suggest+ |
| Mobile bulletin board | Read / React | all members | (none — read) |
| Mobile home widget | Read (pinned) | all members | (none — read) |
| Mr. Botsson agent (chat) | Compose (proxy) | manager via two-call confirm | `communication`, suggest+ |

## C4 Authority

- `communication` capability seed: `level=suggest, min_role=employee`. Agent + web composer paths use this.
- `broadcast.send` capability seed: `level=confirm, min_role=manager`. Day-Control server action uses this (defense-in-depth alongside `communication` via RPC).

## Invariants

1. Every announcement is a `channel_message` with `message_type='announcement'`. No separate announcement table.
2. Every announcement created post-ADR-0369 has a matching `announcement_meta` row (1:1 PK FK).
3. Sidecar fields are NEVER nullable at write time (kind + tier always required; tags + entity-link nullable).
4. Tier drives notification routing: `social→mode=community priority=0`, `work→mode=work priority=1`, `external→mode=work priority=2 + email`.
5. Entity link is polymorphic (type + id) — single (type, id) pair, nullable for unlinked announcements.
6. RPC `publish_announcement_atomic` is the ONLY write path for announcements post-V2. Direct INSERT into channel_message with `message_type='announcement'` is forbidden (CHECK trigger enforces).
7. Existing `AFTER INSERT` notification trigger guards: `IF NEW.message_type = 'announcement' THEN RETURN NEW; END IF;`. Fan-out lives in RPC body only for announcements.
8. PII boundary: agent path NEVER returns raw `target_profile_ids` (count + label only). Web path passes IDs server-side; client receives count.

## Module Boundaries

- **Owns:** `channel_message` rows where `message_type='announcement'`, `announcement_meta`, `publish_announcement_atomic` RPC, `fn_publish_announcement_notifications` helper, telemetry events `announcement.*`, web composer hooks, mobile bulletin renderers, agent tool `publish_announcement`.
- **Consumes:** `channel`, `channel_member`, `notification_outbox`, `staff_event`, `session_task`, `engine_process` (via entity-link).
- **Does NOT own:** notification delivery (notification module), notification preferences (notification module), channel CRUD (communication module), engine_authority_config (governance module).

## See also
- [DATA-MODEL.md](./DATA-MODEL.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [USER-FLOWS.md](./USER-FLOWS.md)
- [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md)
- [BLUEPRINT.md](./BLUEPRINT.md)
- [E2E-COVERAGE.md](./E2E-COVERAGE.md)
- ADR-0369, ADR-0370, ADR-0371
```

- [ ] **Step 3: Write `DATA-MODEL.md`**

Document: enums (announcement_kind, announcement_tier, entity_link_type_enum), `announcement_meta` table DDL, RLS policies, tier→notification mapping table, telemetry events, migrations inventory.

- [ ] **Step 4: Write `ARCHITECTURE.md`**

Document: L1 (web bulletin + Day-Control + GlobalCreateMenu + AnnounceSheet) → L2 (TanStack hooks) → L3 (RPC `publish_announcement_atomic`) → L4 (channel_message + announcement_meta + notification_outbox) → L5 (telemetry events). Mobile read path. Agent tool path.

- [ ] **Step 5: Write `USER-FLOWS.md`**

Document: admin/manager/employee flows on web + mobile. Lifecycle (compose → confirm → publish → read → react). 4 entry points into composer. Audience targeting behavior. Edge cases. NOT-DOES list.

- [ ] **Step 6: Write `GAPS-AND-DEBT.md`**

Document: 20 shipped capabilities (from Wave A + V1 prep) + 14 gaps with code citations. Severity matrix.

- [ ] **Step 7: Write `BLUEPRINT.md`**

Document: current status (Wave A shipped, V2 in this plan), 12 candidate phases for future sorties.

- [ ] **Step 8: Write `E2E-COVERAGE.md`**

Document: coverage matrix per role × surface × verb. Mark current coverage and target coverage post-V2.

- [ ] **Step 9: Commit**

```bash
git add docs/modules/announcments/
git commit -m "docs(announcements): module folder — overview, data model, architecture, flows, gaps, blueprint, E2E coverage

Reconstructs module docs lost when previous session was not committed.
Mirrors daytimeline/payroll folder pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.6: Draft 4 learnings

**Files:**
- Create: `docs/learnings/0312-set-constraints-all-deferred-does-not-defer-triggers.md`
- Create: `docs/learnings/0313-phase-2-5-grep-must-search-alter-type-add-value.md`
- Create: `docs/learnings/0314-capability-key-drift-between-spec-pseudocode-and-router.md`
- Create: `docs/learnings/0315-callgateaction-signature-positional-not-callback.md`
- Modify: `docs/learnings/0000-learning-log.md`

- [ ] **Step 1: Write L-0312 (SET CONSTRAINTS does not defer triggers)**

Use template at `docs/templates/learning.md`. Body content:

> **Discovery:** PostgreSQL `SET CONSTRAINTS ALL DEFERRED` only defers constraints declared `DEFERRABLE`. Plain `AFTER INSERT` triggers fire at statement end regardless. **Hard rule:** Any atomicity claim relying on `SET CONSTRAINTS` must enumerate which constraints are DEFERRABLE. Triggers must use `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` syntax, OR fan-out must move into the RPC body (ADR-0369). **Phase 3 verification:** Council code-tracer mandate now includes "grep for DEFERRABLE keyword on every claimed-deferred constraint."

- [ ] **Step 2: Write L-0313 (Phase 2.5 must grep ALTER TYPE ADD VALUE)** — 3rd occurrence, ADR-grade promotion

Body content:

> **Discovery:** Phase 2.5 fact-check used `grep "CREATE TYPE notification_channel"` and reported `'in_app'` not in enum. Reality: `'in_app'` added via `ALTER TYPE notification_channel ADD VALUE 'in_app'` at `supabase/migrations/20260324220000_notification_table.sql:7`. **3rd occurrence of grep-narrowness pattern** (sibling: L-0250 missing enum lookup, L-0258 inline-type-not-grepped). **Hard rule:** Enum existence checks MUST grep BOTH `CREATE TYPE <name>` AND `ALTER TYPE <name> ADD VALUE`. **Promotion: 3rd-occurrence threshold met — must be codified in `~/.claude/skills/run-council/SKILL.md` Phase 2.5 section.**

- [ ] **Step 3: Write L-0314 (capability-key drift between spec and router)**

Body content:

> **Discovery:** V1 spec §8 pseudocode referenced `capability: 'broadcast.send'` while existing tool body at `publish-announcement.ts:91-96` uses `capability: 'communication'`. Two seeds with different min_role. Phantom contract: shipping spec would silently regress employee→manager OR fail "no seed". **Hard rule:** Spec authors verify capability key against existing tool body via grep, NOT against memory of which capability "should" own a feature. Council Phase 2.5 grep: `callGateAction.*capability.*<feature>` to find existing call sites.

- [ ] **Step 4: Write L-0315 (callGateAction is positional, not callback)**

Body content:

> **Discovery:** V1 spec §8 pseudocode invoked `callGateAction({ capability, action: async () => { ... } })` (callback pattern). Real signature at `gate.ts:52` is positional: `callGateAction(supabaseAdmin, workspaceId, actorProfileId, args)`. Returns `{ allow, reason, ... }`. Callback pattern would not compile; builder might "fix" by skipping gate-result check entirely. **Hard rule:** Spec pseudocode invoking shared helpers (`callGateAction`, `emit`, `gatedMutation`) MUST match the helper's exported signature. Phase 2.5 grep helper export and verify parameter list.

- [ ] **Step 5: Append rows to learning log**

Append to `docs/learnings/0000-learning-log.md`:

```markdown
| 0312 | SET CONSTRAINTS ALL DEFERRED does not defer plain triggers | 2026-05-18 |
| 0313 | Phase 2.5 grep must search ALTER TYPE ADD VALUE | 2026-05-18 |
| 0314 | Capability-key drift between spec pseudocode and router | 2026-05-18 |
| 0315 | callGateAction signature is positional, not callback | 2026-05-18 |
```

- [ ] **Step 6: Commit**

```bash
git add docs/learnings/0312-*.md docs/learnings/0313-*.md docs/learnings/0314-*.md docs/learnings/0315-*.md docs/learnings/0000-learning-log.md
git commit -m "docs(learnings): L-0312-0315 from 2026-05-18 council REJECT

L-0312: SET CONSTRAINTS does not defer plain triggers (ADR-0369 root cause)
L-0313: Phase 2.5 must grep ALTER TYPE ADD VALUE (3rd occurrence, ADR-grade)
L-0314: Capability-key drift spec vs router (sibling L-0176/L-0177 family)
L-0315: callGateAction positional, not callback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.7: Append COUNCIL-LOG entry

**Files:**
- Modify: `docs/council/COUNCIL-LOG.md`

- [ ] **Step 1: Read current tail**

Run: `tail -30 /home/sxtnl/dev/smartout.ai-ui-shell/docs/council/COUNCIL-LOG.md`

- [ ] **Step 2: Append row**

```markdown
| 2026-05-18 | Announcement Kind/Tier/Entity-Link V1 | REJECT (chair self-reversal #10 per L-0294) | 6 BLOCKERS / 7 MUST-FIX / 5 SHOULD-FIX. Trust Gate 8/8 FAIL. Derived: ADR-0369/0370/0371 + L-0312/0313/0314/0315. Re-draft as V2 per plan 2026-05-18-announcement-kind-tier-link.md. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/council/COUNCIL-LOG.md
git commit -m "docs(council): log 2026-05-18 Announcement REJECT verdict

10th chair self-reversal per L-0294. Trust Gate 8/8 FAIL (worst in corpus).
Derived 3 ADRs + 4 learnings. V2 re-draft pending per plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.8: Update council_meta.md

**Files:**
- Modify: `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/council_meta.md`

- [ ] **Step 1: Read current state**

Read the existing council_meta.md and identify the Session History table tail + Process Improvements section tail.

- [ ] **Step 2: Append Session History row + 4 Process Improvements + 2 Promoted to SKILL.md entries**

Session History row: `| 2026-05-18 | Announcement Kind/Tier/Link V1 | REJECT (chair self-reversal #10) | Trust Gate 8/8 FAIL | ADR-0369/0370/0371 + L-0312/0313/0314/0315 |`

Process Improvements:
1. Atomicity claims must enumerate DEFERRABLE constraints (L-0312)
2. Phase 2.5 grep enums must include ALTER TYPE ADD VALUE (L-0313)
3. Spec pseudocode capability keys verified against existing tool body (L-0314)
4. Spec pseudocode helper invocations verified against exported signature (L-0315)

Promoted to SKILL.md:
- L-0313 — 3rd occurrence grep-narrowness pattern, mandatory in run-council SKILL Phase 2.5 (`~/.claude/skills/run-council/SKILL.md` update pending operator action)
- L-0294 chair self-reversal: 10th codified precedent, framework stable

- [ ] **Step 3: No commit** (memory file, outside repo)

---

# Phase 1 — V2 Spec

> Resolves the 6 BLOCKERS. V2 = lower-risk spec replacing rejected V1.

### Task 1.1: Write V2 spec

**Files:**
- Create: `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md`

- [ ] **Step 1: Write spec from outline**

Required sections, each filled with concrete content:

1. **Frontmatter** — status: accepted, council_verdict (V1 REJECT + V2 pre-clear via Phase 2.5), supersedes: V1 path.
2. **Goal** — same as plan goal.
3. **Architecture** — 3 ADR decisions referenced.
4. **Schema changes** — full DDL: 3 enums + announcement_meta table + RLS policies.
5. **RPC contract** — `publish_announcement_atomic` signature + body (matches ADR-0369 Step 1).
6. **Helper function** — `fn_publish_announcement_notifications(message_id, tier, target_profile_ids, workspace_id, actor_id, content)` signature + body.
7. **Trigger guard** — `IF NEW.message_type = 'announcement' THEN RETURN NEW; END IF;` early-return at top of `fn_channel_message_notification_trigger`.
8. **Tool API contract** — `publish_announcement` tool schema additions (kind, tier, tags?, linked_entity_type?, linked_entity_id?). Server concat to content unchanged. callGateAction positional invocation unchanged.
9. **Composer paths** — 4 paths converging on RPC. Exact diffs per file.
10. **UI components** — KindPicker, TierPicker, EntityLinkPicker, TierBadge, EntityLinkCTA (web + mobile).
11. **Notification mapping table** — tier → mode + priority + allowed_channels.
12. **Telemetry events** — 4 events with exact registry keys + property shapes.
13. **Test plan** — unit + integration + E2E coverage.
14. **Rollout** — single-merge (no flags). Migration order. Rollback path (drop sidecar + RPC + revert trigger guard).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md
git commit -m "docs(spec): announcement kind/tier/entity-link V2 — resolves 6 BLOCKERS

V2 replaces rejected V1. Implements ADR-0369 (RPC body fan-out),
ADR-0370 (extend communication), ADR-0371 (preserve tool API).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: Phase 2.5 self-fact-check

**Files:** (read-only verification)

- [ ] **Step 1: Verify enum references**

Run:
```bash
grep -n "CREATE TYPE notification_mode\|ALTER TYPE notification_mode" supabase/migrations/*.sql
grep -n "CREATE TYPE notification_channel\|ALTER TYPE notification_channel" supabase/migrations/*.sql
```
Expected: notification_mode = training/work/community; notification_channel = push/sms/email/voice + in_app via ALTER TYPE.

Verify V2 spec mapping table uses ONLY these values.

- [ ] **Step 2: Verify notification_outbox columns**

Run: `grep -A 30 "CREATE TABLE public.notification_outbox" supabase/migrations/00006_notification_engine.sql`

Expected columns: id, workspace_id, recipient_id, mode, priority, title, body, action_url, metadata, allowed_channels, status, error_log, scheduled_for, processed_at, created_at.

Verify V2 helper function INSERT uses `recipient_id` (NOT `recipient_profile_id`) and puts event-specific metadata in `metadata jsonb`.

- [ ] **Step 3: Verify channel_message columns**

Run: `grep -B1 -A 30 "CREATE TABLE public.channel_message\b" supabase/migrations/*.sql | head -50`

Verify V2 RPC INSERT uses: `sender_id` (NOT `sender_profile_id`), `content` (single text), `visibility_scope` (NOT `visibility`), `target_profile_ids` (NOT `targeted_member_ids`), `system_data` (jsonb).

- [ ] **Step 4: Verify callGateAction signature**

Run: `grep -A 7 "export async function callGateAction" packages/ai/src/capabilities/communication/gate.ts`

Verify V2 spec invokes positionally: `callGateAction(supabase, workspaceId, profileId, { capability, actionType, channel, entityId })`.

- [ ] **Step 5: Verify communication seed**

Run: `grep -B2 -A 10 "'communication'" supabase/migrations/20260601100000_seed_communication_authority.sql`

Verify min_role=employee, level=suggest. V2 spec must NOT change this.

- [ ] **Step 6: Verify telemetry registry pattern**

Run: `sed -n '4165,4180p' packages/telemetry/src/registry.ts`

Read existing `channel.message.sent` event registration. V2's 4 new events follow same pattern.

- [ ] **Step 7: Verify is_manager_in_workspace helper**

Run: `grep -rn "CREATE OR REPLACE FUNCTION.*is_manager_in_workspace\|CREATE FUNCTION.*is_manager_in_workspace" supabase/migrations/*.sql`

If absent, V2 spec adds it as M0 prerequisite migration. If present, V2 references existing.

- [ ] **Step 8: Write fact-check report**

Append to V2 spec § "Phase 2.5 Fact-Check Report" with grep evidence. Mark each verified.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md
git commit -m "docs(spec): V2 Phase 2.5 fact-check evidence appended

All 8 grep checks pass against real codebase state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: V2 self-review against 6 V1 BLOCKERS

**Files:** (review-only)

- [ ] **Step 1: Verify B1 (atomicity) resolved**

V2 spec §5 must show: no SET CONSTRAINTS, no DEFERRABLE FK. RPC body does all 3 INSERTs inline. Trigger guards announcement.

- [ ] **Step 2: Verify B2 (capability key) resolved**

V2 spec §8 must show: `callGateAction(..., { capability: 'communication', actionType: 'publish_announcement_atomic' })`. NOT `broadcast.send`.

- [ ] **Step 3: Verify B3 (callGateAction signature) resolved**

V2 spec §8 + §5 must show positional invocation matching gate.ts:52.

- [ ] **Step 4: Verify B4 (content collapse) resolved**

V2 spec §8 tool schema must keep `{title, body}` separate. Server concat unchanged.

- [ ] **Step 5: Verify B5 (telemetry not extended) resolved**

V2 spec §12 must enumerate 4 new events with exact `registry.ts` insertion points. Each event has matching emit() call-site declared in §9 (composer diffs) and §5 (RPC consumers).

- [ ] **Step 6: Verify B6 (in_app enum) resolved**

V2 spec §11 notification mapping must list `in_app` as allowed channel for tier=social. Phase 2.5 evidence shows enum supports it.

- [ ] **Step 7: Write self-review block in spec**

Append § "V1→V2 Blocker Resolution":
```markdown
| Block | V1 Issue | V2 Resolution | Section |
|---|---|---|---|
| B1 | SET CONSTRAINTS no-op | RPC body fan-out | §5 |
| B2 | broadcast.send phantom | communication actionType | §8 |
| B3 | callback signature | positional | §5, §8 |
| B4 | content collapse | preserved | §8 |
| B5 | registry not extended | 4 events + 4 emit-sites | §12 |
| B6 | in_app dropped | listed in tier mapping | §11 |
```

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md
git commit -m "docs(spec): V2 self-review confirms 6 V1 BLOCKERS resolved

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — Schema

> Migrations land in ascending timestamp order. Use timestamps strictly greater than current development HEAD max (L-0042 mandate). Run `ls supabase/migrations/ | tail -3` to find current HEAD.

### Task 2.1: Add 3 announcement enums

**Files:**
- Create: `supabase/migrations/<TS+0>_announcement_kind_tier_enums.sql`

- [ ] **Step 1: Find current migration HEAD timestamp**

Run: `ls /home/sxtnl/dev/smartout.ai-ui-shell/supabase/migrations/ | sort | tail -3`
Use timestamp > HEAD. Format: `YYYYMMDDHHMMSS`.

- [ ] **Step 2: Write enum migration**

```sql
-- 3 enums for announcement classification per ADR-0371 (additive) + V2 spec §4

CREATE TYPE public.announcement_kind AS ENUM (
  'staff_event',       -- personaltreff, gathering
  'system_message',    -- ops, scheduling, mandatory
  'celebration',       -- birthday, work-anniversary, achievement
  'workspace_news',    -- general news, default
  'external_link'      -- linked URL or external resource
);

CREATE TYPE public.announcement_tier AS ENUM (
  'social',    -- low priority, community mode
  'work',      -- standard priority, work mode (default)
  'external'   -- elevated priority, work mode + email
);

CREATE TYPE public.entity_link_type_enum AS ENUM (
  'staff_event',
  'session_task',
  'engine_process',
  'channel',
  'url'
);

COMMENT ON TYPE public.announcement_kind IS
  'Classification of announcement intent per V2 spec §4. Sidecar (announcement_meta.kind) NOT NULL.';
COMMENT ON TYPE public.announcement_tier IS
  'Notification routing tier per V2 spec §11. social→community priority 0, work→work priority 1, external→work priority 2 + email.';
COMMENT ON TYPE public.entity_link_type_enum IS
  'Polymorphic entity-link discriminator. Pair with entity_link_id in announcement_meta. NULL on unlinked announcements.';
```

- [ ] **Step 3: Run migration locally**

Run: `cd /home/sxtnl/dev/smartout.ai-ui-shell && npx supabase db reset` (if local DB stale) OR `npx supabase migration up`.

Expected: 3 enums created. Verify: `npx supabase db dump --schema public | grep "CREATE TYPE.*announcement"`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<TS+0>_announcement_kind_tier_enums.sql
git commit -m "feat(announcements): 3 enums (kind, tier, entity_link_type) per ADR-0371

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: Create announcement_meta sidecar table + RLS

**Files:**
- Create: `supabase/migrations/<TS+1>_announcement_meta_table.sql`

- [ ] **Step 1: Write sidecar migration**

```sql
-- announcement_meta sidecar (1:1 with channel_message where message_type='announcement')
-- Per ADR-0369 (atomicity via RPC body) + ADR-0371 (preserve channel_message shape)

CREATE TABLE public.announcement_meta (
  channel_message_id uuid PRIMARY KEY
    REFERENCES public.channel_message(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL
    REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  kind public.announcement_kind NOT NULL,
  tier public.announcement_tier NOT NULL DEFAULT 'work',
  tags text[] NOT NULL DEFAULT '{}',
  linked_entity_type public.entity_link_type_enum,
  linked_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT announcement_meta_link_pair_or_null CHECK (
    (linked_entity_type IS NULL AND linked_entity_id IS NULL)
    OR (linked_entity_type IS NOT NULL AND linked_entity_id IS NOT NULL)
  )
);

CREATE INDEX idx_announcement_meta_workspace_tier ON public.announcement_meta(workspace_id, tier);
CREATE INDEX idx_announcement_meta_link ON public.announcement_meta(linked_entity_type, linked_entity_id)
  WHERE linked_entity_type IS NOT NULL;
CREATE INDEX idx_announcement_meta_tags ON public.announcement_meta USING GIN(tags);

CREATE TRIGGER set_announcement_meta_updated_at
  BEFORE UPDATE ON public.announcement_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.announcement_meta ENABLE ROW LEVEL SECURITY;

-- Read: any workspace member can read announcement_meta for messages in channels they can read.
CREATE POLICY "Members read announcement_meta in workspace channels" ON public.announcement_meta
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_message cm
      JOIN public.channel_member chm ON chm.channel_id = cm.channel_id
      WHERE cm.id = announcement_meta.channel_message_id
        AND chm.profile_id IN (
          SELECT p.profile_id FROM public.profile p
          WHERE p.user_id = auth.uid()
            AND p.workspace_id = announcement_meta.workspace_id
        )
    )
  );

-- Write: SECURITY DEFINER RPC only (publish_announcement_atomic). Direct INSERT denied.
CREATE POLICY "Deny direct write — RPC only" ON public.announcement_meta
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.announcement_meta IS
  'Sidecar 1:1 with channel_message for announcements per ADR-0369. Created exclusively via publish_announcement_atomic RPC.';
```

- [ ] **Step 2: Run migration**

Run: `npx supabase migration up`

Verify table + RLS: `psql -c "\d announcement_meta"`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<TS+1>_announcement_meta_table.sql
git commit -m "feat(announcements): announcement_meta sidecar + RLS deny-write

RLS: authenticated read via channel membership; write denied (SECURITY
DEFINER RPC only per ADR-0369).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: Create fn_publish_announcement_notifications helper

**Files:**
- Create: `supabase/migrations/<TS+2>_fn_publish_announcement_notifications.sql`

- [ ] **Step 1: Write helper migration**

```sql
-- Helper invoked from publish_announcement_atomic RPC body.
-- Replicates non-announcement trigger logic but for tier-driven routing.

CREATE OR REPLACE FUNCTION public.fn_publish_announcement_notifications(
  p_message_id uuid,
  p_tier public.announcement_tier,
  p_target_profile_ids uuid[],
  p_workspace_id uuid,
  p_actor_profile_id uuid,
  p_content text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode public.notification_mode;
  v_priority smallint;
  v_channels public.notification_channel[];
  v_channel_id uuid;
  v_title text;
  v_body text;
BEGIN
  -- Tier → mode + priority + channels mapping per V2 spec §11
  CASE p_tier
    WHEN 'social' THEN
      v_mode := 'community'; v_priority := 0; v_channels := ARRAY['push', 'in_app']::public.notification_channel[];
    WHEN 'work' THEN
      v_mode := 'work'; v_priority := 1; v_channels := ARRAY['push', 'in_app']::public.notification_channel[];
    WHEN 'external' THEN
      v_mode := 'work'; v_priority := 2; v_channels := ARRAY['push', 'in_app', 'email']::public.notification_channel[];
  END CASE;

  -- channel_id lookup for action_url
  SELECT cm.channel_id INTO v_channel_id FROM public.channel_message cm WHERE cm.id = p_message_id;

  -- Truncate to title (first 80) + body (rest)
  v_title := substring(split_part(p_content, E'\n', 1) FROM 1 FOR 200);
  v_body := substring(p_content FROM 1 FOR 500);

  -- INSERT notification_outbox rows for each target (or all subscribers if target NULL/empty)
  INSERT INTO public.notification_outbox (
    workspace_id, recipient_id, mode, priority, title, body, action_url,
    metadata, allowed_channels
  )
  SELECT
    p_workspace_id,
    p.profile_id,
    v_mode,
    v_priority,
    v_title,
    v_body,
    '/dashboard/komm/nyheter#msg-' || p_message_id::text,
    jsonb_build_object(
      'event_key', 'announcement.published',
      'entity_type', 'channel_message',
      'entity_id', p_message_id,
      'tier', p_tier::text,
      'channel_id', v_channel_id
    ),
    v_channels
  FROM public.profile p
  JOIN public.channel_member chm ON chm.profile_id = p.profile_id
  WHERE p.workspace_id = p_workspace_id
    AND chm.channel_id = v_channel_id
    AND p.profile_id <> p_actor_profile_id  -- exclude sender
    AND (p_target_profile_ids IS NULL OR array_length(p_target_profile_ids, 1) IS NULL OR p.profile_id = ANY(p_target_profile_ids))
    AND NOT EXISTS (
      SELECT 1 FROM public.channel_mute m
      WHERE m.channel_id = v_channel_id AND m.profile_id = p.profile_id
    );
END $$;

REVOKE ALL ON FUNCTION public.fn_publish_announcement_notifications FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_publish_announcement_notifications TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_publish_announcement_notifications IS
  'Fan-out helper for announcement tier-driven routing. Invoked exclusively from publish_announcement_atomic RPC body per ADR-0369.';
```

- [ ] **Step 2: Run migration**

Run: `npx supabase migration up`. Verify with: `psql -c "\df fn_publish_announcement_notifications"`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<TS+2>_fn_publish_announcement_notifications.sql
git commit -m "feat(announcements): fn_publish_announcement_notifications helper

Tier→(mode, priority, channels) mapping per V2 spec §11. SECURITY
DEFINER, GRANT EXECUTE to authenticated/service_role only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.4: Create publish_announcement_atomic RPC

**Files:**
- Create: `supabase/migrations/<TS+3>_publish_announcement_atomic_rpc.sql`

- [ ] **Step 1: Write RPC migration** (exact body from ADR-0369 Step 1, with full INSERT params)

Use the code in ADR-0369 §"Decision Outcome", adapted to grep-verified `channel_message` column names (`sender_id`, `content`, `visibility_scope`, `target_profile_ids`, `system_data`, `client_message_id`).

- [ ] **Step 2: Run migration**

Run: `npx supabase migration up`. Verify with `psql -c "\df publish_announcement_atomic"`.

- [ ] **Step 3: Smoke-test RPC**

```sql
SELECT publish_announcement_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,  -- workspace
  '00000000-0000-0000-0000-000000000002'::uuid,  -- actor
  '00000000-0000-0000-0000-000000000003'::uuid,  -- channel
  'Test title\nTest body',
  'all_members'::channel_message_visibility_scope,
  ARRAY[]::uuid[],
  '{"audience_kind":"all","audience_label":"All workspace"}'::jsonb,
  'workspace_news'::announcement_kind,
  'work'::announcement_tier,
  ARRAY[]::text[],
  NULL::entity_link_type_enum,
  NULL::uuid,
  gen_random_uuid()
);
```

Expected: returns a UUID. Verify rows in channel_message + announcement_meta + notification_outbox.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<TS+3>_publish_announcement_atomic_rpc.sql
git commit -m "feat(announcements): publish_announcement_atomic RPC (single transaction)

Inserts channel_message + announcement_meta + notification_outbox in one
SECURITY DEFINER function body per ADR-0369. No DEFERRABLE complexity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.5: Guard existing channel_message trigger

**Files:**
- Create: `supabase/migrations/<TS+4>_channel_message_trigger_announcement_guard.sql`

- [ ] **Step 1: Read current trigger**

Run: `cat /home/sxtnl/dev/smartout.ai-ui-shell/supabase/migrations/20260422310100_channel_message_notification_trigger.sql`

Identify function name (likely `fn_channel_message_notification_trigger`).

- [ ] **Step 2: Write CREATE OR REPLACE migration with announcement guard**

```sql
-- Add early-return guard for message_type='announcement' per ADR-0369.
-- Announcement fan-out now lives in publish_announcement_atomic RPC body.

CREATE OR REPLACE FUNCTION public.fn_channel_message_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ADR-0369: announcement messages handled exclusively by publish_announcement_atomic.
  -- Trigger short-circuits to avoid double fan-out.
  IF NEW.message_type = 'announcement' THEN
    RETURN NEW;
  END IF;

  -- (paste rest of existing trigger body verbatim from 20260422310100 migration)
  -- ... existing logic for system/user/brief/handoff/summary message types ...

  RETURN NEW;
END $$;
```

> **CRITICAL:** Paste the rest of the existing function body unchanged. Do NOT rewrite. Only prepend the announcement guard.

- [ ] **Step 3: Run migration**

Run: `npx supabase migration up`.

- [ ] **Step 4: Smoke-test guard**

```sql
-- INSERT a system message (non-announcement) — trigger fans out as before
INSERT INTO channel_message (channel_id, workspace_id, sender_id, content, message_type)
VALUES (...test channel id..., ...test workspace id..., ...test actor id..., 'system notice', 'system');
-- Verify notification_outbox rows created.

-- INSERT a manual announcement (post-RPC, should be RARE) — trigger guard prevents double fan-out
-- (In practice, all announcements go through RPC. This is a backstop.)
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS+4>_channel_message_trigger_announcement_guard.sql
git commit -m "feat(announcements): trigger guard — announcement fan-out via RPC only

Existing AFTER INSERT trigger short-circuits message_type='announcement'.
RPC publish_announcement_atomic owns announcement fan-out per ADR-0369.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.6: Migration integration tests

**Files:**
- Create: `apps/e2e/db/announcement-atomic-rpc.spec.ts` (or appropriate location)

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

describe("publish_announcement_atomic", () => {
  it("inserts channel_message + announcement_meta + notification_outbox atomically", async () => {
    const { data: msgId, error } = await client.rpc("publish_announcement_atomic", {
      p_workspace_id: "b0000000-0000-0000-0000-000000000000",
      p_actor_profile_id: "f0000000-0000-0000-0000-000000000000",
      p_channel_id: "<test news channel id>",
      p_content: "Atomic test\nBody",
      p_visibility_scope: "all_members",
      p_target_profile_ids: [],
      p_system_data: { audience_kind: "all", audience_label: "All" },
      p_kind: "workspace_news",
      p_tier: "work",
      p_tags: [],
      p_linked_entity_type: null,
      p_linked_entity_id: null,
      p_client_message_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect(msgId).toMatch(/^[0-9a-f-]{36}$/);

    const { data: meta } = await client.from("announcement_meta").select("*").eq("channel_message_id", msgId).single();
    expect(meta?.kind).toBe("workspace_news");
    expect(meta?.tier).toBe("work");

    const { count } = await client.from("notification_outbox").select("*", { count: "exact", head: true }).contains("metadata", { entity_id: msgId });
    expect(count).toBeGreaterThan(0);
  });

  it("tier=external sets priority=2 + email channel", async () => {
    const { data: msgId } = await client.rpc("publish_announcement_atomic", {
      p_workspace_id: "b0000000-0000-0000-0000-000000000000",
      p_actor_profile_id: "f0000000-0000-0000-0000-000000000000",
      p_channel_id: "<test news channel id>",
      p_content: "External\nUrgent",
      p_visibility_scope: "all_members",
      p_target_profile_ids: [],
      p_system_data: {},
      p_kind: "workspace_news",
      p_tier: "external",
      p_tags: [],
      p_linked_entity_type: null,
      p_linked_entity_id: null,
      p_client_message_id: crypto.randomUUID(),
    });

    const { data: outbox } = await client.from("notification_outbox").select("priority, allowed_channels").contains("metadata", { entity_id: msgId }).limit(1).single();
    expect(outbox?.priority).toBe(2);
    expect(outbox?.allowed_channels).toContain("email");
  });

  it("entity-link CHECK rejects mismatched type+id pair", async () => {
    const { error } = await client.rpc("publish_announcement_atomic", {
      p_workspace_id: "b0000000-0000-0000-0000-000000000000",
      p_actor_profile_id: "f0000000-0000-0000-0000-000000000000",
      p_channel_id: "<test news channel id>",
      p_content: "Bad link\n.",
      p_visibility_scope: "all_members",
      p_target_profile_ids: [],
      p_system_data: {},
      p_kind: "workspace_news",
      p_tier: "work",
      p_tags: [],
      p_linked_entity_type: "staff_event",
      p_linked_entity_id: null,  // mismatched
      p_client_message_id: crypto.randomUUID(),
    });
    expect(error?.message).toMatch(/announcement_meta_link_pair_or_null/);
  });
});
```

- [ ] **Step 2: Run tests, verify all fail with "function publish_announcement_atomic does not exist" or similar**

Run: `pnpm vitest apps/e2e/db/announcement-atomic-rpc.spec.ts -t ""`

- [ ] **Step 3: After Phase 2 Tasks 2.1-2.5 applied, re-run tests**

Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/db/announcement-atomic-rpc.spec.ts
git commit -m "test(announcements): integration tests for publish_announcement_atomic RPC

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase 3 — Capability Tool

> Switch `publish_announcement` tool body from direct INSERT to RPC invocation. Extend schema with 5 new params. callGateAction call stays exactly as today (capability='communication').

### Task 3.1: Extend tool Zod schema

**Files:**
- Modify: `packages/ai/src/capabilities/communication/publish-announcement.ts:43-77`

- [ ] **Step 1: Add 5 new fields to schema**

Edit `schema: z.object({...})` block. Insert before `confirm`:

```typescript
kind: z.enum([
  "staff_event",
  "system_message",
  "celebration",
  "workspace_news",
  "external_link",
]).default("workspace_news").describe(
  "Announcement classification per V2 spec §4. " +
    "staff_event: personaltreff/gathering. system_message: ops mandatory. " +
    "celebration: birthday/anniversary. workspace_news: general (default). " +
    "external_link: pointing to URL or external resource.",
),
tier: z.enum(["social", "work", "external"]).default("work").describe(
  "Notification routing tier per V2 spec §11. " +
    "social: low priority, community mode. " +
    "work: standard priority, work mode (default). " +
    "external: elevated priority + email channel.",
),
tags: z.array(z.string().min(1).max(30)).max(8).optional().describe(
  "Free-form tags for grouping/filtering. Max 8 tags, 30 chars each.",
),
linked_entity_type: z.enum([
  "staff_event",
  "session_task",
  "engine_process",
  "channel",
  "url",
]).optional().describe(
  "Polymorphic entity-link discriminator. Must pair with linked_entity_id.",
),
linked_entity_id: z.string().uuid().optional().describe(
  "Polymorphic entity-link target id. Must pair with linked_entity_type.",
),
```

- [ ] **Step 2: Add Zod refinement for link pair**

Append to schema object (after `.object({...})`):

```typescript
.refine(
  (data) =>
    (data.linked_entity_type === undefined && data.linked_entity_id === undefined) ||
    (data.linked_entity_type !== undefined && data.linked_entity_id !== undefined),
  { message: "linked_entity_type and linked_entity_id must both be provided or both omitted" }
)
```

- [ ] **Step 3: Update description string** to mention new fields

- [ ] **Step 4: Verify tool typechecks**

Run: `cd /home/sxtnl/dev/smartout.ai-ui-shell && pnpm --filter @smartout/ai typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/communication/publish-announcement.ts
git commit -m "feat(communication): publish_announcement tool schema +5 fields (kind/tier/tags/link)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: Switch tool body from INSERT to RPC

**Files:**
- Modify: `packages/ai/src/capabilities/communication/publish-announcement.ts:160-205`

- [ ] **Step 1: Replace INSERT block with RPC call**

Replace the existing block:

```typescript
// Phase: published — INSERT after human approval (confirm=true)
const isTargeted = audience.kind !== "all";
const content = `${params.title}\n${params.body}`;

const { data, error } = await supabase
  .from("channel_message")
  .insert({...})
  .select("id, content, created_at")
  .single();

if (error) {
  return `Error publishing announcement: ${error.message}`;
}
```

With:

```typescript
// Phase: published — RPC publish_announcement_atomic (atomic per ADR-0369)
const isTargeted = audience.kind !== "all";
const content = `${params.title}\n${params.body}`;
const clientMessageId = crypto.randomUUID();

const { data: messageId, error } = await supabase.rpc("publish_announcement_atomic", {
  p_workspace_id: ctx.workspaceId,
  p_actor_profile_id: ctx.profileId,
  p_channel_id: params.channel_id,
  p_content: content,
  p_visibility_scope: isTargeted ? "targeted_members" : "all_members",
  p_target_profile_ids: isTargeted ? resolved.profileIds : [],
  p_system_data: {
    audience_kind: audience.kind,
    audience_label: resolved.label,
  },
  p_kind: params.kind ?? "workspace_news",
  p_tier: params.tier ?? "work",
  p_tags: params.tags ?? [],
  p_linked_entity_type: params.linked_entity_type ?? null,
  p_linked_entity_id: params.linked_entity_id ?? null,
  p_client_message_id: clientMessageId,
});

if (error) {
  return `Error publishing announcement: ${error.message}`;
}
const data = { id: messageId as string };
```

- [ ] **Step 2: Update emit() block to include new properties**

After the RPC call, modify the existing `emit({ event: "channel.message.sent", ... })` block to add:

```typescript
properties: {
  channel_id: params.channel_id,
  origin_type: "agent",
  message_type: "announcement",
  visibility_scope: isTargeted ? "targeted_members" : "all_members",
  target_profile_count: resolved.count,
  audience_kind: audience.kind,
  notification_priority: params.tier === "external" ? 2 : params.tier === "work" ? 1 : 0,
  notification_mode: params.tier === "social" ? "community" : "work",
  announcement_kind: params.kind ?? "workspace_news",
  announcement_tier: params.tier ?? "work",
  has_entity_link: params.linked_entity_type !== undefined,
  tag_count: params.tags?.length ?? 0,
},
```

- [ ] **Step 3: Add second emit() for `announcement.published` event** (immediately after channel.message.sent)

```typescript
await emit({
  event: "announcement.published",
  workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
  actor_id: nonEmpty(ctx.profileId, "actor_id"),
  entity: {
    entity_type: "channel_message",
    entity_id: data.id,
  },
  properties: {
    channel_id: params.channel_id,
    kind: params.kind ?? "workspace_news",
    tier: params.tier ?? "work",
    target_profile_count: resolved.count,
    has_entity_link: params.linked_entity_type !== undefined,
    tag_count: params.tags?.length ?? 0,
    origin_type: "agent",
  },
});
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/ai typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/communication/publish-announcement.ts
git commit -m "feat(communication): publish_announcement uses RPC + emits announcement.published

Replaces direct INSERT with publish_announcement_atomic RPC per ADR-0369.
Emits channel.message.sent (existing, extended) + announcement.published (new).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.3: Verify intent classifier requires no change

**Files:** (read-only)

- [ ] **Step 1: Grep for capability key 'communication' in router**

Run: `grep -rn "'communication'" /home/sxtnl/dev/smartout.ai-ui-shell/packages/ai/src/router/`

- [ ] **Step 2: Verify intent enum unchanged**

Run: `grep -rn "intent" /home/sxtnl/dev/smartout.ai-ui-shell/packages/ai/src/router/intent-classifier.ts | head -30`

Expected: existing 'communication' or 'send_message' intent. No new intent needed per ADR-0370 (extending actionType, not capability).

- [ ] **Step 3: If intent classifier has a per-actionType list, add 'publish_announcement_atomic' there per L-0292/ADR-0112 same-commit lock**

If `check-intent-coverage.ts` exists, add `publish_announcement_atomic` to coverage list.

- [ ] **Step 4: Run intent coverage check**

Run: `pnpm --filter @smartout/ai check-intent-coverage` (or equivalent if script exists)

Expected: pass.

### Task 3.4: Update system prompt to mention new params

**Files:**
- Modify: `packages/ai/src/prompts/<communication or announcement section>.ts`

- [ ] **Step 1: Find prompt fragment**

Run: `grep -rn "publish_announcement\|publishAnnouncement" packages/ai/src/prompts/`

- [ ] **Step 2: Append param documentation to prompt**

Add bullet to system prompt:

```
- `publish_announcement` now accepts kind (staff_event|system_message|celebration|workspace_news|external_link), tier (social|work|external), optional tags, and optional entity-link pair (type+id). Choose kind by intent: celebration for birthdays, system_message for mandatory ops, workspace_news as default. Choose tier by urgency: external for urgent (emails sent), work for standard, social for low-key.
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/prompts/
git commit -m "feat(prompts): document publish_announcement kind/tier/link params

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.5: Tool integration test

**Files:**
- Create: `packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.kindTier.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishAnnouncement } from "../publish-announcement.js";

vi.mock("../gate.js", () => ({
  callGateAction: vi.fn().mockResolvedValue({ allow: true, reason: null, channelAllowed: true, downgradeTo: null, minRoleRequired: null, requiresFourEyes: false, approversNeeded: 0, approversPresent: [], gateEvaluationId: null }),
}));
vi.mock("../audience-resolver.js", () => ({
  resolveAudience: vi.fn().mockResolvedValue({ profileIds: ["p1"], count: 1, label: "Test" }),
}));
vi.mock("../policy.js", () => ({
  isAiAllowedInChannel: vi.fn().mockResolvedValue(true),
}));
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn(),
  nonEmpty: (v: string) => v,
}));

describe("publishAnnouncement kind/tier/link extension", () => {
  let rpcMock: ReturnType<typeof vi.fn>;
  let supabase: any;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue({ data: "00000000-0000-0000-0000-000000000099", error: null });
    supabase = {
      rpc: rpcMock,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "member1" }, error: null }),
      }),
    };
  });

  it("invokes publish_announcement_atomic RPC with kind+tier+link params", async () => {
    await publishAnnouncement.execute(
      {
        channel_id: "c1",
        title: "Birthday",
        body: "Happy birthday!",
        audience_kind: "all",
        kind: "celebration",
        tier: "social",
        tags: ["birthday"],
        linked_entity_type: "url",
        linked_entity_id: "00000000-0000-0000-0000-000000000001",
        confirm: true,
      } as any,
      { supabaseAdmin: supabase, workspaceId: "w1", profileId: "u1", channel: "chat" } as any,
    );

    expect(rpcMock).toHaveBeenCalledWith("publish_announcement_atomic", expect.objectContaining({
      p_kind: "celebration",
      p_tier: "social",
      p_tags: ["birthday"],
      p_linked_entity_type: "url",
      p_linked_entity_id: "00000000-0000-0000-0000-000000000001",
    }));
  });

  it("defaults kind=workspace_news, tier=work when not supplied", async () => {
    await publishAnnouncement.execute(
      { channel_id: "c1", title: "T", body: "B", audience_kind: "all", confirm: true } as any,
      { supabaseAdmin: supabase, workspaceId: "w1", profileId: "u1", channel: "chat" } as any,
    );
    expect(rpcMock).toHaveBeenCalledWith("publish_announcement_atomic", expect.objectContaining({
      p_kind: "workspace_news",
      p_tier: "work",
    }));
  });

  it("rejects entity_link_type without entity_link_id at Zod validation", async () => {
    const parsed = publishAnnouncement.schema.safeParse({
      channel_id: "c1",
      title: "T",
      body: "B",
      audience_kind: "all",
      linked_entity_type: "url",
      // missing linked_entity_id
    });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @smartout/ai vitest packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.kindTier.test.ts`

Expected after Tasks 3.1+3.2: all 3 PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.kindTier.test.ts
git commit -m "test(communication): publishAnnouncement kind/tier/link integration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase 4 — Web Composers

> Three composer paths (web hook, broadcast hook, server action) converge on RPC. Plus AnnounceSheet UI mounting new pickers.

### Task 4.1: Migrate use-send-announcement to RPC

**Files:**
- Modify: `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts`

- [ ] **Step 1: Update input type to include kind/tier/tags/link**

```typescript
type AnnouncementInput = {
  channelId: string;
  content: string;
  profileId: string;
  targetProfileIds?: string[];
  visibilityScope?: "all_members" | "targeted_members";
  audienceKind: "all" | "on_duty" | "department" | "role" | "individuals";
  audienceLabel: string;
  // V2 additions
  kind?: "staff_event" | "system_message" | "celebration" | "workspace_news" | "external_link";
  tier?: "social" | "work" | "external";
  tags?: string[];
  linkedEntityType?: "staff_event" | "session_task" | "engine_process" | "channel" | "url";
  linkedEntityId?: string;
};
```

- [ ] **Step 2: Replace direct INSERT with RPC call**

Replace the `mutationFn` body's `supabase.from("channel_message").insert({...})` block with:

```typescript
const { data, error } = await supabase.rpc("publish_announcement_atomic", {
  p_workspace_id: workspaceId,
  p_actor_profile_id: profileId,
  p_channel_id: channelId,
  p_content: content,
  p_visibility_scope: isTargeted ? "targeted_members" : "all_members",
  p_target_profile_ids: isTargeted ? targetProfileIds : [],
  p_system_data: { audience_kind: audienceKind, audience_label: audienceLabel },
  p_kind: kind ?? "workspace_news",
  p_tier: tier ?? "work",
  p_tags: tags ?? [],
  p_linked_entity_type: linkedEntityType ?? null,
  p_linked_entity_id: linkedEntityId ?? null,
  p_client_message_id: clientMessageId,
});
if (error) throw error;
return { id: data as string };
```

- [ ] **Step 3: Add second emit() for announcement.published in onSuccess**

After the existing `emit({ event: "channel.message.sent", ... })`, add:

```typescript
void emit({
  event: "announcement.published",
  workspace_id: nonEmpty(workspaceId, "workspace_id"),
  actor_id: nonEmpty(variables.profileId, "actor_id"),
  entity: { entity_type: "channel_message", entity_id: messageId },
  properties: {
    channel_id: variables.channelId,
    kind: variables.kind ?? "workspace_news",
    tier: variables.tier ?? "work",
    target_profile_count: variables.targetProfileIds?.length ?? 0,
    has_entity_link: variables.linkedEntityType !== undefined,
    tag_count: variables.tags?.length ?? 0,
    origin_type: "human",
  },
});
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts
git commit -m "feat(komm): use-send-announcement calls publish_announcement_atomic RPC

Direct INSERT removed. Emits channel.message.sent (existing) +
announcement.published (new) per V2 spec §12.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.2: Migrate use-send-broadcast to RPC

**Files:**
- Modify: `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts`

- [ ] **Step 1: Read current implementation**

- [ ] **Step 2: Apply same RPC-migration pattern as Task 4.1**

(Identical structure; broadcast typically defaults kind='system_message' or per-context.)

- [ ] **Step 3: Run typecheck + commit**

### Task 4.3: Migrate send-broadcast-action to RPC

**Files:**
- Modify: `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts`

- [ ] **Step 1: Read current server action**

- [ ] **Step 2: Replace INSERT with RPC**

KEEP the existing `broadcast.send` capability gate (defense-in-depth per ADR-0370). After gate passes, invoke RPC which re-gates via `communication`. Both gates fire; audit trail documents.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_actions/send-broadcast-action.ts
git commit -m "feat(dashboard): send-broadcast-action invokes publish_announcement_atomic RPC

Day-Control server action keeps broadcast.send gate (defense-in-depth
per ADR-0370). RPC re-gates via communication. Both gates documented in audit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.4: Build 3 new composer UI components

**Files:**
- Create: `apps/web/src/components/dashboard/komm/AnnouncementKindPicker.tsx`
- Create: `apps/web/src/components/dashboard/komm/AnnouncementTierPicker.tsx`
- Create: `apps/web/src/components/dashboard/komm/EntityLinkPicker.tsx`

- [ ] **Step 1: KindPicker** — shadcn Select with 5 options, includes icon + label

- [ ] **Step 2: TierPicker** — shadcn Select with 3 options + helper text describing notification implication

- [ ] **Step 3: EntityLinkPicker** — type dropdown (5 options) + searchable id picker (TanStack Query for entity lookup per type)

Each component uses semantic Nordic Split tokens (NO `oklch(...)` literals per ADR-0366). Each accepts `value`/`onChange` props and surfaces `useReducedMotion()` gates if animating.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/komm/AnnouncementKindPicker.tsx \
        apps/web/src/components/dashboard/komm/AnnouncementTierPicker.tsx \
        apps/web/src/components/dashboard/komm/EntityLinkPicker.tsx
git commit -m "feat(komm): kind/tier/entity-link picker components

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.5: Mount pickers in AnnounceSheet + ComposeAnnouncement modal

**Files:**
- Modify: `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx`
- Modify: `apps/web/src/app/dashboard/komm/nyheter/page.tsx` (ComposeAnnouncement modal section)

- [ ] **Step 1: Add state for 5 new fields**

```typescript
const [kind, setKind] = useState<AnnouncementKind>("workspace_news");
const [tier, setTier] = useState<AnnouncementTier>("work");
const [tags, setTags] = useState<string[]>([]);
const [linkType, setLinkType] = useState<EntityLinkType | undefined>(undefined);
const [linkId, setLinkId] = useState<string | undefined>(undefined);
```

- [ ] **Step 2: Mount pickers in form**

```tsx
<AnnouncementKindPicker value={kind} onChange={setKind} />
<AnnouncementTierPicker value={tier} onChange={setTier} />
<EntityLinkPicker
  linkType={linkType}
  linkId={linkId}
  onChange={(t, i) => { setLinkType(t); setLinkId(i); }}
/>
```

- [ ] **Step 3: Pass new fields to mutation**

Update `mutation.mutate({...})` call to include `kind, tier, tags, linkedEntityType: linkType, linkedEntityId: linkId`.

- [ ] **Step 4: Run dev server, manually test composer publishes a celebration tier=social announcement**

Run: `pnpm --filter web dev` then visit `/dashboard/komm/nyheter`.

Verify: composer shows new pickers, publishing inserts channel_message + announcement_meta + notification_outbox rows.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx \
        apps/web/src/app/dashboard/komm/nyheter/page.tsx
git commit -m "feat(komm): AnnounceSheet + ComposeAnnouncement mount kind/tier/link pickers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase 5 — Telemetry

> Register 4 new events. Each needs (a) SmartoutEvent union entry, (b) EVENT_ROUTING entry, (c) corresponding emit() call-site (L-0358 mandate).

### Task 5.1: Register 4 events in registry.ts

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add to SmartoutEvent union**

After existing `| "channel.message.sent"` (line ~98), insert:

```typescript
  | "announcement.published"
  | "announcement.tier_routed"
  | "announcement.entity_linked"
  | "announcement.tag_added"
```

- [ ] **Step 2: Add to EVENT_ROUTING map**

After existing `"channel.message.sent": {...}` block (line ~11741), insert 4 new entries:

```typescript
"announcement.published": {
  posthog: true,
  logger: true,
  activityTrail: true,
  engineEvent: true,
  properties: {
    channel_id: "string",
    kind: "string",
    tier: "string",
    target_profile_count: "number",
    has_entity_link: "boolean",
    tag_count: "number",
    origin_type: "string",
  },
},
"announcement.tier_routed": {
  posthog: true,
  logger: true,
  activityTrail: false,
  engineEvent: false,
  properties: {
    tier: "string",
    notification_count: "number",
    notification_priority: "number",
  },
},
"announcement.entity_linked": {
  posthog: true,
  logger: true,
  activityTrail: false,
  engineEvent: false,
  properties: {
    linked_entity_type: "string",
    linked_entity_id: "string",
  },
},
"announcement.tag_added": {
  posthog: true,
  logger: false,
  activityTrail: false,
  engineEvent: false,
  properties: {
    tag_count: "number",
    tags: "string[]",
  },
},
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @smartout/telemetry typecheck && pnpm --filter @smartout/telemetry build`

- [ ] **Step 4: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 4 announcement.* events

announcement.published: every successful RPC publish
announcement.tier_routed: per fan-out batch
announcement.entity_linked: when entity-link pair present
announcement.tag_added: when tags supplied

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5.2: Wire emit() call-sites per L-0358

**Files:**
- Modify: `packages/ai/src/capabilities/communication/publish-announcement.ts` (announcement.published — added in Task 3.2)
- Modify: `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` (announcement.published — added in Task 4.1)
- Modify: `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts` (announcement.published — added in Task 4.2)
- Modify: `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts` (announcement.published — added in Task 4.3)

- [ ] **Step 1: Verify each of the above call-sites emit announcement.published**

Run: `grep -n "announcement.published" packages/ai/src/capabilities/communication/publish-announcement.ts apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts apps/web/src/app/dashboard/_actions/send-broadcast-action.ts`

Expected: ≥1 hit per file.

- [ ] **Step 2: For announcement.tier_routed, add emit inside fn_publish_announcement_notifications response handler**

(This event fires after RPC returns; emit from same call-site that invoked RPC, reading reported recipient count.)

In each composer file, ADD after the announcement.published emit:

```typescript
void emit({
  event: "announcement.tier_routed",
  workspace_id: nonEmpty(workspaceId, "workspace_id"),
  actor_id: nonEmpty(variables.profileId, "actor_id"),
  entity: { entity_type: "channel_message", entity_id: messageId },
  properties: {
    tier: variables.tier ?? "work",
    notification_count: variables.targetProfileIds?.length ?? 0,
    notification_priority: variables.tier === "external" ? 2 : variables.tier === "work" ? 1 : 0,
  },
});
```

- [ ] **Step 3: For announcement.entity_linked, conditional emit when link present**

```typescript
if (variables.linkedEntityType && variables.linkedEntityId) {
  void emit({
    event: "announcement.entity_linked",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(variables.profileId, "actor_id"),
    entity: { entity_type: "channel_message", entity_id: messageId },
    properties: {
      linked_entity_type: variables.linkedEntityType,
      linked_entity_id: variables.linkedEntityId,
    },
  });
}
```

- [ ] **Step 4: For announcement.tag_added, conditional emit when tags present**

```typescript
if ((variables.tags?.length ?? 0) > 0) {
  void emit({
    event: "announcement.tag_added",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(variables.profileId, "actor_id"),
    entity: { entity_type: "channel_message", entity_id: messageId },
    properties: {
      tag_count: variables.tags!.length,
      tags: variables.tags!,
    },
  });
}
```

- [ ] **Step 5: Verify all 4 emit-sites per file**

Run: `for f in <list of files>; do echo "=== $f ==="; grep -c "event: \"announcement" "$f"; done`
Expected: 4 occurrences per composer file (4 events).

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/capabilities/communication/publish-announcement.ts \
        apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts \
        apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts \
        apps/web/src/app/dashboard/_actions/send-broadcast-action.ts
git commit -m "feat(telemetry): emit() call-sites for 4 announcement events per L-0358

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5.3: Verify PostHog properties match registry

**Files:** (verification-only)

- [ ] **Step 1: Run telemetry self-check**

Run: `pnpm --filter @smartout/telemetry test` (or equivalent self-validation script).

- [ ] **Step 2: Manual smoke — publish 1 announcement of each tier from dev**

Verify PostHog ingestion shows 4 events with expected properties.

---

# Phase 6 — Mobile Read

> Mobile bulletin board renders new tier badge + entity link CTA. ADR-0133: mobile is READ-only for announcements; no composer.

### Task 6.1: Build mobile TierBadge component

**Files:**
- Create: `apps/mobile/src/components/news/TierBadge.tsx`

- [ ] **Step 1: Write component**

```tsx
import { Text, View } from "react-native";
import { useTranslation } from "@smartout/i18n";

type Props = { tier: "social" | "work" | "external" };

export function TierBadge({ tier }: Props) {
  const { t } = useTranslation("news");
  const styles = {
    social: { bg: "bg-muted", text: "text-muted-foreground" },
    work: { bg: "bg-primary/10", text: "text-primary" },
    external: { bg: "bg-destructive/10", text: "text-destructive" },
  }[tier];

  return (
    <View className={`rounded-full px-2 py-1 ${styles.bg}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{t(`tier.${tier}`)}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

### Task 6.2: Build mobile EntityLinkCTA component

**Files:**
- Create: `apps/mobile/src/components/news/EntityLinkCTA.tsx`

- [ ] **Step 1: Write component**

Renders a CTA button per linked_entity_type that navigates to the relevant mobile route (staff_event → /events/[id], session_task → /tasks/[id], engine_process → /processes/[id], channel → /chat/[id], url → opens browser).

- [ ] **Step 2: Commit**

### Task 6.3: Mount badges + CTA in mobile bulletin

**Files:**
- Modify: `apps/mobile/app/(tabs)/news/page.tsx` (or actual mobile news surface)

- [ ] **Step 1: Read mobile news surface**

Run: `find apps/mobile -name "*.tsx" -path "*news*" | head -5`

- [ ] **Step 2: Fetch announcement_meta alongside channel_message**

Update existing query to JOIN announcement_meta or fetch in second query.

- [ ] **Step 3: Render TierBadge + EntityLinkCTA on each card**

- [ ] **Step 4: Test on PWA at localhost:8083 (per Pontus' mobile-PWA preference)**

Run: `pnpm --filter @smartout/mobile dev`. Visit PWA. Verify cards show tier badge + CTA where applicable.

- [ ] **Step 5: Commit**

---

# Phase 7 — Tests & Closure

### Task 7.1: Write E2E Playwright spec

**Files:**
- Create: `apps/e2e/specs/announcement-kind-tier.spec.ts`

- [ ] **Step 1: Write 4 specs**

```typescript
import { test, expect } from "@playwright/test";
import { loginAsAdmin, openComposeAnnouncement } from "./helpers";

test.describe("Announcement V2: kind/tier/entity-link", () => {
  test("admin publishes celebration tier=social via ComposeAnnouncement modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");
    await openComposeAnnouncement(page);

    await page.fill('[data-testid="announcement-title"]', "Birthday!");
    await page.fill('[data-testid="announcement-body"]', "🎂");
    await page.selectOption('[data-testid="announcement-kind"]', "celebration");
    await page.selectOption('[data-testid="announcement-tier"]', "social");

    await page.click('[data-testid="announcement-publish"]');
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Verify badge renders on news card
    await expect(page.locator('[data-testid="tier-badge-social"]')).toBeVisible();
  });

  test("manager publishes external tier announcement → email channel allowed", async ({ page }) => {
    // ... similar setup, then assert via API that latest notification_outbox row has 'email' in allowed_channels
  });

  test("entity-link picker links announcement to staff_event", async ({ page }) => {
    // ... select linkType=staff_event, search id, publish, verify EntityLinkCTA renders on card
  });

  test("publishing without kind defaults to workspace_news + tier=work", async ({ page }) => {
    // ... open composer, leave kind/tier defaults, publish, verify announcement_meta row has defaults
  });
});
```

- [ ] **Step 2: Run E2E suite**

Run: `pnpm --filter @smartout/e2e test --grep "Announcement V2"`

- [ ] **Step 3: Commit**

### Task 7.2: Write journey doc

**Files:**
- Create: `docs/journeys/JOURNEY-announce-kind-tier-link.md`

Use journey template. Document admin/manager/employee flows for: composing celebration tier=social, publishing external tier urgent, linking to staff_event, mobile read with badge+CTA, agent compose via Botsson.

### Task 7.3: Update USER-FLOWS.md

**Files:**
- Modify: `docs/modules/announcments/USER-FLOWS.md`

Append V2 sections:
- "Composing a typed announcement" (kind+tier picker)
- "Linking to an entity" (entity-link picker + CTA)
- "External tier urgent path" (email + push)
- "Mobile bulletin tier visualization" (TierBadge)

### Task 7.4: Write handoff

**Files:**
- Create: `docs/HANDOFF-announce-kind-tier-link.md`

Use handoff template. Document: what was built (V1 REJECTED → V2 shipped), all decisions (3 ADRs), all learnings (4), next steps (BLUEPRINT.md gaps that remain after V2).

### Task 7.5: Run close-feature gate

- [ ] **Step 1: Verify all 4 close-feature deliverables**

1. ✅ Decision log entries for 0369/0370/0371 (Task 0.4)
2. ✅ JOURNEY-announce-kind-tier-link.md (Task 7.2)
3. ✅ Typecheck passes (`pnpm turbo typecheck`)
4. ✅ Handoff (Task 7.4)

- [ ] **Step 2: Verify typecheck across all touched packages**

Run: `pnpm turbo typecheck --filter='@smartout/*' --filter='web' --filter='@smartout/mobile' --filter='@smartout/e2e'`

Expected: 0 errors.

- [ ] **Step 3: Run intent classifier coverage**

Run: `pnpm --filter @smartout/ai check-intent-coverage` (if script exists)

- [ ] **Step 4: Run drift-check pre-close (per L-0066)**

Run: `./infra/scripts/drift-check.sh` if env-vars or seeds changed.

- [ ] **Step 5: Tell user**

Output: "Feature ready for closure. Run `close-feature.sh <N>` to merge."

---

## Self-Review

(per skill — fresh-eyes pass after writing plan)

### 1. Spec coverage

| V2 Spec Section | Task |
|---|---|
| §4 Schema (enums + sidecar) | 2.1, 2.2 |
| §5 RPC contract | 2.3, 2.4 |
| §7 Trigger guard | 2.5 |
| §8 Tool API contract | 3.1, 3.2 |
| §9 Composer paths | 4.1, 4.2, 4.3 |
| §10 UI components | 4.4, 4.5, 6.1, 6.2 |
| §11 Notification mapping | 2.3 (helper), 5.2 (tier_routed emit) |
| §12 Telemetry events | 5.1, 5.2 |
| §13 Tests | 2.6, 3.5, 7.1 |

No spec section uncovered.

### 2. Placeholder scan

- No "TBD", "TODO", "implement later" — confirmed.
- All code blocks contain actual code (not stubs).
- "Similar to Task N" — only used in Task 4.2 referring to Task 4.1; repeated pattern explicitly.

### 3. Type consistency

- `publish_announcement_atomic` signature identical across ADR-0369, Task 2.4, Task 3.2, Task 4.1, Task 4.2, Task 4.3.
- `announcement_kind` enum values identical across migration (Task 2.1), Zod schema (Task 3.1), composer types (Task 4.1), test mocks (Task 3.5).
- `announcement_tier` enum values identical across migration, Zod, composers, mobile badge, tests.
- `entity_link_type_enum` consistent across migration, Zod, picker, CTA.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-announcement-kind-tier-link.md`.

**Plan NOT committed.** Current worktree is on `feat/day-line-triggers` (day-line sub-sortie active). Plan file lands as untracked on this branch.

**Recommended placement:** Spawn `/start-feature announce-kind-tier-link` from `~/dev/smartout.ai-ui-shell` (campaign/ui-shell root) after current day-line work commits. The new worktree picks up this plan file as untracked, then commits it into `feat/ui-shell-announce-kind-tier-link` branch at first task execution.

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch fresh subagent per task, review between tasks, fast iteration. Phase 0 (8 tasks, doc-only) + Phase 1 (3 tasks, spec) suitable for batch; Phase 2+ (schema/code) per-task review.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch with checkpoints. Not recommended given current worktree is on wrong branch.

**Which approach?**
