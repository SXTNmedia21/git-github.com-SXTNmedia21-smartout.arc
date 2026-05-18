---
title: Announcement Kind, Tier & Entity-Link Design
status: rejected-pending-rework
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [spec, announcements, schema, kind, tier, link, channel-message, notification, council-rejected]
council_verdict: REJECT (2026-05-18 — chair self-reversal precedent #10 per L-0294)
blockers: [B1-atomicity-SET-CONSTRAINTS-no-op, B2-capability-key-broadcast-vs-communication, B3-callGateAction-signature-phantom, B4-schema-breaking-content-collapse, B5-telemetry-registry-not-extended, B6-in_app-enum-value-dropped]
must_fix: [M1-RLS-namespace, M2-EXCEPTION-handler, M3-dynamic-notification-priority, M4-elevated-mode-stale-ref, M5-intent-classifier-co-update, M6-NyheterClient-JOIN, M7-CSS-vars-tier]
derived_adrs: [ADR-0369-atomicity, ADR-0370-capability-boundary, ADR-0371-content-migration]
derived_learnings: [L-0312-SET-CONSTRAINTS, L-0313-ALTER-TYPE-grep, L-0314-capability-drift, L-0315-callGateAction-signature]
---

# Announcement Kind, Tier & Entity-Link Design

> **⚠️ STATUS: REJECTED 2026-05-18.** Council verdict at `docs/council/COUNCIL-LOG.md` entry of 2026-05-18 surfaced 6 blockers + 7 must-fixes. Trust Gate 8/8 FAIL. Three ADRs (0369/0370/0371) and four learnings (0312-0315) derived from the review. Spec must be re-drafted with atomicity mechanism + capability boundary + schema contract resolved before re-submission to council.

> **Re-draft prerequisites:**
> - Decide atomicity mechanism per ADR-0369 (recommend Option B — RPC-body fan-out)
> - Decide capability boundary per ADR-0370 (recommend Option B — extend `communication`)
> - Decide schema breaking-change posture per ADR-0371 (recommend Option A — no collapse, keep `{title, body}`)
> - Rewrite §8 pseudocode against real `callGateAction(supabase, workspaceId, profileId, args)` signature
> - Restore §6 trigger's `EXCEPTION WHEN OTHERS THEN RETURN NEW`, `is_muted` filter, sender exclusion, and `in_app` channel
> - Add telemetry registry extension §12.4 (interface + new event registration)
> - Add NyheterClient sidecar JOIN to §11
> - Declare CSS variables `--tier-social/--tier-work/--tier-external` before component work (ADR-0361)
> - Remove §16 reference to `mode='elevated'`
> - Lock intent-classifier same-commit update per L-0292/ADR-0112

> Design spec for closing gaps §3.1 (sub-kind discrimination), §3.2 (entity-link mechanism), and §3.3 (tier classification) from [`docs/modules/announcments/GAPS-AND-DEBT.md`](../../modules/announcments/GAPS-AND-DEBT.md). Variant V1 — Pragmatic Sidecar. Approved 2026-05-18.

## 1. Problem Statement

The Announcements module today treats every announcement as an undifferentiated `channel_message` with `message_type='announcement'`. Operators cannot classify what kind of announcement they are publishing (new menu, new hire, personaltreff, schedule change, policy update, general note, external message), cannot link the announcement to the entity it concerns (the staff_event being announced, the shift being changed, the policy being updated), and cannot tier the announcement to drive different notification priorities (social vs work vs external).

The notification trigger branches only on `message_type='announcement'`, hardcoding every announcement to `priority=1, mode='work'`. A personalfest announcement competes with a critical schedule change for the same notification weight. UI is visually homogeneous; readers cannot distinguish kinds at a glance.

Three coupled gaps need a single coordinated design because they share the same write-path (announcement composer), the same read-path (bulletin board / mobile feed / agent surface), and the same RLS boundary.

## 2. Decision Drivers

- Operators want to differentiate kinds in the composer and have the system pick sensible defaults per kind.
- The `personaltreff` use-case requires linking an announcement to a `staff_event` row that holds RSVP state (today disconnected).
- Notification priority must vary by announcement intent — push fatigue on social-tier announcements drives opt-outs that miss work-tier announcements.
- Schema changes to `channel_message` are cross-module changes per `MODULE_ANNOUNCEMENTS.md §ARCHITECTURE`. Sidecar table avoids cross-module coordination.
- Existing Wave A composer (`NyheterClient.tsx`) must continue working unchanged for users mid-publish.
- Mobile is read-only per ADR-0133 — no mobile composer.
- Agent tool `publish_announcement` must learn the new fields without breaking voice-rejected pattern (ADR-0078).
- Telemetry registry already requires emit-call-sites per ADR-0358 — new fields land in `channel.message.sent` properties, no new event for the publish path.

## 3. Locked Architectural Choices

| Axis | Choice | Rationale |
|---|---|---|
| Sub-kind representation | **Hybrid** — fixed enum `announcement_kind` + freeform `tags text[]` | Backbone enum gives UI + agent + default-derivation. Tags give workspace customization. |
| Tier behaviour | **Drives notification priority AND UI** | Trigger reads tier; UI applies tier-styling. Operator can override default per announcement. |
| Entity-link shape | **Single nullable polymorphic pair** on sidecar | `linked_entity_type` enum + `linked_entity_id uuid`. 0 or 1 link. Pattern matches telemetry/activity_trail polymorphism. |
| Schema home | **Sidecar `announcement_meta`** 1:1 with `channel_message` | Keeps `channel_message` generic. Sidecar holds NOT-NULL kind+tier. No cross-module schema change. |
| Variant | **V1 Pragmatic** — single sidecar + tags as text[] | Additive. Upgradeable to V2 (tag-junction) or V3 (kind-config) as needed without breaking V1. |

## 4. Schema

### 4.1 Enums

```sql
CREATE TYPE announcement_kind AS ENUM (
  'general',
  'new_menu',
  'new_hire',
  'staff_event',
  'schedule_change',
  'policy_update',
  'external'
);

CREATE TYPE announcement_tier AS ENUM (
  'social',
  'work',
  'external'
);

CREATE TYPE announcement_link_type AS ENUM (
  'staff_event',
  'schedule_shift',
  'policy',
  'protocol',
  'profile',
  'menu_document',
  'external_url'
);
```

**Note on `channel_message_visibility`:** Existing enum (`supabase/migrations/20260422300000_channel_communications.sql:44-46`) carries three values — `all_members`, `admins`, `targeted_members`. V1 composer paths use only `all_members` and `targeted_members`; the `admins` value remains in the enum for non-announcement message types (e.g. system handoffs) and is out of scope for this design. The RPC `p_visibility_scope` parameter accepts all three values for forward-compat but composer UI does not expose `admins`.

**Note on `notification_mode` + `notification_channel` enums (verified against `supabase/migrations/00006_notification_engine.sql`):**

- `notification_mode` enum values: `training`, `work`, `community`. **No `social` or `elevated` values exist.** Adding values is a cross-module change to the notifications module and is out of scope for V1.
- `notification_channel` enum values: `push`, `sms`, `email`, `voice`. **No `in_app` value.** In-app rendering is surface-side concern (Expo + web push handler render in-app from the same row); the channel array drives external delivery targets only.

**Tier → notification mapping (V1, uses only existing enum values):**

| Announcement tier | `notification_mode` (existing enum) | `priority` (smallint 0/1/2) | `allowed_channels` (notification_channel[]) |
|---|---|---|---|
| `social`    | `community` | 0 | `{push}`               |
| `work`      | `work`      | 1 | `{push}`               |
| `external`  | `work`      | 2 | `{push, email}`        |

`external` tier reuses `work` mode (no `elevated` enum value); its distinctness comes from `priority=2` (urgent) plus the broader `allowed_channels` (email added). The notifications-consumer can decide whether to escalate UI treatment based on `priority`. Future cross-module sortie can add an `elevated` or `urgent` enum value if the existing priority gradient proves insufficient — tracked as a notifications-module follow-up, not blocking V1.

### 4.2 Sidecar table

```sql
CREATE TABLE public.announcement_meta (
  message_id          uuid PRIMARY KEY
                       REFERENCES public.channel_message(id) ON DELETE CASCADE,
  workspace_id        uuid NOT NULL
                       REFERENCES public.workspace(workspace_id),
  kind                announcement_kind NOT NULL,
  tier                announcement_tier NOT NULL DEFAULT 'work',
  tags                text[] NOT NULL DEFAULT '{}',
  linked_entity_type  announcement_link_type,
  linked_entity_id    uuid,
  tier_overridden     boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meta_kind_link_consistent CHECK (
    CASE kind
      WHEN 'general'         THEN linked_entity_type IS NULL
      WHEN 'staff_event'     THEN linked_entity_type IS NULL OR linked_entity_type = 'staff_event'
      WHEN 'new_hire'        THEN linked_entity_type IS NULL OR linked_entity_type = 'profile'
      WHEN 'policy_update'   THEN linked_entity_type = 'policy'
      WHEN 'schedule_change' THEN linked_entity_type IS NULL OR linked_entity_type = 'schedule_shift'
      WHEN 'new_menu'        THEN linked_entity_type IS NULL OR linked_entity_type IN ('menu_document', 'external_url')
      WHEN 'external'        THEN linked_entity_type IS NULL OR linked_entity_type = 'external_url'
      ELSE false
    END
  ),

  CONSTRAINT meta_link_pair_consistent CHECK (
    (linked_entity_type IS NULL AND linked_entity_id IS NULL) OR
    (linked_entity_type IS NOT NULL AND linked_entity_id IS NOT NULL)
  )
);

CREATE INDEX idx_meta_workspace_kind  ON public.announcement_meta (workspace_id, kind);
CREATE INDEX idx_meta_workspace_tier  ON public.announcement_meta (workspace_id, tier);
CREATE INDEX idx_meta_tags_gin        ON public.announcement_meta USING GIN (tags);
CREATE INDEX idx_meta_link            ON public.announcement_meta (linked_entity_type, linked_entity_id)
                                       WHERE linked_entity_id IS NOT NULL;
```

### 4.3 Per-kind defaults (composer-side)

```ts
const DEFAULT_TIER_FOR_KIND: Record<AnnouncementKind, AnnouncementTier> = {
  general:         'work',
  new_menu:        'work',
  new_hire:        'social',
  staff_event:     'social',
  schedule_change: 'work',
  policy_update:   'work',
  external:        'external',
};

const DEFAULT_AUDIENCE_FOR_KIND: Record<AnnouncementKind, AudienceKind> = {
  general:         'all',
  new_menu:        'all',
  new_hire:        'all',
  staff_event:     'all',
  schedule_change: 'on_duty',
  policy_update:   'all',
  external:        'all',
};

const LINK_REQUIRED_FOR_KIND: Record<AnnouncementKind, boolean> = {
  general:         false,
  new_menu:        false,
  new_hire:        false,
  staff_event:     false,  // strongly recommended but not enforced
  schedule_change: false,
  policy_update:   true,   // CHECK constraint enforces at DB
  external:        false,
};

const LINK_TYPES_FOR_KIND: Record<AnnouncementKind, AnnouncementLinkType[]> = {
  general:         [],
  new_menu:        ['menu_document', 'external_url'],
  new_hire:        ['profile'],
  staff_event:     ['staff_event'],
  schedule_change: ['schedule_shift'],
  policy_update:   ['policy'],
  external:        ['external_url'],
};
```

These tables live in `packages/ai/src/capabilities/communication/constants.ts` and are imported by both the web composer and the agent capability.

## 5. Atomic Publish RPC

The composer mutation writes two rows in one transaction: `channel_message` + `announcement_meta`. A SECURITY DEFINER RPC enforces atomicity and avoids race-conditions in the notification trigger.

### 5.0 Prerequisite — new helper `is_manager_in_workspace` (Migration M0)

Codebase today ships only `public.is_admin_in_workspace(uid, wid)` (`supabase/migrations/00004_rls_policies.sql:33`). The atomic RPC needs a `manager+` predicate (manager OR admin OR owner). A new helper is added as part of **M0** (prerequisite migration, sequenced before M1):

```sql
CREATE OR REPLACE FUNCTION public.is_manager_in_workspace(uid uuid, wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE profile.user_id = uid
      AND profile.workspace_id = wid
      AND profile.role IN ('manager', 'admin', 'owner')
      AND profile.status IN ('active', 'trainee')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_manager_in_workspace(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_manager_in_workspace(uuid, uuid) TO authenticated, service_role;
```

Pattern matches `is_admin_in_workspace` shape (same signature + same `revoke from anon` hardening per `supabase/migrations/20260524000000_revoke_anon_security_definer_hardening.sql:107`). Profile column names (`user_id`, `workspace_id`, `role`, `status`) verified against `packages/supabase/src/database.types.ts` — adjust during implementation if helper integration test reveals different column names.

### 5.1 The RPC

```sql
CREATE OR REPLACE FUNCTION public.publish_announcement_atomic(
  p_channel_id          uuid,
  p_workspace_id        uuid,
  p_sender_id           uuid,
  p_content             text,
  p_kind                announcement_kind,
  p_tier                announcement_tier,
  p_tags                text[] DEFAULT '{}',
  p_linked_entity_type  announcement_link_type DEFAULT NULL,
  p_linked_entity_id    uuid DEFAULT NULL,
  p_audience_kind       text DEFAULT 'all',
  p_audience_label      text DEFAULT 'Hele teamet',
  p_target_profile_ids  uuid[] DEFAULT NULL,
  p_visibility_scope    channel_message_visibility DEFAULT 'all_members',
  p_client_message_id   uuid DEFAULT gen_random_uuid(),
  p_tier_overridden     boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id      uuid;
  v_is_service_role boolean;
BEGIN
  -- Detect service-role invocation via Supabase JWT claim convention.
  -- No is_service_role() helper exists in codebase; this is the standard
  -- inline pattern used by other SECURITY DEFINER functions.
  v_is_service_role := COALESCE(
    current_setting('request.jwt.claim.role', true) = 'service_role',
    false
  );

  IF NOT public.is_manager_in_workspace(p_sender_id, p_workspace_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED — sender must be manager+ in workspace';
  END IF;

  -- Anti-spoof: in user-JWT context, sender_id must equal auth.uid().
  -- Service-role bypass exists for server actions that pass an actor's
  -- profile_id resolved server-side per ADR-0151.
  IF NOT v_is_service_role AND p_sender_id <> auth.uid() THEN
    RAISE EXCEPTION 'IDENTITY_MISMATCH — sender_id must equal auth.uid() in user context';
  END IF;

  SET CONSTRAINTS ALL DEFERRED;

  INSERT INTO public.channel_message (
    channel_id, workspace_id, sender_id, content, message_type,
    visibility_scope, target_profile_ids, system_data, client_message_id
  ) VALUES (
    p_channel_id, p_workspace_id, p_sender_id, p_content, 'announcement',
    p_visibility_scope, p_target_profile_ids,
    jsonb_build_object(
      'audience_kind', p_audience_kind,
      'audience_label', p_audience_label
    ),
    p_client_message_id
  )
  RETURNING id INTO v_message_id;

  INSERT INTO public.announcement_meta (
    message_id, workspace_id, kind, tier, tags,
    linked_entity_type, linked_entity_id, tier_overridden
  ) VALUES (
    v_message_id, p_workspace_id, p_kind, p_tier, p_tags,
    p_linked_entity_type, p_linked_entity_id, p_tier_overridden
  );

  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic TO authenticated, service_role;
```

`SET CONSTRAINTS ALL DEFERRED` ensures the notification trigger fires at commit-time when `announcement_meta` already exists.

## 6. Notification Trigger Refactor

`trigger_channel_message_notification()` updated to read `tier` from sidecar:

```sql
CREATE OR REPLACE FUNCTION public.trigger_channel_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier         announcement_tier;
  v_priority     int;
  v_mode         text;
  v_event_key    text;
BEGIN
  IF NEW.message_type IN ('system', 'brief', 'handoff', 'summary') THEN
    RETURN NEW;
  END IF;

  IF NEW.message_type = 'announcement' THEN
    SELECT am.tier INTO v_tier
    FROM public.announcement_meta am
    WHERE am.message_id = NEW.id;

    v_tier := COALESCE(v_tier, 'work');

    -- Tier → (notification_mode, priority) per §4.1 mapping table.
    -- Uses existing notification_mode enum values only (training/work/community).
    -- external-tier maps to work-mode with priority=2 + email channel added.
    CASE v_tier
      WHEN 'social'   THEN v_priority := 0; v_mode := 'community';
      WHEN 'work'     THEN v_priority := 1; v_mode := 'work';
      WHEN 'external' THEN v_priority := 2; v_mode := 'work';
    END CASE;

    v_event_key := 'announcement.published';
  ELSE
    v_priority := 0; v_mode := 'community'; v_event_key := 'message.received';
  END IF;

  -- Fan-out targets real notification_outbox shape per
  -- supabase/migrations/00006_notification_engine.sql. Real columns are:
  --   id (bigserial), workspace_id, recipient_id (NOT recipient_profile_id),
  --   mode (notification_mode enum), priority (smallint 0/1/2),
  --   title (text NOT NULL), body (text NOT NULL), action_url (text),
  --   metadata (jsonb), allowed_channels (notification_channel[]),
  --   status (notification_status), scheduled_for, processed_at, created_at.
  -- No top-level event_key / entity_type / entity_id columns exist;
  -- these go into metadata jsonb per existing trigger convention.
  -- title + body are derived from NEW.content (truncate body to 500 chars).
  INSERT INTO public.notification_outbox (
    workspace_id, recipient_id, mode, priority,
    title, body, action_url, metadata,
    allowed_channels
  )
  SELECT
    NEW.workspace_id,
    cmem.profile_id,
    v_mode::notification_mode,
    v_priority,
    COALESCE(
      LEFT(SPLIT_PART(NEW.content, E'\n', 1), 140),
      'Kunngjøring'
    ),
    LEFT(NEW.content, 500),
    '/dashboard/komm/nyheter#m-' || NEW.id::text,
    jsonb_build_object(
      'event_key', v_event_key,
      'entity_type', 'channel_message',
      'entity_id', NEW.id,
      'channel_id', NEW.channel_id,
      'announcement_tier', v_tier
    ),
    CASE v_tier
      WHEN 'social'   THEN ARRAY['push']::notification_channel[]
      WHEN 'work'     THEN ARRAY['push']::notification_channel[]
      WHEN 'external' THEN ARRAY['push','email']::notification_channel[]
    END
  FROM public.channel_member cmem
  WHERE cmem.channel_id = NEW.channel_id
    AND cmem.left_at IS NULL
    AND (
      NEW.visibility_scope = 'all_members'
      OR NEW.target_profile_ids @> ARRAY[cmem.profile_id]
    );

  RETURN NEW;
END;
$$;
```

Behaviour delta:
- Existing `(priority=1, mode='work')` behaviour preserved for any announcement without a sidecar row (via `COALESCE` fallback). Backfill (§7.2) ensures all existing rows have sidecar.
- New social-tier announcements deliver as community-mode (respects quiet hours).
- New external-tier announcements deliver as work-mode with `priority=2` + `allowed_channels` including `email` (no `elevated` mode value exists today — distinction comes from priority gradient + channel breadth).

## 7. Migration Sequence

**Apply order is strict** — M5 depends on `announcement_meta` existing (M1) and on backfill having populated existing rows (M2). M3, M4 depend on M1. M4 additionally depends on M0 (helper function).

### 7.0 M0 — Helper function `is_manager_in_workspace`

File: `supabase/migrations/<ts>_is_manager_in_workspace_helper.sql`
Adds: `is_manager_in_workspace(uid, wid)` SECURITY DEFINER + anon revoke + authenticated/service_role grant. See §5.0 for the body.

Standalone migration so the helper is reusable by future capabilities outside this module.

### 7.1 M1 — Schema

File: `supabase/migrations/<ts>_announcement_meta_schema.sql`
Adds: enums, `announcement_meta` table, indexes, CHECK constraints.

### 7.2 M2 — Backfill

File: `supabase/migrations/<ts>_announcement_meta_backfill.sql`

```sql
INSERT INTO public.announcement_meta (message_id, workspace_id, kind, tier)
SELECT id, workspace_id, 'general'::announcement_kind, 'work'::announcement_tier
FROM public.channel_message
WHERE message_type = 'announcement'
ON CONFLICT (message_id) DO NOTHING;
```

All existing announcement rows get `kind='general', tier='work'` — matches current notification behaviour exactly.

### 7.3 M3 — RLS

File: `supabase/migrations/<ts>_announcement_meta_rls.sql`
Adds: `meta_jwt_select`, `meta_jwt_update`, `meta_api_select` policies. No JWT-INSERT policy (writes must go through atomic RPC).

### 7.4 M4 — Atomic RPC

File: `supabase/migrations/<ts>_publish_announcement_atomic.sql`
Adds: `publish_announcement_atomic()` SECURITY DEFINER function. Grants execute to authenticated + service_role.

### 7.5 M5 — Notification trigger refactor

File: `supabase/migrations/<ts>_announcement_notification_tier_aware.sql`
Replaces `trigger_channel_message_notification()` with tier-aware version. `COALESCE` fallback to `'work'` guards any race or missing-sidecar edge case.

## 8. Capability Tool Update

`packages/ai/src/capabilities/communication/publish-announcement.ts`:

```ts
const PublishAnnouncementInput = z.object({
  // existing
  content: z.string().min(1).max(800),
  audience_kind: AudienceKindSchema,
  audience_label: z.string(),
  target_profile_ids: z.array(z.string().uuid()).optional(),
  visibility_scope: z.enum(['all_members', 'targeted_members']).default('all_members'),
  confirm: z.boolean().default(false),

  // NEW
  kind: AnnouncementKindSchema.default('general'),
  tier: AnnouncementTierSchema.optional(),
  tags: z.array(z.string()).default([]),
  linked_entity_type: AnnouncementLinkTypeSchema.optional(),
  linked_entity_id: z.string().uuid().optional(),
});

// In handler:
const tierResolved = input.tier ?? DEFAULT_TIER_FOR_KIND[input.kind];
const tierOverridden = input.tier != null && input.tier !== DEFAULT_TIER_FOR_KIND[input.kind];

if (!input.confirm) {
  return {
    draft: { content: input.content, kind: input.kind, tier: tierResolved },
    audience_preview: await resolveAudience(...),
    link_preview: await resolveLink(input.linked_entity_type, input.linked_entity_id),
  };
}

return await callGateAction({
  capability: 'broadcast.send',
  channel: 'chat',  // ADR-0078 — voice rejected upstream
  workspace_id, profile_id,
  action: async () => {
    return await supabase.rpc('publish_announcement_atomic', { /* full payload */ });
  },
});
```

Voice-channel rejection remains at the tool-router boundary (unchanged).

## 9. Composer Path Harmonization

All four operator composers refactor to use `publish_announcement_atomic`:

| Composer | Refactor |
|---|---|
| `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` | Replace direct `INSERT` with `supabase.rpc('publish_announcement_atomic', ...)`. Add kind/tier/tags/link to input. |
| `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts` | Resolve-or-create `news` channel unchanged. Replace direct `INSERT` with RPC. |
| `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts` | Keep `gate_action` guard. Replace service-role `INSERT` with `supabase.rpc(...)` via service-role client. `system_data.broadcast_type` + `session_id` preserved; new kind/tier passed to RPC. |
| `packages/ai/src/capabilities/communication/publish-announcement.ts` | Replace direct INSERT with RPC inside `callGateAction`. |

Closes §3.9 (direct mutations not gated) as a by-product — RPC's `is_manager_in_workspace` check provides uniform gating.

## 10. Composer UX Spec

### 10.1 New top-of-form fields (above existing audience picker)

```
┌─ Ny kunngjøring ─────────────────────────────────────┐
│                                                       │
│  Type:    [▼ General      ▼]      Tier: [● Work ○ Social ○ External]
│           (kind picker)            (auto-from-kind; operator can override)
│                                                       │
│  Tittel:  [_____________________________________]    │
│  Melding: [_____________________________________]    │
│                                                       │
│  Kobling: [conditional picker based on kind]         │
│                                                       │
│  Tags:    [+ ny-meny] [+ vin]  [_____________]       │
│                                                       │
│  Målgruppe: [existing Wave A picker — unchanged]      │
│                                                       │
│  📊 Recipient count pill (existing)                  │
│  🔔 Tier-driven notification preview line             │
│                                                       │
│  [Avbryt]                            [Publiser]      │
└───────────────────────────────────────────────────────┘
```

### 10.2 Kind change handler

```ts
function onKindChange(newKind: AnnouncementKind) {
  setKind(newKind);
  if (!tierOverridden) {
    setTier(DEFAULT_TIER_FOR_KIND[newKind]);
  }
  if (!audienceManuallySet) {
    setAudience(DEFAULT_AUDIENCE_FOR_KIND[newKind]);
  }
  setLinkPickerVariant(LINK_TYPES_FOR_KIND[newKind]);
}

function onTierChange(newTier: AnnouncementTier) {
  setTier(newTier);
  setTierOverridden(newTier !== DEFAULT_TIER_FOR_KIND[kind]);
}
```

### 10.3 Tier-driven notification preview

```ts
const notificationPreview = {
  social: {
    icon: BellOff,
    label: 'Push leveres stille',
    detail: 'community-mode, prioritet 0, respekterer ro-timer',
  },
  work: {
    icon: Bell,
    label: 'Push leveres som operasjonell varsel',
    detail: 'work-mode, prioritet 1, går gjennom ro-timer',
  },
  external: {
    icon: BellRing,
    label: 'Push leveres med forhøyet prioritet',
    detail: 'work-mode, prioritet 2, push + e-post',
  },
}[tier];
```

Copy reflects actual `notification_mode` values (no fictitious `elevated`-mode mention).

### 10.4 staff_event inline-create

When `kind='staff_event'` and operator clicks "Opprett nytt event":

```ts
async function createInlineEvent(payload: StaffEventDraft): Promise<string> {
  // Server action calls staff_event creation capability tool
  const { event_id } = await fetch('/api/staff-event/create', {
    method: 'POST', body: JSON.stringify(payload)
  }).then(r => r.json());
  return event_id;
}

async function publishWithInlineEvent(composer: ComposerState) {
  const event_id = await createInlineEvent(composer.eventDraft);
  await supabase.rpc('publish_announcement_atomic', {
    ...composer,
    p_kind: 'staff_event',
    p_linked_entity_type: 'staff_event',
    p_linked_entity_id: event_id,
  });
}
```

The two-step (create event, then publish announcement) is not atomic across both rows because `staff_event` lives in a different module. Acceptable trade-off: if publish fails after event creation, operator sees the event in calendar (uncoupled) and can retry the announcement.

## 11. Card-Render Spec (NyheterClient)

`NewsCard` component extended:

```tsx
<NewsCard
  message={msg}
  meta={meta}              // NEW — joined from announcement_meta
  showKindIcon={true}      // NEW
  showTierBorder={true}    // NEW
  showLinkChip={true}      // NEW
/>
```

Render rules:

| Element | Source | Behaviour |
|---|---|---|
| Kind icon | `meta.kind` | Lucide icon per kind: Megaphone (general), Utensils (new_menu), UserPlus (new_hire), Calendar (staff_event), ClockArrowDown (schedule_change), FileText (policy_update), ExternalLink (external) |
| Tier border-left | `meta.tier` | 4px left border: warm (social), neutral (work), elevated-ring (external) |
| Link chip | `meta.linked_entity_*` | `[<icon> <label> →]` chip below body. Click navigates per link_type (see §11.1) |
| Tag pills | `meta.tags` | Small pills below body, color-coded by tag hash |

### 11.1 Link-chip navigation

| link_type | Navigation target |
|---|---|
| `staff_event` | `/dashboard/calendar?event=<id>` (event detail) |
| `schedule_shift` | `/dashboard/schedule?shift=<id>` |
| `policy` | `/dashboard/policies/<id>` |
| `protocol` | `/dashboard/governance?protocol=<id>` |
| `profile` | `/dashboard/people/<id>` |
| `menu_document` | external doc URL (target=_blank) |
| `external_url` | external URL (target=_blank with rel=noopener) |

Emits `announcement.link_followed` telemetry on click.

## 12. Telemetry Updates

### 12.1 Extend `channel.message.sent` properties

```ts
'channel.message.sent': {
  // existing
  channel_id, origin_type, message_type, visibility_scope, target_profile_count,
  audience_kind, notification_priority, notification_mode,

  // NEW (populated when message_type='announcement')
  announcement_kind?: AnnouncementKind,
  announcement_tier?: AnnouncementTier,
  announcement_tag_count?: number,
  announcement_has_link?: boolean,
  announcement_link_type?: AnnouncementLinkType,
  announcement_tier_overridden?: boolean,
}
```

### 12.2 New event: `announcement.link_followed`

```ts
'announcement.link_followed': {
  workspace_id, actor_id,
  properties: {
    message_id, kind, link_type, link_id,
  },
  entity: { entity_type: 'channel_message', entity_id: message_id },
}
```

Routing: `posthog`, `activity_trail` (skip `logger` for volume).

### 12.3 Existing events — no change

- `channel.message.pinned` / `unpinned` — unchanged
- `communication.broadcast_sent` — unchanged
- `news.post.created` / `reacted` — unchanged

## 13. RLS Policies

```sql
ALTER TABLE public.announcement_meta ENABLE ROW LEVEL SECURITY;

-- SELECT: member of parent channel
CREATE POLICY meta_jwt_select ON public.announcement_meta
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_message cm
      JOIN public.channel_member cmem
        ON cmem.channel_id = cm.channel_id
        AND cmem.profile_id = auth.uid()
        AND cmem.left_at IS NULL
      WHERE cm.id = announcement_meta.message_id
        AND (
          cm.visibility_scope = 'all_members'
          OR cm.target_profile_ids @> ARRAY[auth.uid()]
        )
    )
  );

-- INSERT: blocked at policy level (RPC is sole entry)
-- No JWT-INSERT policy — publish_announcement_atomic SECURITY DEFINER inserts.

-- UPDATE: own message + manager+
CREATE POLICY meta_jwt_update ON public.announcement_meta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_message cm
      WHERE cm.id = announcement_meta.message_id
        AND cm.sender_id = auth.uid()
    )
    AND public.is_manager_in_workspace(auth.uid(), workspace_id)
  );

-- DELETE: cascade from channel_message (FK ON DELETE CASCADE — no policy needed)

-- API: workspace key
CREATE POLICY meta_api_select ON public.announcement_meta
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
```

## 14. Out-of-Scope (Deferred)

- §3.5 Mobile dedicated bulletin layout — read parity, follows V1 schema landing
- §3.6 Home widget — follows V1 schema landing
- §3.7 Chat "+" inline-attach — separate composer surface, depends on V1 schema
- §3.10 Read-receipt aggregation — independent perf work
- §3.11 Norwegian i18n catch-up — independent translation sortie
- §3.12 Scheduled publish — separate feature
- §3.13 Edit-after-publish — separate feature
- §3.14 Expiry / auto-archive — separate feature
- V2 (tag-junction) — upgrade path noted; not built
- V3 (per-workspace kind-config) — deferred until concrete request

## 15. Falsifiable Acceptance Criteria

| # | Criterion | Verification |
|---|---|---|
| A1 | M1-M5 migrations apply cleanly on fresh Supabase Local | `npx supabase db reset` succeeds |
| A2 | M2 backfill: every existing `channel_message` with `message_type='announcement'` has a `announcement_meta` row | `SELECT COUNT(*) FROM channel_message WHERE message_type='announcement' AND NOT EXISTS (SELECT 1 FROM announcement_meta WHERE message_id=channel_message.id)` returns 0 |
| A3 | Notification trigger preserves existing behaviour for backfilled rows | Insert announcement with `kind='general', tier='work'` → `notification_outbox` row carries `priority=1, mode='work'` |
| A4 | Notification trigger respects tier | Insert with `tier='social'` → `priority=0, mode='community'`. Insert with `tier='external'` → `priority=2, mode='work'` + `allowed_channels` contains 'email' |
| A5 | `publish_announcement_atomic` rejects non-manager | Call as employee role → exception `PERMISSION_DENIED` |
| A6 | `publish_announcement_atomic` rejects sender-id spoofing | Call with `p_sender_id != auth.uid()` (non-service-role) → exception `IDENTITY_MISMATCH` |
| A7 | CHECK constraint blocks invalid kind↔link pairs | `INSERT … kind='general', linked_entity_type='profile'` raises constraint violation |
| A8 | CHECK constraint enforces link-pair atomicity | `INSERT … linked_entity_type='staff_event', linked_entity_id=NULL` raises constraint violation |
| A9 | RLS hides `announcement_meta` for non-channel-member | Logged in as non-member → `SELECT * FROM announcement_meta WHERE message_id=<x>` returns 0 rows |
| A10 | Composer UI shows kind picker; kind change updates tier+audience defaults | Playwright: select `staff_event` → tier auto-set to `social`, audience to `all` |
| A11 | staff_event inline-create produces linked announcement | Playwright: kind=staff_event → click "Opprett nytt event" → fill form → publish → assert `announcement_meta.linked_entity_*` set + `staff_event` row exists |
| A12 | Card render shows kind icon, tier border, link chip | Playwright: open `/dashboard/komm/nyheter` → assert all 3 elements present per card type |
| A13 | `announcement.link_followed` emits on link-chip click | Playwright + activity_trail query: click chip → row appears in `activity_trail` |
| A14 | All 4 composers route through `publish_announcement_atomic` | Code grep: no direct `INSERT INTO channel_message … message_type = 'announcement'` outside the RPC function body |
| A15 | Agent capability `publish_announcement` accepts and forwards kind/tier/tags/link | Capability unit test: confirm:false returns kind+tier+link_preview; confirm:true writes sidecar row |

## 16. Dependencies and Cross-Module Coordination

- **Communication module** — no schema change to `channel_message`. Notification trigger refactor is within communication scope; coordinate via ADR review.
- **Notifications module** — `notification_outbox` consumer must respect new `mode='elevated'` value (badge + sound). Confirm with notifications module owner before M5 lands.
- **Staff event module** — inline-create flow calls staff_event creation capability. Confirm capability tool exists and accepts the draft payload shape; if not, gap to close before this spec ships.
- **Profile/policy/shift modules** — link-target read paths assume existing module entities. No coordination needed; only navigation routes consumed.
- **Mobile** — schema-only change; mobile reads via Supabase types after regen. Mobile-specific UI (kind icons, tier styling on chat bubble) is a follow-up sortie tracked in §14.

## 17. ADRs Required

- **ADR (new)** — Announcement Sidecar + Kind/Tier/Link (V1 Pragmatic). References this spec.
- **ADR amendment to ADR-0157** — Notes that `publish_announcement_atomic` is the canonical write-path; direct-Supabase mutations against `channel_message` for announcements are deprecated.
- **ADR amendment to ADR-0078** — No change needed; voice-rejection remains at tool-router boundary.

## 18. Risks

| Risk | Mitigation |
|---|---|
| Backfill misses rows under load | Backfill uses `ON CONFLICT DO NOTHING`; safe to re-run |
| Trigger race when sidecar missing | `COALESCE(v_tier, 'work')` fallback preserves existing behaviour |
| Operator confusion over tier-override | Telemetry tracks `tier_overridden:true`; UX copy makes override visible |
| External-tier abuse (elevated push for non-critical) | Document tier semantics in operator help; no DB constraint (operator judgment) |
| Inline staff_event create leaks orphan event on publish failure | Operator sees event in calendar, can retry announcement or delete event |
| `policy_update` kind without policy module integration | Capability tool unit-test asserts link_type='policy' requirement; composer hides kind if no policies exist |

## 19. Open Questions

None at spec-time. All design decisions locked per §3.

## 20. References

- Module overview: [`docs/modules/announcments/MODULE_ANNOUNCEMENTS.md`](../../modules/announcments/MODULE_ANNOUNCEMENTS.md)
- Current data model: [`docs/modules/announcments/DATA-MODEL.md`](../../modules/announcments/DATA-MODEL.md)
- Architecture map: [`docs/modules/announcments/ARCHITECTURE.md`](../../modules/announcments/ARCHITECTURE.md)
- User flows: [`docs/modules/announcments/USER-FLOWS.md`](../../modules/announcments/USER-FLOWS.md)
- Gaps inventory: [`docs/modules/announcments/GAPS-AND-DEBT.md`](../../modules/announcments/GAPS-AND-DEBT.md)
- Wave A plan: [`docs/modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md`](../../modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md)
- Designer prototype: [`docs/modules/announcments/nyheter/project/`](../../modules/announcments/nyheter/project/)
- Related: ADR-0078 (voice-channel restrictions), ADR-0156 (Day-Control canonical surface), ADR-0157 (direct mutations vs server actions), ADR-0189 (`broadcast.send` capability), ADR-0204 (gatedMutation), ADR-0287 (gate_action mandatory), ADR-0358 (telemetry registry requires emit wiring)
