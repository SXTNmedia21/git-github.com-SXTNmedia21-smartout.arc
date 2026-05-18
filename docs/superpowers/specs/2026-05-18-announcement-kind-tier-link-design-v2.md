---
title: "Announcement Kind / Tier / Entity-Link — V2 Design"
status: accepted
council_verdict: APPROVED-PENDING-CODE (V1 REJECT 2026-05-18 resolved via 3 locked ADRs)
supersedes: docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md
derived_adrs: [ADR-0369, ADR-0370, ADR-0371]
derived_learnings: [L-0312, L-0313, L-0314, L-0315]
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [spec, announcements, kind, tier, entity-link, v2, locked]
---

# Announcement Kind / Tier / Entity-Link — V2 Design

> **STATUS: ACCEPTED 2026-05-18.** This spec supersedes the rejected V1 (`docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md`). V1 had 6 BLOCKERS (B1–B6) resolved here via three ADRs locked by Pontus on 2026-05-18: ADR-0369 (RPC-body fan-out = Option B), ADR-0370 (extend `communication` capability = Option B), ADR-0371 (preserve tool API `{title, body}` = Option A). A Phase 2.5 grep evidence section (§15) appended. V1→V2 blocker resolution matrix at §16.

---

## §1 — Problem Statement

The Announcements module treats every announcement as an undifferentiated `channel_message` with `message_type='announcement'`. Operators cannot classify kind (new menu, new hire, personaltreff, schedule change, policy update, general, external), cannot link the announcement to a related entity (the staff_event being announced, the shift being changed, the policy being updated), and cannot tier the announcement to drive different notification priorities.

The existing notification trigger (`supabase/migrations/20260422310100_channel_message_notification_trigger.sql`) hardcodes `priority=1, mode='work'` for every announcement. A birthday-party announcement competes with a critical schedule change for the same notification weight. UI is visually homogeneous.

Three coupled gaps require a single coordinated design: kind discrimination, entity-link mechanism, and tier classification — because they share the same write-path (announcement composer), read-path (bulletin board / mobile feed / agent surface), and RLS boundary.

---

## §2 — Decision Drivers

- Operators want kind-based defaults for audience, tier, and link type in the composer.
- `personaltreff` / `staff_event` use-case requires linking an announcement to a `staff_event` row holding RSVP state (today disconnected).
- Notification priority must vary by announcement intent — push fatigue on social-tier drives opt-outs that block work-tier reach.
- Schema changes to `channel_message` are cross-module; sidecar avoids cross-module coordination.
- Existing Wave A composer (`NyheterClient.tsx`) must keep working — no breaking change for mid-publish users.
- Mobile is read-only per ADR-0133 — no mobile composer. Mobile renders the sidecar additively via TierBadge + EntityLinkCTA.
- Agent tool `publish_announcement` must accept new fields without breaking voice-rejected pattern (ADR-0078) or existing `{title, body}` callers (ADR-0371).
- Atomicity must be real PostgreSQL semantics, not assumed `SET CONSTRAINTS` semantics (ADR-0369 / L-0312).

---

## §3 — Locked Architectural Choices

| Axis | V2 Choice | ADR | V1 Blocker Resolved |
|---|---|---|---|
| Atomicity mechanism | RPC body fan-out — INSERT channel_message + INSERT announcement_meta + inline fan-out helper, all in one transaction. No `SET CONSTRAINTS ALL DEFERRED`. | ADR-0369 (B) | B1 |
| Capability key | Extend `communication` capability. `actionType='publish_announcement_atomic'`. Day-Control keeps `broadcast.send` for defense-in-depth. | ADR-0370 (B) | B2, B3 |
| Tool API shape | Preserve `{title, body}` in tool schema and composers. Additive params `{kind, tier, tags?, linked_entity_type?, linked_entity_id?}` appended. Server concat `title+"\n"+body` to `channel_message.content` unchanged. | ADR-0371 (A) | B4 |
| Sub-kind representation | Fixed enum `announcement_kind` + freeform `tags text[]` | — | — |
| Tier behaviour | Drives notification priority AND UI styling | — | — |
| Entity-link shape | Single nullable polymorphic pair on sidecar | — | — |
| Schema home | Sidecar `announcement_meta` 1:1 with `channel_message` via PK FK ON DELETE CASCADE | — | — |
| Notification enum values | Only existing `notification_mode` values (`training`/`work`/`community`) used. No `elevated` or `social` value exists or is added. External tier = `mode='work'` + `priority=2` + `allowed_channels='{push,email}'` | V1 §4.1 | B6 |
| `in_app` channel | `in_app` was added via ALTER TYPE (verified). Fan-out to `notification_outbox` does NOT include `in_app` in `allowed_channels` array — in-app rendering is a surface-side concern, not an outbox-channel concern. | V1 §6 | B6 |

---

## §4 — Schema

### §4.1 Enums (3 new types)

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

Per smartout-database-guide rule: always grep `database.types.ts` before creating new enums. These three names are new and verified absent from the type file (Phase 2.5 §15 below).

**Existing enum cross-references (verified, no change):**

- `notification_mode` values: `training`, `work`, `community`. No `social` or `elevated`. Adding values is a cross-module change — out of scope for V1.
- `notification_channel` values: `push`, `sms`, `email`, `voice`, `in_app` (last added via ALTER TYPE at `supabase/migrations/20260324220000_notification_table.sql:7`). Fan-out `allowed_channels` array in trigger helper uses only `push` and `email` for announcements; `in_app` is NOT included in outbox rows (surface-side rendering).

**Tier → notification mapping (uses only existing enum values):**

| Announcement tier | `notification_mode` (existing) | `priority` (smallint) | `allowed_channels` (notification_channel[]) |
|---|---|---|---|
| `social` | `community` | 0 | `'{push}'` |
| `work` | `work` | 1 | `'{push}'` |
| `external` | `work` | 2 | `'{push,email}'` |

`external` tier reuses `work` mode (no `elevated` value). Distinction comes from `priority=2` (urgent) + `email` channel. Notifications consumer can escalate UI treatment based on `priority`. Future sortie can add `elevated` enum if gradient proves insufficient — tracked as notifications-module follow-up, not blocking V1.

### §4.2 Sidecar table `announcement_meta`

Per smartout-database-guide: `workspace_id` on all workspace-scoped tables; `created_at`+`updated_at` (L-0042 timestamps — `updated_at` omitted here because sidecar is effectively immutable after publish; future edit-after-publish sortie can add it at that time); RLS dual-policy (JWT + API key).

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

`meta_kind_link_consistent`: enforces that `policy_update` kind always provides a `policy` link. All other kinds allow optional link. `meta_link_pair_consistent`: both columns null together or both non-null — no orphan type or id.

### §4.3 Per-kind defaults (shared constant, `packages/ai/src/capabilities/communication/constants.ts`)

```ts
export const DEFAULT_TIER_FOR_KIND: Record<AnnouncementKind, AnnouncementTier> = {
  general:         'work',
  new_menu:        'work',
  new_hire:        'social',
  staff_event:     'social',
  schedule_change: 'work',
  policy_update:   'work',
  external:        'external',
};

export const DEFAULT_AUDIENCE_FOR_KIND: Record<AnnouncementKind, AudienceKind> = {
  general:         'all',
  new_menu:        'all',
  new_hire:        'all',
  staff_event:     'all',
  schedule_change: 'on_duty',
  policy_update:   'all',
  external:        'all',
};

export const LINK_REQUIRED_FOR_KIND: Record<AnnouncementKind, boolean> = {
  general:         false,
  new_menu:        false,
  new_hire:        false,
  staff_event:     false,  // strongly recommended, DB does not enforce
  schedule_change: false,
  policy_update:   true,   // CHECK constraint enforces at DB level
  external:        false,
};

export const LINK_TYPES_FOR_KIND: Record<AnnouncementKind, AnnouncementLinkType[]> = {
  general:         [],
  new_menu:        ['menu_document', 'external_url'],
  new_hire:        ['profile'],
  staff_event:     ['staff_event'],
  schedule_change: ['schedule_shift'],
  policy_update:   ['policy'],
  external:        ['external_url'],
};
```

Imported by both web composer hooks and the agent capability tool.

---

## §5 — Atomic Publish RPC

**ADR-0369 (Option B):** The RPC inserts both rows and calls the fan-out helper inline. No `SET CONSTRAINTS ALL DEFERRED`. The existing `AFTER INSERT` trigger gets an early-return guard for `message_type='announcement'` so trigger fan-out handles non-announcement messages only.

### §5.0 Prerequisite helper `is_manager_in_workspace` (Migration M0)

Codebase ships `public.is_admin_in_workspace(uid, wid)` at `supabase/migrations/00004_rls_policies.sql:33`. A `manager+` predicate (manager OR admin OR owner) is needed by the RPC PERMISSION_DENIED guard:

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

Pattern matches `is_admin_in_workspace` shape. `anon` revoke per `supabase/migrations/20260524000000_revoke_anon_security_definer_hardening.sql`. Profile column names (`user_id`, `workspace_id`, `role`, `status`) verified against `packages/supabase/src/database.types.ts` — verify again during implementation.

### §5.1 Fan-out helper `fn_publish_announcement_notifications`

Separate helper function keeps the RPC body clean and makes the fan-out logic independently testable:

```sql
CREATE OR REPLACE FUNCTION public.fn_publish_announcement_notifications(
  p_message_id         uuid,
  p_channel_id         uuid,
  p_workspace_id       uuid,
  p_sender_id          uuid,
  p_content            text,
  p_tier               announcement_tier,
  p_visibility_scope   channel_message_visibility,
  p_target_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priority     smallint;
  v_mode         notification_mode;
  v_channels     notification_channel[];
BEGIN
  -- Tier → (mode, priority, channels) mapping per §4.1 table.
  CASE p_tier
    WHEN 'social'   THEN v_priority := 0; v_mode := 'community'; v_channels := ARRAY['push']::notification_channel[];
    WHEN 'work'     THEN v_priority := 1; v_mode := 'work';      v_channels := ARRAY['push']::notification_channel[];
    WHEN 'external' THEN v_priority := 2; v_mode := 'work';      v_channels := ARRAY['push','email']::notification_channel[];
    ELSE                 v_priority := 1; v_mode := 'work';      v_channels := ARRAY['push']::notification_channel[];
  END CASE;

  INSERT INTO public.notification_outbox (
    workspace_id,
    recipient_id,
    mode,
    priority,
    title,
    body,
    action_url,
    metadata,
    allowed_channels
  )
  SELECT
    p_workspace_id,
    cmem.profile_id,                                          -- recipient_id per verified schema
    v_mode,
    v_priority,
    LEFT(SPLIT_PART(p_content, E'\n', 1), 140),              -- first line = title (max 140 chars)
    LEFT(p_content, 500),                                     -- body (max 500 chars)
    '/dashboard/komm/nyheter#m-' || p_message_id::text,
    jsonb_build_object(
      'event_key',           'announcement.published',
      'entity_type',         'channel_message',
      'entity_id',           p_message_id,
      'channel_id',          p_channel_id,
      'announcement_tier',   p_tier::text
    ),
    v_channels
  FROM public.channel_member cmem
  WHERE cmem.channel_id = p_channel_id
    AND cmem.left_at IS NULL
    AND cmem.profile_id <> p_sender_id                        -- exclude sender from notifications
    AND (
      p_visibility_scope = 'all_members'
      OR p_target_profile_ids @> ARRAY[cmem.profile_id]
    );

EXCEPTION WHEN OTHERS THEN
  -- Fan-out failure must NOT roll back the published message.
  -- Log to metadata and continue — delivery failure is retryable,
  -- message atomicity is not negotiable.
  RAISE WARNING 'fn_publish_announcement_notifications failed for message %: %', p_message_id, SQLERRM;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_publish_announcement_notifications TO authenticated, service_role;
```

Key implementation notes:
- `recipient_id` — verified column name (NOT `recipient_profile_id`) against `supabase/migrations/00006_notification_engine.sql`.
- `title` + `body` both NOT NULL in `notification_outbox` — first-line split + `LEFT(content, 500)` satisfies both.
- `EXCEPTION WHEN OTHERS THEN RAISE WARNING` — fan-out failure must NOT rollback the published channel_message. This is a critical load-bearing semantic: notification delivery is a best-effort side-effect; the message itself is the source of truth.
- Sender excluded: `cmem.profile_id <> p_sender_id` prevents self-notification.
- `is_muted` filter: if a `is_muted` column exists on `channel_member`, add `AND NOT cmem.is_muted` — verify against actual schema during implementation.

### §5.2 Main RPC `publish_announcement_atomic`

**ADR-0370 (Option B):** Capability key is `'communication'`. `actionType='publish_announcement_atomic'` is an audit-only string recorded in `gate_evaluation.action_type` — gate keys on `(workspace_id, capability)` only (verified at `supabase/migrations/20260516130000_gate_action_unseeded_warning.sql:96-100`).

**ADR-0371 (Option A):** `p_content` is the pre-concatenated `title + "\n" + body` that TypeScript callers produce client-side. The RPC receives a single `p_content text` — the split at the tool layer is TypeScript concern, not SQL concern.

```sql
CREATE OR REPLACE FUNCTION public.publish_announcement_atomic(
  p_workspace_id        uuid,
  p_actor_profile_id    uuid,
  p_channel_id          uuid,
  p_content             text,                              -- pre-concatenated: title + "\n" + body
  p_visibility_scope    channel_message_visibility DEFAULT 'all_members',
  p_target_profile_ids  uuid[]                    DEFAULT NULL,
  p_system_data         jsonb                     DEFAULT '{}',
  p_kind                announcement_kind         DEFAULT 'general',
  p_tier                announcement_tier         DEFAULT 'work',
  p_tags                text[]                    DEFAULT '{}',
  p_linked_entity_type  announcement_link_type    DEFAULT NULL,
  p_linked_entity_id    uuid                      DEFAULT NULL,
  p_tier_overridden     boolean                   DEFAULT false,
  p_client_message_id   uuid                      DEFAULT gen_random_uuid()
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
  -- Detect service-role bypass (agent server-side actor resolution per ADR-0151).
  v_is_service_role := COALESCE(
    current_setting('request.jwt.claim.role', true) = 'service_role',
    false
  );

  -- Defense-in-depth: caller already gated, RPC re-checks.
  IF NOT public.is_manager_in_workspace(p_actor_profile_id, p_workspace_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED — actor must be manager+ in workspace';
  END IF;

  -- Anti-spoof: in user-JWT context, actor must equal auth.uid().
  -- Service-role bypass exists for server actions resolving actor_id server-side.
  IF NOT v_is_service_role AND p_actor_profile_id <> auth.uid() THEN
    RAISE EXCEPTION 'IDENTITY_MISMATCH — actor_profile_id must equal auth.uid() in user JWT context';
  END IF;

  -- Step 1: Insert parent channel_message.
  -- sender_id column verified (NOT sender_profile_id) against database.types.ts.
  INSERT INTO public.channel_message (
    channel_id,
    workspace_id,
    sender_id,
    content,
    message_type,
    visibility_scope,
    target_profile_ids,
    system_data,
    client_message_id
  ) VALUES (
    p_channel_id,
    p_workspace_id,
    p_actor_profile_id,
    p_content,
    'announcement',
    p_visibility_scope,
    p_target_profile_ids,
    p_system_data,
    p_client_message_id
  )
  RETURNING id INTO v_message_id;

  -- Step 2: Insert sidecar (same transaction, announcement_meta now exists
  -- when notification fan-out fires below — ADR-0369 atomicity guarantee).
  INSERT INTO public.announcement_meta (
    message_id,
    workspace_id,
    kind,
    tier,
    tags,
    linked_entity_type,
    linked_entity_id,
    tier_overridden
  ) VALUES (
    v_message_id,
    p_workspace_id,
    p_kind,
    p_tier,
    p_tags,
    p_linked_entity_type,
    p_linked_entity_id,
    p_tier_overridden
  );

  -- Step 3: Inline fan-out.
  -- The existing AFTER INSERT trigger has been guarded to skip announcements
  -- (migration M5 — see §7.5). Fan-out for announcements lives ONLY here.
  PERFORM public.fn_publish_announcement_notifications(
    v_message_id,
    p_channel_id,
    p_workspace_id,
    p_actor_profile_id,
    p_content,
    p_tier,
    p_visibility_scope,
    COALESCE(p_target_profile_ids, ARRAY[]::uuid[])
  );

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_announcement_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic TO authenticated, service_role;
```

### §5.3 Trigger guard (Migration M5)

The existing `AFTER INSERT` trigger at `supabase/migrations/20260422310100_channel_message_notification_trigger.sql` must receive an early-return guard to prevent double fan-out for announcements. Add at the top of the trigger function body:

```sql
CREATE OR REPLACE FUNCTION public.trigger_channel_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ADR-0369: Announcements fan-out is handled by publish_announcement_atomic
  -- RPC body (fn_publish_announcement_notifications). Skip here to prevent
  -- double fan-out and ensure sidecar row exists at notification time.
  IF NEW.message_type = 'announcement' THEN
    RETURN NEW;
  END IF;

  -- [existing trigger body unchanged below this line]
  ...
END;
$$;
```

Only the guard line is added — all other trigger logic (EXCEPTION handler, mute filter, sender exclusion, non-announcement message types) is unchanged.

---

## §6 — RLS Policies

```sql
ALTER TABLE public.announcement_meta ENABLE ROW LEVEL SECURITY;

-- JWT SELECT: member of parent channel who can see the message.
CREATE POLICY meta_jwt_select ON public.announcement_meta
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.channel_message cm
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

-- No JWT INSERT policy: publish_announcement_atomic SECURITY DEFINER is the sole write path.
-- RLS blocks direct INSERT attempts from authenticated clients.

-- JWT UPDATE: own message + manager+
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

-- DELETE: cascade from parent channel_message (ON DELETE CASCADE — no RLS policy needed).

-- API key SELECT (workspace-scoped integrations per dual-auth convention).
CREATE POLICY meta_api_select ON public.announcement_meta
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
```

Per smartout-database-guide: dual-policy (JWT + API key) on every workspace-scoped table. No INSERT policy = RLS blocks direct inserts, RPC bypasses via SECURITY DEFINER.

---

## §7 — Migration Sequence (M0–M6)

**Apply order is strict.** M0 helper must exist before M3 (RPC). M1 enums must exist before M2 (table). M2 sidecar must exist before M3 (RPC inserts into it). M4 backfill before M5 (trigger reads sidecar). M6 extends the read RPC (Track C dependency, see §13).

| # | File suffix | Content | Dependency |
|---|---|---|---|
| M0 | `_is_manager_in_workspace_helper.sql` | `is_manager_in_workspace()` SECURITY DEFINER helper | none |
| M1 | `_announcement_kind_tier_enums.sql` | 3 enums: `announcement_kind`, `announcement_tier`, `announcement_link_type` | none |
| M2 | `_announcement_meta_table.sql` | `announcement_meta` table, indexes, CHECK constraints | M1 |
| M3 | `_announcement_meta_rls.sql` | RLS: enable, `meta_jwt_select`, `meta_jwt_update`, `meta_api_select` | M2 |
| M4 | `_announcement_meta_backfill.sql` | Backfill existing announcements as `kind='general', tier='work'` | M2 |
| M5 | `_fn_publish_announcement_notifications.sql` + `_publish_announcement_atomic_rpc.sql` + `_channel_message_trigger_announcement_guard.sql` | Fan-out helper, main RPC, trigger guard | M0, M3, M4 |
| M6 | `_get_channel_messages_rpc_announcement_meta_join.sql` | Extend `get_channel_messages` RPC to LEFT JOIN `announcement_meta` — Track C dependency for mobile read parity | M2 |

**M4 backfill SQL:**

```sql
INSERT INTO public.announcement_meta (message_id, workspace_id, kind, tier)
SELECT cm.id, cm.workspace_id, 'general'::announcement_kind, 'work'::announcement_tier
FROM public.channel_message cm
WHERE cm.message_type = 'announcement'
ON CONFLICT (message_id) DO NOTHING;
```

Safe to re-run (ON CONFLICT DO NOTHING). All existing announcement rows receive `kind='general', tier='work'` — matches current trigger behaviour exactly, no notification behaviour regression.

**M6 — `get_channel_messages` RPC extension (Track C):**

`apps/mobile/src/hooks/queries/use-channel-messages.ts` consumes `get_channel_messages` RPC (verified at `apps/mobile/src/components/komm/ChannelMessageBubble.tsx:310`). Mobile parity for kind icon, tier badge, and entity link CTA requires the RPC to return `announcement_meta` fields. M6 adds a LEFT JOIN:

```sql
-- Pseudocode — actual column select depends on existing RPC signature.
-- LEFT JOIN announcement_meta am ON am.message_id = cm.id
-- Add to SELECT: am.kind, am.tier, am.tags, am.linked_entity_type, am.linked_entity_id
```

M6 is a Track C migration. Mobile parity testing (§13) is blocked until M6 lands.

---

## §8 — Capability Tool Update (ADR-0370 + ADR-0371)

`packages/ai/src/capabilities/communication/publish-announcement.ts`

**ADR-0371 (Option A):** Tool API preserves `{title, body}`. Additive params appended. callGateAction signature per code-trace: `callGateAction(supabaseAdmin, workspaceId, actorProfileId, args)` — positional, NOT callback-wrapping pattern (L-0315).

```ts
// EXISTING params — unchanged
const PublishAnnouncementInput = z.object({
  title: z.string().min(1).max(120),
  body:  z.string().min(1).max(1600),
  audience_kind:       AudienceKindSchema,
  audience_label:      z.string(),
  target_profile_ids:  z.array(z.string().uuid()).optional(),
  visibility_scope:    z.enum(['all_members', 'targeted_members']).default('all_members'),
  confirm:             z.boolean().default(false),

  // NEW — additive, all optional with defaults
  kind:              AnnouncementKindSchema.default('general'),
  tier:              AnnouncementTierSchema.optional(),
  tags:              z.array(z.string()).default([]),
  linked_entity_type: AnnouncementLinkTypeSchema.optional(),
  linked_entity_id:  z.string().uuid().optional(),
}).refine(
  (d) => {
    // Cross-field: policy_update kind requires linked_entity_type='policy'
    if (d.kind === 'policy_update' && d.linked_entity_type !== 'policy') {
      return false;
    }
    return true;
  },
  { message: 'policy_update kind requires linked_entity_type=policy' }
).refine(
  (d) => {
    // Link pair: both or neither
    const hasType = d.linked_entity_type != null;
    const hasId   = d.linked_entity_id != null;
    return hasType === hasId;
  },
  { message: 'linked_entity_type and linked_entity_id must both be present or both absent' }
);
```

**Handler body (key parts):**

```ts
// Tier resolution: operator-provided tier OR default-for-kind
const tierResolved: AnnouncementTier =
  input.tier ?? DEFAULT_TIER_FOR_KIND[input.kind];
const tierOverridden: boolean =
  input.tier != null && input.tier !== DEFAULT_TIER_FOR_KIND[input.kind];

// Pre-concat per ADR-0371: tool receives title+body, RPC receives content
const content = `${input.title}\n${input.body}`;

if (!input.confirm) {
  return {
    draft: {
      title: input.title,
      body:  input.body,
      kind:  input.kind,
      tier:  tierResolved,
      tier_overridden: tierOverridden,
    },
    audience_preview: await resolveAudience(...),
    link_preview: input.linked_entity_type
      ? await resolveLink(input.linked_entity_type, input.linked_entity_id)
      : null,
    notification_preview: buildNotificationPreview(tierResolved),
  };
}

// ADR-0370 (Option B): capability key = 'communication', actionType = 'publish_announcement_atomic'
// callGateAction signature (verified at gate.ts:52): positional (supabaseAdmin, workspaceId, actorProfileId, args)
return await callGateAction(
  supabaseAdmin,
  workspaceId,
  actorProfileId,
  {
    capability:  'communication',
    actionType:  'publish_announcement_atomic',
    channel:     'chat',      // ADR-0078 — voice rejected upstream at router
    action: async () => {
      const { data, error } = await supabaseAdmin.rpc(
        'publish_announcement_atomic',
        {
          p_workspace_id:        workspaceId,
          p_actor_profile_id:    actorProfileId,
          p_channel_id:          resolvedChannelId,
          p_content:             content,
          p_visibility_scope:    input.visibility_scope,
          p_target_profile_ids:  input.target_profile_ids ?? null,
          p_system_data:         {},
          p_kind:                input.kind,
          p_tier:                tierResolved,
          p_tags:                input.tags,
          p_linked_entity_type:  input.linked_entity_type ?? null,
          p_linked_entity_id:    input.linked_entity_id ?? null,
          p_tier_overridden:     tierOverridden,
        }
      );
      if (error) throw new Error(`publish_announcement_atomic failed: ${error.message}`);
      return { message_id: data };
    },
  }
);
```

Intent classifier: NO change needed — `'communication'` already in `packages/ai/src/router/intent-classifier.ts:46` capability enum (verified). DOCUMENTED_TOOLLESS at `packages/ai/src/scripts/check-intent-coverage.ts:51-57` validates capability keys only, not actionType strings — NO addition needed.

---

## §9 — Composer Path Harmonization (4 paths)

All four announcement write-paths must route through `publish_announcement_atomic`. Direct `INSERT INTO channel_message WHERE message_type='announcement'` outside the RPC is forbidden after M5 lands.

| Composer | Current write | V2 write | New fields passed |
|---|---|---|---|
| `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` | Direct supabase INSERT | `supabase.rpc('publish_announcement_atomic', ...)` | kind, tier, tags, linked_entity_type, linked_entity_id |
| `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts` | Direct supabase INSERT | RPC | kind (default 'general'), tier (default 'work') |
| `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts` | Service-role INSERT | service-role client `.rpc(...)`. Existing `broadcast.send` gate unchanged. `system_data.broadcast_type` + `session_id` moved to `p_system_data` jsonb. | kind, tier (from Day-Control session context if available, otherwise defaults) |
| `packages/ai/src/capabilities/communication/publish-announcement.ts` | callGateAction wrapping direct INSERT | callGateAction wrapping RPC (§8 above) | full new params |

Note: The `send-broadcast-action.ts` path keeps its existing `broadcast.send` gate as defense-in-depth (ADR-0370). The RPC re-checks via `communication` capability + `is_manager_in_workspace`. Both gates fire for manager+ actors — intended redundancy, explicitly documented.

---

## §10 — Composer UX Spec

### §10.1 New top-of-form fields (web, above existing audience picker)

```
┌─ Ny kunngjøring ─────────────────────────────────────────────────┐
│                                                                   │
│  Type:   [▼ Generell              ]   Tier: [● Jobb ○ Sosial ○ Ekstern]
│           (AnnouncementKindPicker)          (AnnouncementTierPicker)
│           (auto-sets tier + audience)       (operator can override)
│                                                                   │
│  Tittel: [_________________________________________________]     │
│                                                                   │
│  Melding: [__________________________________________________]   │
│            [__________________________________________________]  │
│                                                                   │
│  Kobling: [conditional EntityLinkPicker per kind]                │
│           (hidden when LINK_TYPES_FOR_KIND[kind] is empty)       │
│                                                                   │
│  Tags:    [+ ny-meny] [+ vin]  [_________________________]      │
│                                                                   │
│  Målgruppe: [existing Wave A audience picker — unchanged]        │
│                                                                   │
│  🔔 Varslingspanel (TierNotificationPreview):                    │
│     "Push leveres som operasjonelt varsel (prioritet 1)"          │
│                                                                   │
│  [Avbryt]                                         [Publiser]     │
└───────────────────────────────────────────────────────────────────┘
```

### §10.2 Kind change handler

```ts
function onKindChange(newKind: AnnouncementKind) {
  setKind(newKind);
  // Only auto-update tier if operator hasn't manually overridden it.
  if (!tierOverridden) {
    setTier(DEFAULT_TIER_FOR_KIND[newKind]);
  }
  // Reset audience to kind default if operator hasn't manually changed it.
  if (!audienceManuallySet) {
    setAudience(DEFAULT_AUDIENCE_FOR_KIND[newKind]);
  }
  // Show relevant link picker variant.
  setActiveLinkTypes(LINK_TYPES_FOR_KIND[newKind]);
  // Clear stale link if new kind doesn't support current link type.
  if (linkedEntityType && !LINK_TYPES_FOR_KIND[newKind].includes(linkedEntityType)) {
    setLinkedEntityType(undefined);
    setLinkedEntityId(undefined);
  }
}

function onTierChange(newTier: AnnouncementTier) {
  setTier(newTier);
  setTierOverridden(newTier !== DEFAULT_TIER_FOR_KIND[kind]);
}
```

### §10.3 Tier notification preview (TierNotificationPreview component)

```ts
const TIER_NOTIFICATION_COPY: Record<AnnouncementTier, { icon: LucideIcon; label: string; detail: string }> = {
  social: {
    icon: BellOff,
    label: 'Push leveres stille (community-modus)',
    detail: 'Prioritet 0 — respekterer ro-timer',
  },
  work: {
    icon: Bell,
    label: 'Push leveres som operasjonelt varsel',
    detail: 'Prioritet 1 — passerer ro-timer',
  },
  external: {
    icon: BellRing,
    label: 'Push + e-post leveres med forhøyet prioritet',
    detail: 'Prioritet 2 (work-modus) — push og e-post',
  },
};
```

Copy reflects actual `notification_mode` enum values — no `elevated` mention.

### §10.4 staff_event inline-create

When `kind='staff_event'` and no existing event selected:

```ts
async function publishWithInlineEvent(composer: ComposerState) {
  // Two-step: create event, then publish announcement.
  // Not cross-table atomic — if publish fails, operator sees orphan event
  // in calendar (uncoupled) and can retry. Acceptable trade-off per §14 risks.
  const eventId = await createStaffEvent(composer.eventDraft);
  await supabase.rpc('publish_announcement_atomic', {
    ...rpcParamsFromComposer(composer),
    p_kind:               'staff_event',
    p_linked_entity_type: 'staff_event',
    p_linked_entity_id:   eventId,
  });
}
```

---

## §11 — Card-Render Spec (Web: NyheterClient / Mobile: ChannelMessageBubble)

### §11.1 Web — `NewsCard` component extension

```tsx
<NewsCard
  message={msg}           // channel_message row
  meta={meta}             // announcement_meta row, nullable (backfill ensures non-null for existing)
  showKindIcon={true}
  showTierBorder={true}
  showLinkChip={true}
/>
```

Render rules:

| Element | Source | Detail |
|---|---|---|
| Kind icon | `meta.kind` | Lucide: Megaphone (general), Utensils (new_menu), UserPlus (new_hire), Calendar (staff_event), ClockArrowDown (schedule_change), FileText (policy_update), ExternalLink (external) |
| Tier border-left | `meta.tier` | 4px left border via CSS variable: `--tier-social` / `--tier-work` / `--tier-external` (ADR-0361) |
| Link chip | `meta.linked_entity_*` | `[<icon> <label> →]` chip below body. Click navigates per §11.2. Emits `announcement.link_followed`. |
| Tag pills | `meta.tags` | Small pills below body, color-coded by tag string hash |

CSS variables `--tier-social`, `--tier-work`, `--tier-external` must be declared in `globals.css` before component work (ADR-0361 requirement).

### §11.2 Link-chip navigation targets

| `linked_entity_type` | Navigation target |
|---|---|
| `staff_event` | `/dashboard/calendar?event=<id>` |
| `schedule_shift` | `/dashboard/schedule?shift=<id>` |
| `policy` | `/dashboard/policies/<id>` |
| `protocol` | `/dashboard/governance?protocol=<id>` |
| `profile` | `/dashboard/people/<id>` |
| `menu_document` | external doc URL (`target="_blank"`) |
| `external_url` | external URL (`target="_blank" rel="noopener noreferrer"`) |

### §11.3 Mobile — `ChannelMessageBubble` extension (Track C)

Mount point: `apps/mobile/src/components/komm/ChannelMessageBubble.tsx:310`. Data flows via `use-channel-messages.ts` which calls `get_channel_messages` RPC.

**Mobile parity requires M6 (extend `get_channel_messages` RPC to JOIN `announcement_meta`).** Until M6 lands, mobile does not render kind/tier/link UI. After M6:

- `apps/mobile/src/components/news/TierBadge.tsx` — tier color indicator (border-left equivalent for RN)
- `apps/mobile/src/components/news/EntityLinkCTA.tsx` — link chip with `Linking.openURL` for external / `router.push` for internal

No mobile composer (ADR-0133 read-only boundary preserved).

---

## §12 — Telemetry (4 events, all emit-wired)

Per ADR-0358: telemetry events MUST have emit() call-sites. No orphan registry entries.

### §12.1 Extend `channel.message.sent` in `packages/telemetry/src/registry.ts`

Add to existing event's `properties` interface (at existing event registration ~line 4171):

```ts
// NEW announcement-specific properties (populated when message_type='announcement')
announcement_kind?:           string;  // AnnouncementKind
announcement_tier?:           string;  // AnnouncementTier
announcement_tag_count?:      number;
announcement_has_link?:       boolean;
announcement_link_type?:      string;  // AnnouncementLinkType
announcement_tier_overridden?: boolean;
```

Emit call-site: in `publish-announcement.ts` handler, after successful RPC call, emit `channel.message.sent` with the announcement-specific properties populated. Uses existing `emit()` pattern from `@smartout/telemetry`.

### §12.2 New event: `announcement.link_followed`

```ts
// In registry.ts
'announcement.link_followed': {
  workspace_id: string;
  actor_id:     string;
  properties: {
    message_id:  string;
    kind:        string;  // AnnouncementKind
    link_type:   string;  // AnnouncementLinkType
    link_id:     string;
  };
  entity: {
    entity_type: 'channel_message';
    entity_id:   string;
  };
  routing: ['posthog', 'activity_trail'];  // skip logger (volume concern)
}
```

Emit call-site: `EntityLinkCTA` onClick handler (`useRef` + `useEffect` pattern per L-0177 fail-fast on missing workspace_id/actor_id).

### §12.3 New event: `announcement.kind_changed`

```ts
// In registry.ts
'announcement.kind_changed': {
  workspace_id: string;
  actor_id:     string;
  properties: {
    from_kind: string;
    to_kind:   string;
    tier_auto_updated: boolean;
  };
  routing: ['posthog'];  // composer analytics only
}
```

Emit call-site: `onKindChange()` handler in composer.

### §12.4 New event: `announcement.tier_overridden`

```ts
// In registry.ts
'announcement.tier_overridden': {
  workspace_id: string;
  actor_id:     string;
  properties: {
    kind:          string;
    default_tier:  string;
    chosen_tier:   string;
  };
  routing: ['posthog', 'activity_trail'];
}
```

Emit call-site: `onTierChange()` when `tierOverridden === true`.

### §12.5 Existing events — no change

- `channel.message.pinned` / `unpinned` — unchanged
- `communication.broadcast_sent` — unchanged
- `news.post.created` / `reacted` — unchanged

---

## §13 — Test Plan

### Unit tests (`packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.kindTier.test.ts`)

| # | Scenario | Expected |
|---|---|---|
| T1 | `confirm:false` returns draft with `kind`, `tier_resolved`, `link_preview` | No RPC call, draft object returned |
| T2 | `confirm:true`, `kind='policy_update'` without linked_entity_type | Zod refine throws `'policy_update kind requires linked_entity_type=policy'` |
| T3 | `confirm:true`, `linked_entity_type` without `linked_entity_id` | Zod refine throws link-pair error |
| T4 | `confirm:true`, kind='new_hire', no tier provided | `tier_resolved='social'` (DEFAULT_TIER_FOR_KIND) |
| T5 | `confirm:true`, tier provided and differs from default | `tier_overridden=true` in RPC call payload |
| T6 | callGateAction uses `capability:'communication'` (not `broadcast.send`) | Assert call signature |
| T7 | RPC parameter `p_content` = `title + "\n" + body` | Assert concat |

### Migration tests (`supabase db reset` green)

| # | Criterion | Verification |
|---|---|---|
| A1 | M0–M6 apply cleanly on fresh Supabase Local | `npx supabase db reset` succeeds |
| A2 | Backfill idempotent | Run M4 twice → 0 errors, same row count |
| A3 | CHECK constraint `meta_kind_link_consistent` | `INSERT kind='general', linked_entity_type='profile'` → constraint violation |
| A4 | CHECK constraint `meta_link_pair_consistent` | `INSERT linked_entity_type='staff_event', linked_entity_id=NULL` → constraint violation |
| A5 | RPC rejects non-manager | Call as employee → `PERMISSION_DENIED` exception |
| A6 | RPC rejects sender-id spoof | Call with `p_actor_profile_id != auth.uid()` (non-service-role) → `IDENTITY_MISMATCH` |
| A7 | Trigger guard eliminates double fan-out | Insert announcement via RPC → 1 row in `notification_outbox` per eligible recipient |
| A8 | Social tier → community mode | `notification_outbox.mode = 'community'`, `priority = 0` |
| A9 | External tier → work mode + email channel | `notification_outbox.mode = 'work'`, `priority = 2`, `allowed_channels @> '{email}'` |
| A10 | RLS hides `announcement_meta` from non-member | Non-channel-member query → 0 rows |

### E2E (Playwright, `apps/e2e/specs/announcement-kind-tier.spec.ts`)

| # | Journey | Steps |
|---|---|---|
| E1 | Composer: kind picker changes tier default | Select `new_hire` → tier auto-sets to `social` |
| E2 | Composer: manual tier override | Select `new_hire`, change tier to `work` → `tier_overridden=true` in telemetry |
| E3 | Composer: policy_update without link blocked | Select `policy_update`, omit link, click Publiser → validation error |
| E4 | Card render: kind icon + tier border + link chip | Open `/dashboard/komm/nyheter` → assert all 3 elements per card type |
| E5 | Link chip click emits telemetry | Click chip → assert `announcement.link_followed` in `activity_trail` |
| E6 | All 4 composers route through RPC | Code grep + DB trigger test: no direct INSERT outside RPC body |

### Mobile parity (Track C — blocked until M6)

Mobile tests cannot run until `get_channel_messages` RPC is extended (M6). After M6:
- `apps/mobile/src/components/news/TierBadge.tsx` renders for social/work/external tiers
- `apps/mobile/src/components/news/EntityLinkCTA.tsx` navigates correctly
- No mobile composer test (ADR-0133 boundary enforced by code review, not Playwright)

---

## §14 — Out-of-Scope (Deferred)

- §3.5 Mobile dedicated bulletin layout — read parity via Track C (M6) is in-scope; dedicated layout is deferred
- §3.6 Home widget — follows V1 schema landing
- §3.7 Chat "+" inline-attach — separate composer surface
- §3.10 Read-receipt aggregation — independent perf work
- §3.11 Norwegian i18n catch-up — independent translation sortie
- §3.12 Scheduled publish — separate feature
- §3.13 Edit-after-publish — separate feature (sidecar `updated_at` column to be added then)
- §3.14 Expiry / auto-archive — separate feature
- V2 tag-junction — upgrade path preserved, not built
- V3 per-workspace kind-config — deferred until concrete request
- `elevated` notification_mode enum value — notifications-module follow-up sortie
- is_muted filter on channel_member — verify column existence during M5 implementation; add filter if column exists

---

## §15 — Phase 2.5 Grep Evidence (Self-Fact-Check)

All code-trace findings used in this spec are from the dispatch brief. Phase 2.5 verification requires running these greps before implementation to confirm no drift:

| Claim | Grep to verify | Expected |
|---|---|---|
| ✅ `callGateAction` positional signature at `gate.ts:52` | `grep -n "callGateAction" packages/ai/src/capabilities/communication/gate.ts` | Positional `(supabaseAdmin, workspaceId, actorProfileId, args)` |
| ✅ `channel_message.sender_id` (not `sender_profile_id`) | `grep -n "sender_id\|sender_profile_id" packages/supabase/src/database.types.ts` | Only `sender_id` |
| ✅ `channel_message.content` single column (no `title`/`body`) | `grep -n "\"title\"\|\"body\"\|\"content\"" packages/supabase/src/database.types.ts \| grep channel_message` | Only `content` |
| ✅ `notification_outbox.recipient_id` (not `recipient_profile_id`) | `grep -n "recipient_id\|recipient_profile_id" packages/supabase/src/database.types.ts` | Only `recipient_id` |
| ✅ `notification_mode` enum values: `training`/`work`/`community` | `grep -n "notification_mode\|training\|work\|community" supabase/migrations/00006_notification_engine.sql` | 3 values, no `social`/`elevated` |
| ✅ `in_app` added via ALTER TYPE | `grep -n "in_app" supabase/migrations/20260324220000_notification_table.sql` | `ALTER TYPE notification_channel ADD VALUE 'in_app'` |
| ✅ `communication` capability seed at `seed_communication_authority.sql:42` | `grep -n "communication" supabase/migrations/20260601100000_seed_communication_authority.sql` | `level=suggest, min_role=employee` |
| ✅ gate_action keys on `(workspace_id, capability)` only | `grep -n "actionType\|action_type" supabase/migrations/20260516130000_gate_action_unseeded_warning.sql` | No actionType index/key |
| ✅ `intent-classifier.ts:46` has `'communication'` | `grep -n "communication" packages/ai/src/router/intent-classifier.ts` | Present at approx line 46 |
| ✅ `ChannelMessageBubble.tsx:310` mobile mount point | `grep -n "get_channel_messages\|ChannelMessageBubble" apps/mobile/src/components/komm/ChannelMessageBubble.tsx` | Mount at ~line 310 |
| ⚠️ `announcement_kind` / `announcement_tier` / `announcement_link_type` absent from types | `grep -n "announcement_kind\|announcement_tier\|announcement_link_type" packages/supabase/src/database.types.ts` | 0 results (new enums not yet in DB) |
| ⚠️ `announcement_meta` absent from types | `grep -n "announcement_meta" packages/supabase/src/database.types.ts` | 0 results (new table not yet in DB) |

⚠️ markers indicate expected-missing (new schema not yet applied). All ✅ markers are pre-verified findings from code-trace in the dispatch brief. Any ✅ that returns 0 results or wrong shape = drift, halt implementation, update spec.

---

## §16 — V1 → V2 Blocker Resolution Matrix

| V1 BLOCKER | Root Cause | V2 Resolution | ADR |
|---|---|---|---|
| B1 — `SET CONSTRAINTS ALL DEFERRED` does not defer plain AFTER INSERT triggers | PostgreSQL semantics misread. `SET CONSTRAINTS` defers FK/UNIQUE constraints marked DEFERRABLE, not trigger execution. Trigger fires at statement end, not at COMMIT. Sidecar row therefore does not exist when trigger reads it. | Move fan-out into RPC body (`fn_publish_announcement_notifications`). Trigger gets early-return guard for `message_type='announcement'`. | ADR-0369 (B) |
| B2 — Capability key `broadcast.send` phantom in agent path | V1 §8 pseudocode used `capability: 'broadcast.send'` which has a different seed (`level=confirm, min_role=manager` vs `communication`'s `level=suggest, min_role=employee`). `broadcast.send` is NOT in `CapabilityName` type union — agent path would fail at runtime. | Use `capability: 'communication'`, `actionType: 'publish_announcement_atomic'`. Day-Control server action keeps its own `broadcast.send` gate as defense-in-depth. | ADR-0370 (B) |
| B3 — `callGateAction` signature mismatch | V1 §8 pseudocode used callback-wrapping pattern. Actual signature (verified at `gate.ts:52`) is positional: `callGateAction(supabaseAdmin, workspaceId, actorProfileId, args)`. | §8 updated with correct positional signature. | ADR-0370 (B) / L-0315 |
| B4 — Schema breaking: `{title, body}` → `{content}` collapse | V1 proposed collapsing existing tool params. `channel_message.content` is a single DB column (verified), but tool API, composer UI, and agent prompts all use separate `title` + `body`. Collapse = breaking change at tool-API level with no ADR + no consumer survey. | Preserve `{title, body}` in tool params + composers. Server concat unchanged. Sidecar adds new fields additively. | ADR-0371 (A) |
| B5 — Telemetry registry not extended | V1 listed new events in spec but did not show emit call-sites. Violates ADR-0358 (L-0176 class: docstring-drift). | §12 specifies all 4 events with explicit emit call-site locations. `channel.message.sent` extended; 3 new events registered + wired. | L-0312 class / ADR-0358 |
| B6 — `in_app` channel value dropped + `elevated` mode invented | V1 notification mapping used `mode='elevated'` (does not exist in enum) and dropped `in_app` from `allowed_channels`. | §4.1 mapping table uses only verified enum values. `external` tier maps to `mode='work'` + `priority=2`. `in_app` excluded from outbox channels (surface-side rendering concern). | L-0313 / §4.1 |

---

## §17 — Dependencies and Cross-Module Coordination

- **Communication module** — no schema change to `channel_message`. Trigger refactor is within communication scope (guard addition only). Coordinate via ADR review.
- **Notifications module** — `notification_outbox` fan-out uses existing columns and enum values only. No enum additions. No coordination required for V1 ship.
- **Staff event module** — `staff_event` inline-create flow calls staff_event creation capability. Verify capability tool exists and accepts draft payload before this spec ships.
- **Profile / policy / shift modules** — link-target navigation assumes existing routes. No coordination needed; only navigation routes consumed.
- **Mobile** — schema change is additive. Mobile reads via Supabase types after `pnpm --filter @smartout/supabase build`. Mobile-specific UI (TierBadge + EntityLinkCTA) is Track C, blocked on M6. Mobile parity architecture is in-scope (packages layer); mobile UI can ship separately per ADR-0133 mobile parity rules.
- **get_channel_messages RPC** — must be extended in Track C migration (M6) to LEFT JOIN `announcement_meta`. This is a NEW finding from R1 mobile explore. Do not mark mobile parity complete until M6 lands and `use-channel-messages.ts` query result shape reflects sidecar fields.

---

## §18 — Rollout Order (Track A → B → C)

**Track A — Schema + RPC (migrations M0–M5):**
1. M0: `is_manager_in_workspace` helper
2. M1: 3 enums
3. M2: `announcement_meta` table + indexes + CHECK constraints
4. M3: RLS policies
5. M4: backfill existing announcement rows
6. M5: fan-out helper + atomic RPC + trigger guard

**Track B — TypeScript (capability tool + composer paths + web UI components):**
1. Constants file `packages/ai/src/capabilities/communication/constants.ts`
2. Telemetry registry extension (`registry.ts`)
3. Capability tool `publish-announcement.ts` update
4. Composer hooks + server action (4 paths)
5. Web UI components: `AnnouncementKindPicker`, `AnnouncementTierPicker`, `EntityLinkPicker`, `TierBadge`, `EntityLinkCTA`
6. CSS variables `--tier-social` / `--tier-work` / `--tier-external` in `globals.css`
7. `NewsCard` extension
8. `packages/supabase/src/database.types.ts` regen after M5

**Track C — Mobile read parity (blocked on M6):**
1. M6: extend `get_channel_messages` RPC with LEFT JOIN `announcement_meta`
2. `database.types.ts` regen
3. `apps/mobile/src/components/news/TierBadge.tsx`
4. `apps/mobile/src/components/news/EntityLinkCTA.tsx`
5. `ChannelMessageBubble.tsx:310` mount point update

---

## §19 — Risks

| Risk | Mitigation |
|---|---|
| Backfill misses rows under load | M4 uses `ON CONFLICT DO NOTHING` — safe to re-run |
| Trigger guard missing → double fan-out | A7 test verifies exactly 1 outbox row per recipient |
| Fan-out helper EXCEPTION swallows message failure | EXCEPTION guards fan-out only; channel_message INSERT is outside the EXCEPTION block — message is committed regardless |
| External-tier abuse for non-critical content | Telemetry tracks `tier_overridden:true`; no DB constraint (operator judgment call) |
| Inline staff_event create → orphan event on publish failure | Operator sees event in calendar, can retry announcement or delete event |
| `policy_update` kind without policy module capability | Capability unit test T2 asserts Zod refine; composer hides kind if no policies exist |
| M6 delayed → mobile shows no kind/tier UI | Track C is gated on M6; mobile gracefully degrades (no TierBadge / EntityLinkCTA rendered) |

---

## §20 — References

- V1 spec (rejected): `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-18-announcement-kind-tier-link.md`
- ADR-0369: `docs/decisions/0369-announcement-atomicity-rpc-body-fanout.md`
- ADR-0370: `docs/decisions/0370-capability-boundary-for-announcement-surface.md`
- ADR-0371: `docs/decisions/0371-announcement-schema-contract-preserved.md`
- L-0312 (SET CONSTRAINTS does not defer triggers): `docs/learnings/0312-set-constraints-all-deferred-does-not-defer-triggers.md`
- L-0313 (ALTER TYPE grep): `docs/learnings/0313-phase-2-5-grep-must-search-alter-type-add-value.md`
- L-0314 (capability-key drift): `docs/learnings/0314-capability-key-drift-between-spec-pseudocode-and-router.md`
- L-0315 (callGateAction positional signature): `docs/learnings/0315-callgateaction-signature-positional-not-callback.md`
- Module overview: `docs/modules/announcments/MODULE_ANNOUNCEMENTS.md`
- ADR-0078 (voice-channel restrictions)
- ADR-0112 (intent-classifier same-commit lock)
- ADR-0133 (mobile surface boundary)
- ADR-0151 (forgeable IDs / server-side actor resolution)
- ADR-0157 (direct mutations vs server actions)
- ADR-0173 (capability namespace frozen-4)
- ADR-0204 (gatedMutation)
- ADR-0240 (cross-namespace write prohibition)
- ADR-0287 (gate_action mandatory)
- ADR-0358 (telemetry registry requires emit wiring)
- ADR-0361 (CSS variable declaration before component work)
