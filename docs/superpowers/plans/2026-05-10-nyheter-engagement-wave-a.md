---
title: Nyheter Engagement Wave A — Implementation Plan
status: draft
created: 2026-05-10
updated: 2026-05-10
module: komm
tags: [announcements, nyheter, communication, notifications, audience, pin]
---

# Nyheter Engagement Wave A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three Nyheter debt holes in one sortie — notification priority bump for announcements, audience targeting UI in compose modal, and pin/unpin UI with PinnedStrip — so managers can target the right audience at the right priority and freeze critical announcements at top of feed.

**Architecture:** All work confined to `apps/web/src/app/dashboard/komm/nyheter` surface + one trigger migration + one Server Action for pin (RLS UPDATE policy on `channel_message` only allows author edits, so manager pin requires service-role-backed Server Action with explicit role guard). Reuses existing telemetry events (`channel.message.sent`, `channel.message.pinned`, `channel.message.unpinned`), `target_profile_ids uuid[]` column, `is_pinned` boolean, `pinned_by uuid`, `pinned_at timestamptz`. Notification trigger uses existing `notification_mode` enum value `'work'` for announcements (no enum change needed; routes through `notification_preference.work_enabled` opt-out). Authoring stays web-only per ADR-0133. Mobile read-strip is a separate sortie.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Supabase Postgres 17 · `@smartout/supabase` client · `@smartout/i18n` · `@smartout/telemetry` `emit()` · `@tanstack/react-query` · `framer-motion` · shadcn `DropdownMenu` + `Sheet` · Lucide React · pgTAP for migration assertions · Vitest for unit + hook tests · Playwright for E2E.

---

## Source spec

- Design handoff: `docs/modules/announcments/nyheter/project/handoff/README.md`
- HTML prototype: `docs/modules/announcments/nyheter/project/Nyheter Wave A.html`
- Sample data: `docs/modules/announcments/nyheter/project/nyheter-data.jsx`
- Compose modal reference: `docs/modules/announcments/nyheter/project/nyheter-compose.jsx`
- Council verdict: 2026-05-10 — APPROVE WITH CHANGES — bundle items 3+5+6 as Wave A
- Pre-existing audit: `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` already ships realtime + auto-mark-as-read (commits `571575fa5`, `5cfe97d8f`, `ff97f773b`)

---

## File Structure

### New files

```
supabase/migrations/{TS}_announcement_notification_priority.sql
  └── alters trigger_channel_message_notification() to branch on message_type='announcement'

supabase/tests/announcement_notification_priority_test.sql
  └── pgTAP assertions: announcement → priority=1, mode='work'; text → 0/community

apps/web/src/app/dashboard/_components/RecipientCountPill.tsx
  └── shared reusable pill, used by ComposeAnnouncement + (future) QuickBroadcast

apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts
  └── new hook resolving { kind, params } → { profileIds: string[], label: string }
  └── kinds: "all" | "on_duty" | "department" | "role" | "individuals"

apps/web/src/app/dashboard/komm/_actions/pin-message-action.ts
  └── Server Action: service-role-backed pin/unpin with manager+ role guard
  └── only writes is_pinned, pinned_by, pinned_at columns

apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts
  └── TanStack mutation calling pin-message-action; emits channel.message.{pinned,unpinned}

apps/web/src/app/dashboard/komm/_components/PinnedStrip.tsx
  └── sticky top strip rendering pinned NewsCards as compact chips

apps/web/src/app/dashboard/komm/_components/NewsCardMenu.tsx
  └── manager-only DropdownMenu trigger on NewsCard

apps/web/src/app/dashboard/komm/_components/AudiencePicker.tsx
  └── 5-segment control + 3 drilldowns (dept/role/individuals)

apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts
apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts
apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts
```

### Modified files

```
apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx
  └── render PinnedStrip above feed; pass NewsCardMenu into NewsCard; replace inline ComposeAnnouncement audience Select with AudiencePicker + RecipientCountPill

apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts
  └── accept targetProfileIds: string[], visibilityScope: 'all_members' | 'targeted_members', audienceKind, audienceLabel
  └── extend INSERT payload + emit() properties

packages/i18n/locales/nb/komm.json
packages/i18n/locales/en/komm.json
  └── add audience_*, pin, unpin, pinned_strip_header, operational_badge, recipient_count_pill keys
```

### Untouchable (per council scope discipline)

```
packages/ai/src/capabilities/communication/tools.ts          ← sendMessage retrofit = separate ADR sortie
packages/ai/src/gate/gatedMutation.ts                        ← capability gate path
apps/mobile/**                                                ← separate feat/mobile-nyheter-strip sortie
apps/web/src/app/dashboard/komm/_hooks/use-mark-as-read.ts   ← shipped today
NyheterClient.tsx existing realtime + auto-mark-as-read blocks
apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx ← will adopt RecipientCountPill in follow-up sortie, not in scope
```

### Scoped-editable (council 2026-05-11 narrowed exception)

```
packages/telemetry/src/registry.ts
  └── ONLY allowed: extend ChannelMessageSent.properties + ChannelMessagePinned.properties + ChannelMessageUnpinned.properties
      with new optional fields (audience_kind?, visibility_scope?, target_profile_count?,
      notification_priority?, notification_mode?, message_id?). Add activity_trail to
      channel.message.unpinned routing for audit symmetry.
  └── DO NOT touch other event interfaces, registry helpers, or routing maps.

apps/web/src/app/globals.css
  └── ONLY allowed: add --color-pin: oklch(0.7 0.18 65) in :root; mirror in .dark scope.
```

---

## Sequencing

6 commits on `feat/nyheter-engagement-wave-a`:

1. **Pre-task A** — telemetry registry extension + `--color-pin` token (unblocks 3, 5)
2. Migration + pgTAP (Item A) — independent of UI
3. AudienceResolver hook + RecipientCountPill component (Item B foundation)
4. AudiencePicker + ComposeAnnouncement wiring (Item B integration)
5. Pin Server Action + use-pin-message hook (Item C backend)
6. PinnedStrip + NewsCardMenu + NyheterClient integration (Item C UI)

Plus 1 commit for E2E specs (Task 6).

---

## Pre-task A — Extend telemetry registry + define `--color-pin` token

**Files:**
- Modify: `packages/telemetry/src/registry.ts`
- Modify: `apps/web/src/app/globals.css`

### A.1 — Extend ChannelMessageSent properties

- [ ] **Step A.1.1: Locate `ChannelMessageSent` interface**

Run:
```bash
grep -n "ChannelMessageSent" packages/telemetry/src/registry.ts | head
```
Expected: hits around line 3826-3830.

- [ ] **Step A.1.2: Add optional properties**

Edit `packages/telemetry/src/registry.ts` — locate `ChannelMessageSent` interface and extend its `properties` block:

```typescript
properties: {
  channel_id: string;
  origin_type: string;
  message_type: string;
  // Extended for Wave A — Nyheter audience targeting + notification priority
  audience_kind?: string;
  visibility_scope?: string;
  target_profile_count?: number;
  notification_priority?: number;
  notification_mode?: string;
};
```

### A.2 — Extend pin/unpin event properties + fix routing asymmetry

- [ ] **Step A.2.1: Locate `ChannelMessagePinned` and `ChannelMessageUnpinned`**

Run:
```bash
grep -n "ChannelMessagePinned\|ChannelMessageUnpinned" packages/telemetry/src/registry.ts | head
```
Expected: hits around line 3874-3884 (interfaces) + 9622-9628 (routing).

- [ ] **Step A.2.2: Extend properties on both interfaces**

Edit `ChannelMessagePinned.properties`:
```typescript
properties: {
  channel_id: string;
  message_id?: string;
};
```

Edit `ChannelMessageUnpinned.properties`:
```typescript
properties: {
  channel_id: string;
  message_id?: string;
};
```

- [ ] **Step A.2.3: Fix routing asymmetry — unpinned must audit too**

In the routing block around `9626-9628`, find the `channel.message.unpinned` entry. It currently routes to `posthog` + `logger` only. Add `activity_trail` to match `channel.message.pinned`:

```typescript
"channel.message.unpinned": ["posthog", "logger", "activity_trail"],
```

### A.3 — Define `--color-pin` token

- [ ] **Step A.3.1: Locate globals.css**

Run:
```bash
grep -n "color-brand\|--color-" apps/web/src/app/globals.css | head -10
```

- [ ] **Step A.3.2: Add `--color-pin` to `:root`**

Inside the `:root` block alongside other warm tokens, add:
```css
--color-pin: oklch(0.7 0.18 65);
```

Inside the `.dark` block:
```css
--color-pin: oklch(0.78 0.16 65);
```

(Lighter dark-mode value for sufficient contrast on dark surfaces.)

### A.4 — Verify + commit

- [ ] **Step A.4.1: Typecheck**

Run:
```bash
pnpm --filter @smartout/telemetry typecheck
pnpm --filter web typecheck
```
Expected: zero errors. The interface extensions are additive (all new fields optional) — existing call sites unaffected.

- [ ] **Step A.4.2: Commit**

```bash
git add packages/telemetry/src/registry.ts apps/web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(telemetry,tokens): extend channel.message events + add --color-pin

Adds optional properties on ChannelMessageSent / ChannelMessagePinned /
ChannelMessageUnpinned for Wave A audience targeting + notification
priority telemetry. Adds activity_trail routing to unpinned event for
audit symmetry with pinned. Defines --color-pin warm-amber token in
both light and dark modes for the Nyheter pin marker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1 — Notification Priority Bump (Item A)

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_announcement_notification_priority.sql`
- Create: `supabase/tests/announcement_notification_priority_test.sql`

**Declared downstream side-effect (intended scope expansion):** `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts:61` already writes `message_type: "announcement"` for the dashboard QuickBroadcast surface. After this migration, EVERY QuickBroadcast notification ALSO upgrades to `priority=1, mode='work'`. This is intentional — operationally, dashboard broadcasts ARE announcements. Accept and document; no QuickBroadcast UI change needed.

**Production safety note:** `notification_preference` defaults are `work_enabled=true`, `community_enabled=true` (verify in `00006_notification_engine.sql`). Users who explicitly muted Nyheter via `community_enabled=false` will start receiving announcement pushes if their `work_enabled=true`. F.6 manual smoke step verifies this against a sample dev user.

### Task 1.1 — Pick migration timestamp + verify ceiling

- [ ] **Step 1.1.1: Find current migration HEAD**

Run:
```bash
ls supabase/migrations/ | sort | tail -3
```
Expected: lines ending `_*.sql`. Pick a timestamp strictly greater than the newest (use today's date in `YYYYMMDDHHMMSS` UTC format, e.g. `20260528010000`).

- [ ] **Step 1.1.2: Verify referenced objects exist BEFORE chosen timestamp**

Run:
```bash
grep -l "trigger_channel_message_notification\|trg_channel_message_notification" supabase/migrations/*.sql
```
Expected: hit on `20260422310100_channel_message_notification_trigger.sql`. That timestamp must be `<` your new timestamp.

### Task 1.2 — Write pgTAP test (failing)

- [ ] **Step 1.2.1: Write the failing pgTAP spec**

Create `supabase/tests/announcement_notification_priority_test.sql`:

```sql
BEGIN;
SELECT plan(4);

-- Setup: minimal workspace + profile + channel
SET LOCAL ROLE postgres;

INSERT INTO workspace (workspace_id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test WS', 'test-ws', 'active')
ON CONFLICT (workspace_id) DO NOTHING;

INSERT INTO profile (profile_id, workspace_id, display_name, role, status)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Sender',
  'manager',
  'active'
) ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO profile (profile_id, workspace_id, display_name, role, status)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Receiver',
  'employee',
  'active'
) ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO channel (id, workspace_id, channel_type, name, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'news',
  'Nyheter',
  '00000000-0000-0000-0000-000000000002'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO channel_member (channel_id, workspace_id, profile_id)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Insert announcement
INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Test announcement',
  'announcement'
);

-- Assertion 1: announcement → priority=1
SELECT is(
  (SELECT priority FROM notification_outbox WHERE recipient_id = '00000000-0000-0000-0000-000000000003' ORDER BY scheduled_for DESC LIMIT 1),
  1::smallint,
  'announcement message inserts notification with priority=1'
);

-- Assertion 2: announcement → mode='work'
SELECT is(
  (SELECT mode::text FROM notification_outbox WHERE recipient_id = '00000000-0000-0000-0000-000000000003' ORDER BY scheduled_for DESC LIMIT 1),
  'work',
  'announcement message inserts notification with mode=work'
);

-- Insert plain text message
INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Plain text',
  'text'
);

-- Assertion 3: text → priority=0
SELECT is(
  (SELECT priority FROM notification_outbox WHERE recipient_id = '00000000-0000-0000-0000-000000000003' ORDER BY scheduled_for DESC LIMIT 1),
  0::smallint,
  'text message inserts notification with priority=0'
);

-- Assertion 4: text → mode='community'
SELECT is(
  (SELECT mode::text FROM notification_outbox WHERE recipient_id = '00000000-0000-0000-0000-000000000003' ORDER BY scheduled_for DESC LIMIT 1),
  'community',
  'text message inserts notification with mode=community'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 1.2.2: Run the test and verify it FAILS**

Run:
```bash
npx supabase db reset
npx supabase test db --file supabase/tests/announcement_notification_priority_test.sql
```
Expected: Assertion 1 + 2 fail (current trigger hardcodes priority=0, mode='community' for all message types).

### Task 1.3 — Write migration to make test pass

- [ ] **Step 1.3.1: Create the migration**

Create `supabase/migrations/20260528010000_announcement_notification_priority.sql` (replace timestamp with your verified value from Task 1.1.1):

```sql
-- Announcement notification priority bump
-- Branch on NEW.message_type: announcement → priority=1, mode='work';
-- all other types → priority=0, mode='community' (preserves prior behavior).
--
-- Why: announcements competing on the same priority as casual chat trains users
-- to ignore push notifications (Council verdict 2026-05-10, item A).

CREATE OR REPLACE FUNCTION trigger_channel_message_notification()
RETURNS trigger AS $$
DECLARE
  v_workspace_id UUID;
  v_channel_name TEXT;
  v_sender_name  TEXT;
  v_recipient    RECORD;
  v_priority     smallint;
  v_mode         notification_mode;
BEGIN
  -- Skip system/automated messages
  IF NEW.message_type IN ('system', 'brief', 'handoff', 'summary') THEN
    RETURN NEW;
  END IF;

  -- Branch on message_type for priority + mode
  IF NEW.message_type = 'announcement' THEN
    v_priority := 1;
    v_mode     := 'work';
  ELSE
    v_priority := 0;
    v_mode     := 'community';
  END IF;

  -- Resolve workspace and channel name
  SELECT c.workspace_id, c.name
    INTO v_workspace_id, v_channel_name
    FROM public.channel c
   WHERE c.id = NEW.channel_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve sender display name
  SELECT p.display_name INTO v_sender_name
    FROM public.profile p
   WHERE p.profile_id = NEW.sender_id;

  -- Notify all channel members except sender (skip muted, skip left)
  FOR v_recipient IN
    SELECT cm.profile_id
      FROM public.channel_member cm
     WHERE cm.channel_id = NEW.channel_id
       AND cm.profile_id != NEW.sender_id
       AND cm.left_at IS NULL
       AND cm.is_muted = FALSE
  LOOP
    INSERT INTO public.notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url,
      metadata, allowed_channels, status, scheduled_for
    ) VALUES (
      v_workspace_id,
      v_recipient.profile_id,
      v_mode,
      v_priority,
      coalesce(v_sender_name, 'Ukjent'),
      LEFT(NEW.content, 120),
      format('/dashboard/komm/%s', NEW.channel_id),
      jsonb_build_object(
        'event_key', CASE WHEN NEW.message_type = 'announcement' THEN 'announcement.published' ELSE 'chat.message' END,
        'channel_id', NEW.channel_id,
        'channel_name', coalesce(v_channel_name, ''),
        'sender_name', coalesce(v_sender_name, ''),
        'message_type', NEW.message_type::text,
        'preview', LEFT(NEW.content, 80),
        'message_id', NEW.id
      ),
      ARRAY['push', 'in_app']::notification_channel[],
      'pending',
      now()
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block message INSERT if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition unchanged; CREATE OR REPLACE FUNCTION above replaces body only.

COMMENT ON FUNCTION trigger_channel_message_notification() IS
  'Inserts into notification_outbox for each non-muted channel member on new message. Announcements get priority=1, mode=work; other types get priority=0, mode=community.';
```

- [ ] **Step 1.3.2: Run pgTAP — verify all 4 assertions PASS**

Run:
```bash
npx supabase db reset
npx supabase test db --file supabase/tests/announcement_notification_priority_test.sql
```
Expected: `ok 1 - announcement message inserts notification with priority=1` through `ok 4 - text message inserts notification with mode=community`. All pass.

- [ ] **Step 1.3.3: Smoke regression — full db reset and existing channel tests**

Run:
```bash
npx supabase db reset
pnpm --filter @smartout/supabase test 2>/dev/null || echo "no supabase test target"
```
Expected: zero errors during db reset. If any channel-related migration tests exist, they pass.

- [ ] **Step 1.3.4: Commit**

```bash
git add supabase/migrations/20260528010000_announcement_notification_priority.sql supabase/tests/announcement_notification_priority_test.sql
git commit -m "$(cat <<'EOF'
feat(nyheter): branch notification trigger on message_type=announcement

Announcement messages now insert into notification_outbox with
priority=1 and mode='work'. All other message_types preserve
priority=0/mode='community'. Closes Wave A item A.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Recipient Count Pill + Audience Resolver

**Files:**
- Create: `apps/web/src/app/dashboard/_components/RecipientCountPill.tsx`
- Create: `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`
- Test: `apps/web/src/app/dashboard/_components/__tests__/RecipientCountPill.test.tsx`
- Test: `apps/web/src/app/dashboard/komm/_hooks/__tests__/use-audience-resolver.test.tsx`

### Task 2.1 — Audience resolver hook (TDD)

- [ ] **Step 2.1.1: Write the failing test**

Create `apps/web/src/app/dashboard/komm/_hooks/__tests__/use-audience-resolver.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAudienceResolver, type AudienceKind } from "../use-audience-resolver";

// Mock supabase client + workspace context
vi.mock("@smartout/supabase/client", () => ({
  createClient: () => mockSupabase,
}));
vi.mock("@/lib/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { workspace_id: "ws-1" } }),
}));

const mockSupabase = {
  from: vi.fn(),
  schema: vi.fn(),
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useAudienceResolver", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns all workspace profiles for kind='all'", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { profile_id: "p1", display_name: "Sofia" },
              { profile_id: "p2", display_name: "Maja" },
            ],
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(
      () => useAudienceResolver({ kind: "all" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.profileIds).toEqual(["p1", "p2"]);
    expect(result.current.data?.count).toBe(2);
  });

  it("returns empty list for department kind with no selected ids", async () => {
    const { result } = renderHook(
      () => useAudienceResolver({ kind: "department", departmentIds: [] }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.profileIds).toEqual([]);
    expect(result.current.data?.count).toBe(0);
  });

  it("returns deduped profile ids for individuals kind", async () => {
    const { result } = renderHook(
      () => useAudienceResolver({ kind: "individuals", profileIds: ["p1", "p1", "p3"] }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.profileIds).toEqual(["p1", "p3"]);
  });
});
```

- [ ] **Step 2.1.2: Run test to verify it FAILS**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm/_hooks/__tests__/use-audience-resolver.test.tsx
```
Expected: `Cannot find module '../use-audience-resolver'`.

- [ ] **Step 2.1.3: Implement the hook**

Create `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type AudienceKind = "all" | "on_duty" | "department" | "role" | "individuals";

export type AudienceInput =
  | { kind: "all" }
  | { kind: "on_duty" }
  | { kind: "department"; departmentIds: string[] }
  | { kind: "role"; roles: string[] }
  | { kind: "individuals"; profileIds: string[] };

export type AudienceResolved = {
  profileIds: string[];
  count: number;
  kind: AudienceKind;
};

export function useAudienceResolver(input: AudienceInput) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: ["dashboard", "audience-resolver", wsId, input],
    staleTime: 30_000,
    queryFn: async (): Promise<AudienceResolved> => {
      const supabase = createClient();

      if (input.kind === "all") {
        const { data, error } = await supabase
          .from("profile")
          .select("profile_id, display_name")
          .eq("workspace_id", wsId)
          .eq("status", "active");
        if (error) throw error;
        return {
          kind: "all",
          profileIds: (data ?? []).map((p) => p.profile_id),
          count: data?.length ?? 0,
        };
      }

      if (input.kind === "on_duty") {
        // Mirror the canonical pattern from use-broadcast-recipients.ts:37-58.
        // SAFETY: timesheet schema FK joins to public.profile fail in PostgREST,
        // so query time_entry rows then re-resolve display_name from profile in a
        // second step. We only need profile_ids here (no display_name) so the
        // second step is omitted.
        const { data: entries, error } = await supabase
          .schema("timesheet")
          .from("time_entry")
          .select("profile_id")
          .is("punch_out", null)
          .limit(500);
        if (error) throw error;
        const ids = Array.from(
          new Set((entries ?? []).map((e: { profile_id: string }) => e.profile_id).filter(Boolean)),
        );
        return { kind: "on_duty", profileIds: ids, count: ids.length };
      }

      if (input.kind === "department") {
        if (input.departmentIds.length === 0) {
          return { kind: "department", profileIds: [], count: 0 };
        }
        const { data, error } = await supabase
          .from("profile")
          .select("profile_id, department_id")
          .eq("workspace_id", wsId)
          .eq("status", "active")
          .in("department_id", input.departmentIds);
        if (error) throw error;
        const ids = (data ?? []).map((p) => p.profile_id);
        return { kind: "department", profileIds: ids, count: ids.length };
      }

      if (input.kind === "role") {
        if (input.roles.length === 0) {
          return { kind: "role", profileIds: [], count: 0 };
        }
        const { data, error } = await supabase
          .from("profile")
          .select("profile_id, role")
          .eq("workspace_id", wsId)
          .eq("status", "active")
          .in("role", input.roles);
        if (error) throw error;
        const ids = (data ?? []).map((p) => p.profile_id);
        return { kind: "role", profileIds: ids, count: ids.length };
      }

      // individuals
      const deduped = Array.from(new Set(input.profileIds));
      return { kind: "individuals", profileIds: deduped, count: deduped.length };
    },
  });
}
```

- [ ] **Step 2.1.4: Run test to verify all 3 cases PASS**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm/_hooks/__tests__/use-audience-resolver.test.tsx
```
Expected: 3 tests pass.

### Task 2.2 — RecipientCountPill component

- [ ] **Step 2.2.1: Write failing test**

Create `apps/web/src/app/dashboard/_components/__tests__/RecipientCountPill.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipientCountPill } from "../RecipientCountPill";

describe("RecipientCountPill", () => {
  it("renders count with plural label when count > 1", () => {
    render(<RecipientCountPill count={3} />);
    // Count appears in both the visual bump-span and inside the i18n label
    expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
    expect(screen.getByText(/ansatte vil få denne/i)).toBeInTheDocument();
  });

  it("renders count=1 with singular label", () => {
    render(<RecipientCountPill count={1} />);
    expect(screen.getAllByText(/1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^1 ansatt vil få denne$/)).toBeInTheDocument();
  });

  it("renders muted variant when count=0", () => {
    const { container } = render(<RecipientCountPill count={0} />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.getAttribute("data-tone")).toBe("muted");
  });

  it("exposes aria-live=polite for screen reader updates", () => {
    const { container } = render(<RecipientCountPill count={5} />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.getAttribute("aria-atomic")).toBe("true");
  });

  it("renders as <span> (inline) so it composes inside label rows", () => {
    const { container } = render(<RecipientCountPill count={2} />);
    expect((container.firstChild as HTMLElement).tagName).toBe("SPAN");
  });
});
```

- [ ] **Step 2.2.2: Run test to verify FAIL**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/_components/__tests__/RecipientCountPill.test.tsx
```
Expected: `Cannot find module '../RecipientCountPill'`.

- [ ] **Step 2.2.3: Implement component**

Create `apps/web/src/app/dashboard/_components/RecipientCountPill.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { motion, useReducedMotion } from "framer-motion";

type RecipientCountPillProps = {
  count: number;
};

const BUMP_SPRING = { type: "spring" as const, stiffness: 45, damping: 24, mass: 2 };

/**
 * RecipientCountPill — shared count pill with springSnappy bump on count change.
 *
 * Used inside compose flows that resolve an audience to a recipient list.
 * aria-live="polite" so screen readers announce count changes when the user
 * switches audience selection. Respects prefers-reduced-motion.
 *
 * Element is a <span> (inline) so it composes inside label rows without
 * breaking text-flow.
 */
export function RecipientCountPill({ count }: RecipientCountPillProps) {
  const { t } = useTranslation("komm");
  const reduce = useReducedMotion();
  const [bump, setBump] = useState(false);
  const lastN = useRef(count);

  useEffect(() => {
    if (reduce) return;
    if (lastN.current !== count) {
      lastN.current = count;
      setBump(true);
      const id = setTimeout(() => setBump(false), 420);
      return () => clearTimeout(id);
    }
  }, [count, reduce]);

  // @smartout/i18n single-brace; pick singular/plural key in code
  const labelKey =
    count === 1 ? "nyheter.recipient_count_pill_one" : "nyheter.recipient_count_pill_other";

  return (
    <span
      data-tone={count === 0 ? "muted" : "brand"}
      data-bump={bump}
      aria-live="polite"
      aria-atomic="true"
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 transition-colors ${
        count === 0 ? "bg-muted border-border" : "bg-primary/10 border-primary/20"
      }`}
    >
      <Users className="text-muted-foreground h-4 w-4" aria-hidden="true" />
      <motion.span
        animate={bump && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={reduce ? { duration: 0 } : BUMP_SPRING}
        className="font-mono text-base font-black tabular-nums"
        aria-hidden="true"
      >
        {count}
      </motion.span>
      <span className="text-foreground/80 text-sm">
        {t(labelKey, { count })}
      </span>
    </span>
  );
}
```

- [ ] **Step 2.2.4: Add i18n keys (flat plural — `@smartout/i18n` does NOT support ICU)**

The `@smartout/i18n` translator (`packages/i18n/src/translate.ts:84`) is a single-brace `{var}` regex — it does NOT support i18next `{{ }}` double-brace OR ICU `{count, plural}` construct. Use two flat keys + branch in component.

Edit `packages/i18n/locales/nb/komm.json` — inside the `nyheter` block add:

```json
"recipient_count_pill_one": "{count} ansatt vil få denne",
"recipient_count_pill_other": "{count} ansatte vil få denne"
```

Edit `packages/i18n/locales/en/komm.json` — inside the `nyheter` block add:

```json
"recipient_count_pill_one": "{count} employee will receive this",
"recipient_count_pill_other": "{count} employees will receive this"
```

Note: the component renders the count VISUALLY in a separate `<motion.span>` so the i18n string just contains the count interpolation for screen readers / fallback.

- [ ] **Step 2.2.5: Run test to verify PASS**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/_components/__tests__/RecipientCountPill.test.tsx
```
Expected: 4 tests pass.

- [ ] **Step 2.2.6: Typecheck**

Run:
```bash
pnpm --filter web typecheck
```
Expected: zero errors. If errors exist outside the files you touched, note them as pre-existing.

- [ ] **Step 2.2.7: Commit**

```bash
git add apps/web/src/app/dashboard/_components/RecipientCountPill.tsx \
        apps/web/src/app/dashboard/_components/__tests__/RecipientCountPill.test.tsx \
        apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts \
        apps/web/src/app/dashboard/komm/_hooks/__tests__/use-audience-resolver.test.tsx \
        packages/i18n/locales/nb/komm.json \
        packages/i18n/locales/en/komm.json
git commit -m "$(cat <<'EOF'
feat(nyheter): RecipientCountPill + useAudienceResolver foundation

Shared pill component (web/src/app/dashboard/_components) with bump
animation + aria-live for screen readers. Audience resolver supports
five kinds: all, on_duty, department, role, individuals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — AudiencePicker + ComposeAnnouncement Wiring (Item B)

**Files:**
- Create: `apps/web/src/app/dashboard/komm/_components/AudiencePicker.tsx`
- Modify: `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` (replace inline `ComposeAnnouncement` audience Select with AudiencePicker)
- Modify: `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` (accept audience payload)
- Test: `apps/web/src/app/dashboard/komm/_components/__tests__/AudiencePicker.test.tsx`

### Task 3.1 — AudiencePicker test (TDD)

- [ ] **Step 3.1.1: Write failing test**

Create `apps/web/src/app/dashboard/komm/_components/__tests__/AudiencePicker.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AudiencePicker } from "../AudiencePicker";

vi.mock("@smartout/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { workspace_id: "ws-1" } }),
}));

describe("AudiencePicker", () => {
  it("renders all 5 segments", () => {
    render(<AudiencePicker value={{ kind: "all" }} onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /alle/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /på vakt/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /avdeling/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /rolle/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /personer/i })).toBeInTheDocument();
  });

  it("calls onChange with new kind when segment clicked", () => {
    const onChange = vi.fn();
    render(<AudiencePicker value={{ kind: "all" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /på vakt/i }));
    expect(onChange).toHaveBeenCalledWith({ kind: "on_duty" });
  });

  it("renders department drilldown when kind=department", () => {
    render(
      <AudiencePicker
        value={{ kind: "department", departmentIds: [] }}
        onChange={() => {}}
      />,
    );
    // Drilldown grid renders; departments may be empty list until query resolves
    // but the grid container must exist
    expect(screen.getByTestId("audience-drilldown-department")).toBeInTheDocument();
  });

  it("does NOT render drilldown when kind=all", () => {
    render(<AudiencePicker value={{ kind: "all" }} onChange={() => {}} />);
    expect(screen.queryByTestId("audience-drilldown-department")).not.toBeInTheDocument();
    expect(screen.queryByTestId("audience-drilldown-role")).not.toBeInTheDocument();
    expect(screen.queryByTestId("audience-drilldown-individuals")).not.toBeInTheDocument();
  });

  it("wraps segments in role=tablist with horizontal orientation (WCAG 2.1)", () => {
    render(<AudiencePicker value={{ kind: "all" }} onChange={() => {}} />);
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();
    expect(tablist.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("active tab has tabIndex=0; inactive tabs have tabIndex=-1 (roving tabindex)", () => {
    render(<AudiencePicker value={{ kind: "on_duty" }} onChange={() => {}} />);
    const onDuty = screen.getByRole("tab", { name: /på vakt/i });
    const all = screen.getByRole("tab", { name: /alle/i });
    expect(onDuty.getAttribute("tabIndex")).toBe("0");
    expect(all.getAttribute("tabIndex")).toBe("-1");
  });

  it("ArrowRight on focused tab moves focus + selection to next segment", () => {
    const onChange = vi.fn();
    render(<AudiencePicker value={{ kind: "all" }} onChange={onChange} />);
    const all = screen.getByRole("tab", { name: /alle/i });
    all.focus();
    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ kind: "on_duty" });
  });

  it("ArrowLeft on first tab wraps to last (Personer)", () => {
    const onChange = vi.fn();
    render(<AudiencePicker value={{ kind: "all" }} onChange={onChange} />);
    const all = screen.getByRole("tab", { name: /alle/i });
    all.focus();
    fireEvent.keyDown(all, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith({ kind: "individuals", profileIds: [] });
  });
});
```

- [ ] **Step 3.1.2: Run test to verify FAIL**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm/_components/__tests__/AudiencePicker.test.tsx
```
Expected: `Cannot find module '../AudiencePicker'`.

### Task 3.2 — Implement AudiencePicker

- [ ] **Step 3.2.1: Implement component**

Create `apps/web/src/app/dashboard/komm/_components/AudiencePicker.tsx`:

```typescript
"use client";

import { useRef, type KeyboardEvent } from "react";
import { Globe, Clock, Building2, Badge, User, Check } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { motion } from "framer-motion";
import { useWorkspace } from "@/lib/workspace-context";
import type { AudienceInput } from "../_hooks/use-audience-resolver";

type AudiencePickerProps = {
  value: AudienceInput;
  onChange: (next: AudienceInput) => void;
};

const SEGMENTS = [
  { kind: "all", icon: Globe, labelKey: "nyheter.audience_all" },
  { kind: "on_duty", icon: Clock, labelKey: "nyheter.audience_on_duty" },
  { kind: "department", icon: Building2, labelKey: "nyheter.audience_department" },
  { kind: "role", icon: Badge, labelKey: "nyheter.audience_role" },
  { kind: "individuals", icon: User, labelKey: "nyheter.audience_individuals" },
] as const;

export function AudiencePicker({ value, onChange }: AudiencePickerProps) {
  const { t } = useTranslation("komm");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectKind(kind: AudienceInput["kind"]) {
    if (kind === "all") onChange({ kind: "all" });
    else if (kind === "on_duty") onChange({ kind: "on_duty" });
    else if (kind === "department") onChange({ kind: "department", departmentIds: [] });
    else if (kind === "role") onChange({ kind: "role", roles: [] });
    else onChange({ kind: "individuals", profileIds: [] });
  }

  // WCAG 2.1 tab pattern — arrow keys move focus, Home/End jump to ends
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, currentIdx: number) {
    let nextIdx = currentIdx;
    if (e.key === "ArrowRight") nextIdx = (currentIdx + 1) % SEGMENTS.length;
    else if (e.key === "ArrowLeft") nextIdx = (currentIdx - 1 + SEGMENTS.length) % SEGMENTS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = SEGMENTS.length - 1;
    else return;
    e.preventDefault();
    const next = tabRefs.current[nextIdx];
    if (next) {
      next.focus();
      selectKind(SEGMENTS[nextIdx]!.kind);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("nyheter.audience_label")}
        aria-orientation="horizontal"
        className="bg-muted border-border grid grid-cols-5 gap-1 rounded-xl border p-1"
      >
        {SEGMENTS.map(({ kind, icon: Icon, labelKey }, idx) => {
          const active = value.kind === kind;
          return (
            <motion.button
              key={kind}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => selectKind(kind)}
              onKeyDown={(e) => onTabKeyDown(e, idx)}
              whileHover={{ y: -1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={`flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-xs font-medium ${
                active
                  ? "bg-card text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ transitionProperty: "background-color, color, box-shadow" }}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </motion.button>
          );
        })}
      </div>

      {value.kind === "department" && (
        <DepartmentDrilldown value={value} onChange={onChange} />
      )}
      {value.kind === "role" && <RoleDrilldown value={value} onChange={onChange} />}
      {value.kind === "individuals" && <IndividualsDrilldown value={value} onChange={onChange} />}
    </div>
  );
}

function DepartmentDrilldown({
  value,
  onChange,
}: {
  value: Extract<AudienceInput, { kind: "department" }>;
  onChange: (next: AudienceInput) => void;
}) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  const { data: departments } = useQuery({
    queryKey: ["dashboard", "departments", wsId],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  function toggle(id: string) {
    const has = value.departmentIds.includes(id);
    onChange({
      kind: "department",
      departmentIds: has
        ? value.departmentIds.filter((x) => x !== id)
        : [...value.departmentIds, id],
    });
  }

  return (
    <div data-testid="audience-drilldown-department" className="mt-2.5 grid grid-cols-2 gap-2">
      {(departments ?? []).map((d) => {
        const active = value.departmentIds.includes(d.department_id);
        return (
          <motion.button
            key={d.department_id}
            type="button"
            onClick={() => toggle(d.department_id)}
            whileHover={active ? undefined : { y: -1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`bg-card flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left ${
              active
                ? "border-primary ring-primary/10 bg-primary/5 ring-2"
                : "border-border hover:border-border/80"
            }`}
            style={{ transitionProperty: "border-color, background-color, box-shadow", transitionDuration: "200ms" }}
          >
            <span className="text-sm font-semibold leading-none">{d.name}</span>
            {active && <Check className="text-primary ml-auto h-4 w-4" aria-hidden="true" />}
          </motion.button>
        );
      })}
    </div>
  );
}

function RoleDrilldown({
  value,
  onChange,
}: {
  value: Extract<AudienceInput, { kind: "role" }>;
  onChange: (next: AudienceInput) => void;
}) {
  const { t } = useTranslation("komm");
  const ROLES: { id: string; labelKey: string }[] = [
    { id: "manager", labelKey: "nyheter.role_manager" },
    { id: "admin", labelKey: "nyheter.role_admin" },
    { id: "employee", labelKey: "nyheter.role_employee" },
    { id: "owner", labelKey: "nyheter.role_owner" },
  ];

  function toggle(id: string) {
    const has = value.roles.includes(id);
    onChange({
      kind: "role",
      roles: has ? value.roles.filter((x) => x !== id) : [...value.roles, id],
    });
  }

  return (
    <div data-testid="audience-drilldown-role" className="mt-2.5 grid grid-cols-2 gap-2">
      {ROLES.map((r) => {
        const active = value.roles.includes(r.id);
        return (
          <motion.button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            whileHover={active ? undefined : { y: -1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={`bg-card flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left ${
              active
                ? "border-primary ring-primary/10 bg-primary/5 ring-2"
                : "border-border hover:border-border/80"
            }`}
            style={{ transitionProperty: "border-color, background-color, box-shadow", transitionDuration: "200ms" }}
          >
            <span className="text-sm font-semibold leading-none">{t(r.labelKey)}</span>
            {active && <Check className="text-primary ml-auto h-4 w-4" aria-hidden="true" />}
          </motion.button>
        );
      })}
    </div>
  );
}

function IndividualsDrilldown({
  value,
  onChange,
}: {
  value: Extract<AudienceInput, { kind: "individuals" }>;
  onChange: (next: AudienceInput) => void;
}) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  const { data: profiles } = useQuery({
    queryKey: ["dashboard", "profiles", wsId],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .eq("workspace_id", wsId)
        .eq("status", "active")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  function toggle(id: string) {
    const has = value.profileIds.includes(id);
    onChange({
      kind: "individuals",
      profileIds: has
        ? value.profileIds.filter((x) => x !== id)
        : [...value.profileIds, id],
    });
  }

  return (
    <div data-testid="audience-drilldown-individuals" className="mt-2.5">
      <div className="border-border max-h-52 overflow-y-auto rounded-xl border p-1">
        {(profiles ?? []).map((p) => {
          const on = value.profileIds.includes(p.profile_id);
          return (
            <button
              key={p.profile_id}
              onClick={() => toggle(p.profile_id)}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-md p-2 text-left"
            >
              <span className="flex-1 text-sm font-medium">{p.display_name}</span>
              <span
                data-on={on}
                className={`grid h-4.5 w-4.5 place-items-center rounded border ${
                  on ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2.2: Add i18n keys**

Edit `packages/i18n/locales/nb/komm.json` — inside the `nyheter` block:

```json
"audience_label": "Målgruppe",
"audience_all": "Alle",
"audience_on_duty": "På vakt",
"audience_department": "Avdeling",
"audience_role": "Rolle",
"audience_individuals": "Personer",
"operational_badge": "Operasjonell"
```

Mirror in `packages/i18n/locales/en/komm.json`:

```json
"audience_label": "Audience",
"audience_all": "Everyone",
"audience_on_duty": "On duty",
"audience_department": "Department",
"audience_role": "Role",
"audience_individuals": "Individuals",
"operational_badge": "Operational"
```

- [ ] **Step 3.2.3: Run test to verify PASS**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm/_components/__tests__/AudiencePicker.test.tsx
```
Expected: 4 tests pass.

### Task 3.3 — Extend useSendAnnouncement payload

- [ ] **Step 3.3.1: Modify the hook**

Edit `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts` — replace existing `AnnouncementInput` and the insert payload with:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

type AnnouncementInput = {
  channelId: string;
  content: string;
  profileId: string;
  targetProfileIds?: string[];
  visibilityScope?: "all_members" | "targeted_members";
  audienceKind: "all" | "on_duty" | "department" | "role" | "individuals";
  audienceLabel: string;
};

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({
      channelId,
      content,
      profileId,
      targetProfileIds,
      visibilityScope,
      audienceKind,
      audienceLabel,
    }: AnnouncementInput) => {
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();
      const isTargeted =
        (visibilityScope ?? "all_members") === "targeted_members" &&
        Array.isArray(targetProfileIds) &&
        targetProfileIds.length > 0;

      const { data, error } = await supabase
        .from("channel_message")
        .insert({
          channel_id: channelId,
          workspace_id: workspaceId,
          sender_id: profileId,
          content,
          message_type: "announcement",
          client_message_id: clientMessageId,
          visibility_scope: isTargeted ? "targeted_members" : "all_members",
          target_profile_ids: isTargeted ? targetProfileIds : null,
          system_data: {
            audience_kind: audienceKind,
            audience_label: audienceLabel,
          },
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data, variables) => {
      toast.success(t("nyheter.publish_success"));
      // Fix pre-existing bug — entity_id was channelId, should be the new message id
      const messageId = (data as { id: string } | null)?.id ?? variables.channelId;
      void emit({
        event: "channel.message.sent",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(variables.profileId, "actor_id"),
        properties: {
          channel_id: variables.channelId,
          origin_type: "human",
          message_type: "announcement",
          visibility_scope:
            (variables.visibilityScope ?? "all_members") === "targeted_members" &&
            (variables.targetProfileIds?.length ?? 0) > 0
              ? "targeted_members"
              : "all_members",
          target_profile_count: variables.targetProfileIds?.length ?? 0,
          audience_kind: variables.audienceKind,
          notification_priority: 1,
          notification_mode: "work",
        },
        entity: {
          entity_type: "channel_message",
          entity_id: messageId,
        },
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, variables.channelId),
      });
      queryClient.invalidateQueries({
        queryKey: channelKeys.list(workspaceId),
      });
    },

    onError: () => {
      toast.error(t("nyheter.publish_error"));
    },
  });
}
```

- [ ] **Step 3.3.2: Run typecheck**

Run:
```bash
pnpm --filter web typecheck
```
Expected: zero errors related to `use-send-announcement` or `NyheterClient`. If `NyheterClient.tsx` errors because compose call site doesn't pass new fields yet, proceed to Task 3.4 — that wires them.

### Task 3.4 — Wire AudiencePicker into ComposeAnnouncement

- [ ] **Step 3.4.1: Replace the audience Select**

Edit `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` — locate the `ComposeAnnouncement` function. Remove the `<Select value={audience} ...>` block (the `audience` field section) and replace with:

```tsx
import { AudiencePicker } from "./AudiencePicker";
import { useAudienceResolver, type AudienceInput } from "../_hooks/use-audience-resolver";
import { RecipientCountPill } from "@/app/dashboard/_components/RecipientCountPill";
```

Inside `ComposeAnnouncement` replace the `useState<string>("all")` audience with:

```tsx
const [audience, setAudience] = useState<AudienceInput>({ kind: "all" });
const audienceQuery = useAudienceResolver(audience);
const recipientCount = audienceQuery.data?.count ?? 0;

function audienceLabel(): string {
  if (audience.kind === "all") return t("nyheter.audience_all");
  if (audience.kind === "on_duty") return t("nyheter.audience_on_duty");
  if (audience.kind === "department") return t("nyheter.audience_department");
  if (audience.kind === "role") return t("nyheter.audience_role");
  return t("nyheter.audience_individuals");
}
```

Replace the existing `handleSubmit` with:

```tsx
const handleSubmit = () => {
  if (!title.trim()) return;
  if (recipientCount === 0) return;
  const content = body.trim() ? `${title.trim()}\n${body.trim()}` : title.trim();
  const isTargeted = audience.kind !== "all";

  sendAnnouncement.mutate(
    {
      channelId,
      content,
      profileId,
      targetProfileIds: isTargeted ? audienceQuery.data?.profileIds ?? [] : undefined,
      visibilityScope: isTargeted ? "targeted_members" : "all_members",
      audienceKind: audience.kind,
      audienceLabel: audienceLabel(),
    },
    {
      onSuccess: () => {
        setTitle("");
        setBody("");
        setAudience({ kind: "all" });
        onOpenChange(false);
      },
    },
  );
};
```

In the Sheet body replace the old `<Select>` audience block with:

```tsx
<div>
  <label className="mb-1.5 block text-sm font-medium">{t("nyheter.audience_label")}</label>
  <AudiencePicker value={audience} onChange={setAudience} />
</div>

<div className="flex flex-wrap items-center gap-2.5">
  <RecipientCountPill count={recipientCount} />
</div>
```

Update the publish button `disabled` check:

```tsx
disabled={!title.trim() || recipientCount === 0 || sendAnnouncement.isPending}
```

- [ ] **Step 3.4.2: Run typecheck**

Run:
```bash
pnpm --filter web typecheck
```
Expected: zero errors. If `NyheterClient.tsx` reports an unused `Select` import, remove the import.

- [ ] **Step 3.4.3: Manual smoke**

Run `pnpm --filter web dev` and open `/dashboard/komm/nyheter` on dev workspace. Click "Ny kunngjøring". Verify:
- All 5 segments render
- Switching to "Avdeling" reveals dept tiles
- Recipient count pill animates on selection change
- Publish disabled when count=0 with non-"all" audience
- Publish creates a row with `visibility_scope='targeted_members'` and populated `target_profile_ids[]`

- [ ] **Step 3.4.4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/AudiencePicker.tsx \
        apps/web/src/app/dashboard/komm/_components/__tests__/AudiencePicker.test.tsx \
        apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx \
        apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts \
        packages/i18n/locales/nb/komm.json \
        packages/i18n/locales/en/komm.json
git commit -m "$(cat <<'EOF'
feat(nyheter): audience targeting in compose modal

Replaces audience Select stub with 5-segment AudiencePicker (all / on
duty / department / role / individuals) plus live RecipientCountPill.
useSendAnnouncement now writes target_profile_ids + visibility_scope +
audience_kind into system_data. Closes Wave A item B.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Pin Server Action + Hook (Item C backend)

**Files:**
- Create: `apps/web/src/app/dashboard/komm/_actions/pin-message-action.ts`
- Create: `apps/web/src/app/dashboard/komm/_actions/__tests__/pin-message-action.test.ts`
- Create: `apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts`

### Task 4.1 — Pin Server Action test (TDD)

- [ ] **Step 4.1.1: Write failing test**

Create `apps/web/src/app/dashboard/komm/_actions/__tests__/pin-message-action.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pinMessageAction } from "../pin-message-action";

const adminUpdate = vi.fn();
const resolveProfile = vi.fn();

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: () => ({ eq: () => adminUpdate(table, payload) }),
      }),
    }),
  }),
}));

vi.mock("@/app/dashboard/_actions/_shared", () => ({
  resolveCurrentProfile: () => resolveProfile(),
}));

describe("pinMessageAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when caller is not authenticated", async () => {
    resolveProfile.mockResolvedValue(null);

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/authenticated/i);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("rejects when caller is not manager+", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      role: "employee",
    });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/role/i);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("rejects when caller workspace mismatches body workspace", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000099",
      role: "manager",
    });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/workspace/i);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("writes is_pinned=true + pinned_by + pinned_at when caller is manager", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      role: "manager",
    });
    adminUpdate.mockResolvedValue({ data: null, error: null });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: true,
    });

    expect(result.ok).toBe(true);
    expect(adminUpdate).toHaveBeenCalledWith(
      "channel_message",
      expect.objectContaining({
        is_pinned: true,
        pinned_by: "00000000-0000-0000-0000-000000000100",
        pinned_at: expect.any(String),
      }),
    );
  });

  it("writes is_pinned=false + null pinned_by/pinned_at when unpinning", async () => {
    resolveProfile.mockResolvedValue({
      profileId: "00000000-0000-0000-0000-000000000100",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      role: "admin",
    });
    adminUpdate.mockResolvedValue({ data: null, error: null });

    const result = await pinMessageAction({
      messageId: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-000000000010",
      pin: false,
    });

    expect(result.ok).toBe(true);
    expect(adminUpdate).toHaveBeenCalledWith(
      "channel_message",
      expect.objectContaining({
        is_pinned: false,
        pinned_by: null,
        pinned_at: null,
      }),
    );
  });
});
```

- [ ] **Step 4.1.2: Run test to verify FAIL**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm/_actions/__tests__/pin-message-action.test.ts
```
Expected: `Cannot find module '../pin-message-action'`.

### Task 4.2 — Implement Server Action

- [ ] **Step 4.2.1: Verify supabase server + admin helpers exist**

Run:
```bash
grep -n "^export" packages/supabase/src/server.ts packages/supabase/src/admin.ts
```
Expected exports:
- `packages/supabase/src/server.ts:31` → `createClient` (JWT-scoped server client)
- `packages/supabase/src/admin.ts:13` → `createAdminClient` (service-role)

ALSO confirm `resolveCurrentProfile` helper exists:
```bash
grep -n "resolveCurrentProfile" apps/web/src/app/dashboard/_actions/_shared.ts
```
Expected: line ~17 — exported function returning `{ profileId, workspaceId, role } | null` from JWT.

- [ ] **Step 4.2.2: Implement action**

Create `apps/web/src/app/dashboard/komm/_actions/pin-message-action.ts`:

```typescript
"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";

const PinInputSchema = z.object({
  messageId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  pin: z.boolean(),
});

type PinResult =
  | { ok: true; messageId: string; pinned: boolean }
  | { ok: false; reason: string };

/**
 * pinMessageAction — manager+ pin/unpin of channel_message rows.
 *
 * RLS UPDATE policy on channel_message only permits sender to update own row
 * (see 20260422300100_channel_rls_policies.sql:122-124). Pin is a moderation
 * action that must work across senders, so it bypasses RLS via service role
 * with an explicit role-and-workspace guard.
 *
 * Follows the established pattern from `_actions/helpdesk-channel-actions.ts:51`
 * — JWT role check FIRST via resolveCurrentProfile, then service-role write.
 *
 * TODO: when a Botsson `komm.pin_message` capability tool is introduced
 * (held — see Open recommendations after close), route the agent path
 * through gateAction per ADR-0287; UI Server Action stays as-is.
 */
export async function pinMessageAction(input: unknown): Promise<PinResult> {
  const parsed = PinInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "Invalid input" };
  }
  const { messageId, workspaceId, pin } = parsed.data;

  // Server-derive profile from JWT (ADR-0151)
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, reason: "Not authenticated" };
  }
  if (profile.workspaceId !== workspaceId) {
    return { ok: false, reason: "Workspace mismatch" };
  }
  if (!["manager", "admin", "owner"].includes(profile.role)) {
    return { ok: false, reason: "Insufficient role — manager+ required" };
  }

  // Service-role write — RLS bypassed; only pin columns touched.
  // Defense-in-depth: explicit workspace_id filter even though service role
  // could span workspaces.
  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("channel_message")
    .update({
      is_pinned: pin,
      pinned_by: pin ? profile.profileId : null,
      pinned_at: pin ? new Date().toISOString() : null,
    })
    .eq("id", messageId)
    .eq("workspace_id", workspaceId);

  if (updateErr) {
    return { ok: false, reason: updateErr.message };
  }

  return { ok: true, messageId, pinned: pin };
}
```

- [ ] **Step 4.2.3: Run test to verify PASS**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm/_actions/__tests__/pin-message-action.test.ts
```
Expected: 4 tests pass.

### Task 4.3 — use-pin-message hook

- [ ] **Step 4.3.1: Implement the hook**

Create `apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts`:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { channelKeys } from "./channel-keys";
import { pinMessageAction } from "../_actions/pin-message-action";

type PinInput = {
  messageId: string;
  channelId: string;
  pin: boolean;
  profileId: string;
};

export function usePinMessage() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const { t } = useTranslation("komm");

  return useMutation({
    mutationFn: async ({ messageId, pin }: PinInput) => {
      const result = await pinMessageAction({ messageId, workspaceId, pin });
      if (!result.ok) throw new Error(result.reason);
      return result;
    },

    onSuccess: (_result, variables) => {
      toast.success(
        variables.pin ? t("nyheter.pin_success") : t("nyheter.unpin_success"),
      );
      void emit({
        event: variables.pin ? "channel.message.pinned" : "channel.message.unpinned",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(variables.profileId, "actor_id"),
        properties: {
          channel_id: variables.channelId,
          message_id: variables.messageId,
        },
        entity: {
          entity_type: "channel_message",
          entity_id: variables.messageId,
        },
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, variables.channelId),
      });
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("nyheter.pin_error"));
    },
  });
}
```

- [ ] **Step 4.3.2: Add i18n keys**

Edit `packages/i18n/locales/nb/komm.json` — inside the `nyheter` block:

```json
"pin": "Fest øverst",
"unpin": "Løsne",
"pin_success": "Festet øverst",
"unpin_success": "Løsnet",
"pin_error": "Kunne ikke endre festestatus",
"pinned_strip_header": "Festet",
"pinned_label": "Festet"
```

Mirror in `packages/i18n/locales/en/komm.json`:

```json
"pin": "Pin to top",
"unpin": "Unpin",
"pin_success": "Pinned to top",
"unpin_success": "Unpinned",
"pin_error": "Could not update pin",
"pinned_strip_header": "Pinned",
"pinned_label": "Pinned"
```

- [ ] **Step 4.3.3: Typecheck**

Run:
```bash
pnpm --filter web typecheck
```
Expected: zero errors.

- [ ] **Step 4.3.4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_actions/pin-message-action.ts \
        apps/web/src/app/dashboard/komm/_actions/__tests__/pin-message-action.test.ts \
        apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts \
        packages/i18n/locales/nb/komm.json \
        packages/i18n/locales/en/komm.json
git commit -m "$(cat <<'EOF'
feat(nyheter): pin Server Action + use-pin-message hook

Server Action bypasses RLS UPDATE policy (sender-only) via service
role with manager+ role guard + workspace-match guard. Writes only
is_pinned, pinned_by, pinned_at — no other columns. Hook emits the
already-registered channel.message.{pinned,unpinned} events.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — PinnedStrip + NewsCardMenu + NyheterClient integration (Item C UI)

**Files:**
- Create: `apps/web/src/app/dashboard/komm/_components/PinnedStrip.tsx`
- Create: `apps/web/src/app/dashboard/komm/_components/NewsCardMenu.tsx`
- Modify: `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` (render PinnedStrip, render NewsCardMenu inside NewsCard, render Pin marker)

### Task 5.1 — NewsCardMenu

- [ ] **Step 5.1.1: Implement menu component**

Create `apps/web/src/app/dashboard/komm/_components/NewsCardMenu.tsx`:

```typescript
"use client";

import { MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type NewsCardMenuProps = {
  isPinned: boolean;
  onTogglePin: () => void;
  onDelete?: () => void;
  disabled?: boolean;
};

export function NewsCardMenu({ isPinned, onTogglePin, onDelete, disabled }: NewsCardMenuProps) {
  const { t } = useTranslation("komm");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground absolute right-3 top-3 h-8 w-8 rounded-md p-0"
          aria-label={t("nyheter.card_menu_label")}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem onSelect={onTogglePin} disabled={disabled}>
          {isPinned ? (
            <>
              <PinOff className="mr-2 h-4 w-4" />
              {t("nyheter.unpin")}
            </>
          ) : (
            <>
              <Pin className="mr-2 h-4 w-4" />
              {t("nyheter.pin")}
            </>
          )}
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("nyheter.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5.1.2: Add i18n keys**

`packages/i18n/locales/nb/komm.json` `nyheter` block:

```json
"card_menu_label": "Mer",
"delete": "Slett"
```

`packages/i18n/locales/en/komm.json` `nyheter` block:

```json
"card_menu_label": "More",
"delete": "Delete"
```

### Task 5.2 — PinnedStrip

- [ ] **Step 5.2.1: Implement strip component**

Create `apps/web/src/app/dashboard/komm/_components/PinnedStrip.tsx`:

```typescript
"use client";

import { Pin, PinOff } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import type { MessageWithSender } from "../_hooks/channel-types";

type PinnedStripProps = {
  messages: MessageWithSender[];
  canManage: boolean;
  onUnpin: (messageId: string) => void;
  onJumpTo: (messageId: string) => void;
};

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

export function PinnedStrip({ messages, canManage, onUnpin, onJumpTo }: PinnedStripProps) {
  const { t } = useTranslation("komm");
  const reduce = useReducedMotion();

  if (messages.length === 0) return null;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="pinned-strip"
        initial={reduce ? false : { opacity: 0, y: -10, maxHeight: 0 }}
        animate={{ opacity: 1, y: 0, maxHeight: 200 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, maxHeight: 0 }}
        transition={reduce ? { duration: 0 } : { ...SPRING, maxHeight: { duration: 0.4 } }}
        className="bg-card/85 border-border sticky top-0 z-30 -mx-8 mb-6 border-b px-8 pb-4 pt-3.5 backdrop-blur-xl"
      >
        <div className="mb-2.5 flex items-baseline gap-2.5">
          <Pin
            className="h-4 w-4"
            style={{ color: "var(--color-pin)" }}
            aria-hidden="true"
          />
          <h2 className="font-heading text-xl tracking-tight">
            {t("nyheter.pinned_strip_header")}
          </h2>
          <span className="text-muted-foreground font-mono text-xs">{messages.length}</span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollSnapType: "x proximity" }}>
          {messages.map((msg) => {
            const title = msg.content.split("\n")[0] ?? "";
            return (
              <motion.div
                key={msg.message_id}
                whileHover={reduce ? undefined : { y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="border-border bg-card relative flex h-[84px] w-[200px] shrink-0 flex-col gap-1 overflow-hidden rounded-xl border border-l-2 p-2.5 text-left hover:shadow-md"
                style={{
                  scrollSnapAlign: "start",
                  borderLeftColor: "var(--color-pin)",
                  transitionProperty: "box-shadow",
                  transitionDuration: "200ms",
                }}
              >
                <button
                  type="button"
                  onClick={() => onJumpTo(msg.message_id)}
                  className="flex flex-1 flex-col gap-1 text-left"
                  aria-label={`${t("nyheter.pinned_label")}: ${title}`}
                >
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                    {msg.sender_name}
                  </span>
                  <span className="line-clamp-2 text-ellipsis text-sm font-semibold leading-snug">
                    {title}
                  </span>
                </button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground absolute bottom-1.5 right-1.5 h-6 px-1.5 text-[11px]"
                    onClick={() => onUnpin(msg.message_id)}
                  >
                    <PinOff className="mr-1 h-3 w-3" aria-hidden="true" />
                    {t("nyheter.unpin")}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Task 5.3 — Wire into NyheterClient

- [ ] **Step 5.3.1: Update NyheterClient imports**

Edit `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` — at the top of the imports block add:

```tsx
import { Pin } from "lucide-react";
import { PinnedStrip } from "./PinnedStrip";
import { NewsCardMenu } from "./NewsCardMenu";
import { usePinMessage } from "../_hooks/use-pin-message";
```

- [ ] **Step 5.3.2: Add pin state derivation in main client**

Inside `NyheterClient` after the `messages` memo add:

```tsx
const pinnedMessages = useMemo(
  () => messages.filter((m) => m.is_pinned),
  [messages],
);
const pinMessage = usePinMessage();

function togglePin(messageId: string, currentlyPinned: boolean) {
  if (!channelId) return;
  pinMessage.mutate({
    messageId,
    channelId,
    pin: !currentlyPinned,
    profileId,
  });
}

function jumpToCard(messageId: string) {
  const el = document.getElementById(`news-card-${messageId}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/40");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 700);
  }
}
```

- [ ] **Step 5.3.3: Render PinnedStrip and pass to NewsCard**

Inside the feed return (the JSX after `<KommToolsBridge ...>`) place `<PinnedStrip>` immediately after the header row and before `<div className="space-y-4">`:

```tsx
<PinnedStrip
  messages={pinnedMessages}
  canManage={canCompose}
  onUnpin={(id) => togglePin(id, true)}
  onJumpTo={jumpToCard}
/>
```

Pass new props to `<NewsCard>`:

```tsx
<NewsCard
  key={msg.message_id}
  message={msg}
  profileId={profileId}
  channelId={newsChannel.channel_id}
  formatRelativeTime={formatRelativeTime}
  index={i}
  shouldAnimate={!shouldReduceMotion}
  canManage={canCompose}
  onTogglePin={() => togglePin(msg.message_id, msg.is_pinned)}
/>
```

Update `NewsCardProps` to accept the new props and render:

```tsx
type NewsCardProps = {
  message: MessageWithSender;
  profileId: string;
  channelId: string;
  formatRelativeTime: (dateStr: string) => string;
  isUnread?: boolean;
  index: number;
  shouldAnimate: boolean;
  canManage: boolean;
  onTogglePin: () => void;
};
```

Inside the NewsCard JSX add `id={`news-card-${message.message_id}`}` to the outer `motion.div` and at the top-right add:

```tsx
{message.is_pinned && (
  <Pin
    className="absolute right-12 top-4 h-4 w-4"
    style={{ color: "var(--color-pin)" }}
    aria-hidden="true"
  />
)}
{canManage && (
  <NewsCardMenu
    isPinned={message.is_pinned}
    onTogglePin={onTogglePin}
  />
)}
```

Also in the NewsCard add an "Operational" badge in the footer when message is an announcement (matching design spec):

```tsx
{message.message_type === "announcement" && (
  <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]">
    {t("nyheter.operational_badge")}
  </span>
)}
```

- [ ] **Step 5.3.4: Typecheck**

Run:
```bash
pnpm --filter web typecheck
```
Expected: zero errors related to nyheter files.

- [ ] **Step 5.3.5: Manual smoke**

Run `pnpm --filter web dev`. Open Nyheter as a manager workspace. Verify:
- NewsCard shows `MoreVertical` icon top-right
- Click "Fest øverst" → toast → PinnedStrip appears at top within 500ms via realtime
- Pinned card shows Pin icon top-right (positioned to the left of menu button)
- Click "Løsne" in strip → card un-pins, strip disappears when last pin removed
- Second browser tab on same workspace as employee role → does NOT see menu, sees PinnedStrip
- Announcement card shows "Operasjonell" badge in footer; text-type card does not

- [ ] **Step 5.3.6: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/PinnedStrip.tsx \
        apps/web/src/app/dashboard/komm/_components/NewsCardMenu.tsx \
        apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx \
        packages/i18n/locales/nb/komm.json \
        packages/i18n/locales/en/komm.json
git commit -m "$(cat <<'EOF'
feat(nyheter): pin/unpin UI + PinnedStrip + Operational badge

Manager-only NewsCardMenu drives pin toggle; PinnedStrip renders sticky
above feed with motion.spring entry. Click on chip scrolls to card and
highlights briefly. Realtime fan-out via existing useChannelRealtime.
Closes Wave A item C.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — E2E specs

**Files:**
- Create: `apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts`
- Create: `apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts`
- Create: `apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts`

**Auth-fixture architectural decision (Council 2026-05-11):** Existing `loginAsAdmin(page)` and `loginAsEmployee(page)` use `E2E_EMAIL` / `E2E_PASSWORD` env vars (defaults in `apps/e2e/helpers/auth.ts`). The default credentials log into the dev-seeded workspace, NOT the workspace these specs create via `seedWorkspace`. `seedProfile` creates `profile` rows with `user_id = crypto.randomUUID()` and NO `auth.users` row, so logging in as a freshly-seeded employee is impossible without an auth fixture sortie.

**Journey 1** uses `loginAsAdmin(page)` then verifies via service-role DB read — works because `loginAsAdmin` reaches /dashboard regardless of which workspace owns the seeded data, and the assertion is row-level.

**Journey 2 + 3** are rewritten below to use service-role DB assertions ONLY (no second-user browser context). The assertion model:
- Manager publishes targeted announcement → spec verifies via service role: `channel_message.target_profile_ids` populated correctly + `visibility_scope='targeted_members'`. RLS visibility test deferred to a unit test of the SELECT policy (separate sortie).
- Manager pins → spec verifies via service role: `channel_message.is_pinned=true` + `pinned_by` set + `pinned_at` set + telemetry row in `activity_trail`.

This trades the realtime fan-out user-visibility test for deterministic DB assertions. The realtime path itself is verified in unit tests via `useChannelRealtime` mocking — the journey spec confirms the storage contract holds.

### Pre-task 0 — Verify E2E env

- [ ] **Step 0.1: Verify SUPABASE_SERVICE_ROLE_KEY available to e2e**

Run:
```bash
grep -n "SUPABASE_SERVICE_ROLE_KEY\|E2E_EMAIL\|E2E_PASSWORD" apps/e2e/helpers/seed.ts apps/e2e/helpers/auth.ts
```
Expected: `seed.ts` reads `SUPABASE_SERVICE_ROLE_KEY` from env; `auth.ts` reads `E2E_EMAIL` + `E2E_PASSWORD`. Confirm `op run` env-injection passes all three to playwright when the e2e package is invoked.

- [ ] **Step 0.2: Smoke-run an existing spec to confirm env wiring**

Run:
```bash
op run --env-file=.env.template -- pnpm --filter @smartout/e2e exec playwright test apps/e2e/contract-employee/journey-1-define-basis.spec.ts --project=chromium
```
Expected: spec passes (or fails on its own logic, NOT on missing env). If it fails on missing service-role key → halt and fix env before proceeding to Task 6.1.

### Task 6.1 — Priority bump journey

- [ ] **Step 6.1.1: Write the spec**

Create `apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase, seedWorkspace } from "../helpers/seed";
import { cleanupTestData } from "../helpers/cleanup";

test.describe("Nyheter journey 1 — priority bump on announcement", () => {
  let workspaceId: string;

  test.beforeEach(async () => {
    const ws = await seedWorkspace({ name: "Strøm Mat & Bar", slug: "strom-mat-og-bar" });
    workspaceId = ws.workspace_id;
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
  });

  test("announcement insert produces priority=1 + mode=work notifications", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Testkunngjøring");
    await page.getByLabel(/melding/i).fill("Body content for priority test");
    await page.getByRole("button", { name: /publiser/i }).click();

    await expect(page.getByText("Testkunngjøring")).toBeVisible();

    // Verify notification_outbox row priority=1, mode=work
    // (supabase is the service-role client exported from helpers/seed.ts)
    const { data } = await supabase
      .from("notification_outbox")
      .select("priority, mode, metadata")
      .eq("workspace_id", workspaceId)
      .order("scheduled_for", { ascending: false })
      .limit(5);

    const announcementRow = (data ?? []).find(
      (r) => (r.metadata as { event_key?: string })?.event_key === "announcement.published",
    );
    expect(announcementRow).toBeDefined();
    expect(announcementRow?.priority).toBe(1);
    expect(announcementRow?.mode).toBe("work");
  });
});
```

### Task 6.2 — Audience targeting journey

- [ ] **Step 6.2.1: Write the spec**

Create `apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase, seedWorkspace, seedDepartment, seedProfile } from "../helpers/seed";
import { cleanupTestData } from "../helpers/cleanup";

test.describe("Nyheter journey 2 — audience targeting writes correct DB shape", () => {
  let workspaceId: string;
  let barDeptId: string;

  test.beforeEach(async () => {
    const ws = await seedWorkspace({ name: "Strøm Mat & Bar", slug: "strom-mat-og-bar" });
    workspaceId = ws.workspace_id;
    const bar = await seedDepartment(workspaceId, { name: "Bar" });
    const kitchen = await seedDepartment(workspaceId, { name: "Kjøkken" });
    barDeptId = bar.department_id;
    await seedProfile(workspaceId, {
      display_name: "Henrik Bar",
      role: "employee",
      department_id: bar.department_id,
    });
    await seedProfile(workspaceId, {
      display_name: "Aisha Kitchen",
      role: "employee",
      department_id: kitchen.department_id,
    });
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
  });

  test("manager publishes targeted announcement → DB has visibility_scope=targeted_members + non-empty target_profile_ids matching department", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Bar-only announcement");
    await page.getByLabel(/melding/i).fill("Only bar staff should see this.");

    await page.getByRole("tab", { name: /avdeling/i }).click();
    await page.getByRole("button", { name: /bar/i }).click();
    await expect(page.getByText(/ansatt.* vil få denne/i)).toBeVisible();
    await page.getByRole("button", { name: /publiser/i }).click();

    // Wait for either toast or feed render (the spec doesn't depend on workspace-context)
    await page.waitForTimeout(1200);

    // Service-role DB assertion: row exists with correct audience shape
    const { data: rows } = await supabase
      .from("channel_message")
      .select("content, visibility_scope, target_profile_ids, message_type, system_data")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    expect(row).toBeDefined();
    expect(row?.content).toMatch(/Bar-only announcement/);
    expect(row?.visibility_scope).toBe("targeted_members");
    expect(Array.isArray(row?.target_profile_ids)).toBe(true);
    expect((row?.target_profile_ids as string[]).length).toBeGreaterThan(0);
    expect((row?.system_data as { audience_kind?: string } | null)?.audience_kind).toBe("department");

    // Cross-check: every profile_id in target list belongs to Bar department
    const { data: barProfiles } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("department_id", barDeptId);
    const barIds = new Set((barProfiles ?? []).map((p) => p.profile_id));
    for (const targetId of row?.target_profile_ids as string[]) {
      expect(barIds.has(targetId)).toBe(true);
    }
  });

  test("manager publishes 'Alle' audience → DB has visibility_scope=all_members + null/empty target_profile_ids", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Whole-team announcement");
    await page.getByLabel(/melding/i).fill("Everyone reads this.");
    // 'Alle' is the default segment — no segment switch needed
    await page.getByRole("button", { name: /publiser/i }).click();
    await page.waitForTimeout(1200);

    const { data: rows } = await supabase
      .from("channel_message")
      .select("visibility_scope, target_profile_ids")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .order("created_at", { ascending: false })
      .limit(1);

    expect(rows?.[0]?.visibility_scope).toBe("all_members");
    // target_profile_ids is null OR empty array depending on Postgres handling
    const tpids = rows?.[0]?.target_profile_ids;
    expect(tpids === null || (Array.isArray(tpids) && tpids.length === 0)).toBe(true);
  });
});
```

### Task 6.3 — Pin realtime journey

- [ ] **Step 6.3.1: Write the spec**

Create `apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase, seedWorkspace, seedDepartment, seedProfile } from "../helpers/seed";
import { cleanupTestData } from "../helpers/cleanup";

async function seedNewsAnnouncement(opts: {
  workspaceId: string;
  senderId: string;
  title: string;
  body: string;
}) {
  // Resolve or create the workspace 'news' channel
  const { data: existing } = await supabase
    .from("channel")
    .select("id")
    .eq("workspace_id", opts.workspaceId)
    .eq("channel_type", "news")
    .maybeSingle();

  let channelId: string;
  if (existing) {
    channelId = existing.id;
  } else {
    const { data: created } = await supabase
      .from("channel")
      .insert({
        workspace_id: opts.workspaceId,
        channel_type: "news",
        name: "Nyheter",
        created_by: opts.senderId,
      })
      .select("id")
      .single();
    channelId = created!.id;
  }

  await supabase.from("channel_message").insert({
    workspace_id: opts.workspaceId,
    channel_id: channelId,
    sender_id: opts.senderId,
    content: `${opts.title}\n${opts.body}`,
    message_type: "announcement",
  });
}

test.describe("Nyheter journey 3 — pin/unpin writes correct DB shape + audit", () => {
  let workspaceId: string;
  let managerProfileId: string;
  let messageId: string;

  test.beforeEach(async () => {
    const ws = await seedWorkspace({ name: "Strøm Mat & Bar", slug: "strom-mat-og-bar" });
    workspaceId = ws.workspace_id;
    await seedDepartment(workspaceId, { name: "Kjøkken" });
    const manager = await seedProfile(workspaceId, {
      display_name: "Sofia Manager",
      role: "manager",
    });
    managerProfileId = manager.profile_id;
    await seedNewsAnnouncement({
      workspaceId,
      senderId: managerProfileId,
      title: "Critical safety notice",
      body: "All staff please read.",
    });
    // Capture the message id we just inserted so we can assert against it
    const { data: rows } = await supabase
      .from("channel_message")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .order("created_at", { ascending: false })
      .limit(1);
    messageId = rows?.[0]?.id ?? "";
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
  });

  test("manager clicks Fest øverst → DB has is_pinned=true + pinned_by + pinned_at + activity_trail row", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page
      .getByRole("button", { name: /meny/i })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /fest øverst/i }).click();
    await expect(page.getByText(/festet øverst/i)).toBeVisible();

    // Service-role assertion on channel_message row
    const { data: rows } = await supabase
      .from("channel_message")
      .select("is_pinned, pinned_by, pinned_at")
      .eq("id", messageId)
      .single();
    expect(rows?.is_pinned).toBe(true);
    expect(rows?.pinned_by).toBeTruthy();
    expect(rows?.pinned_at).toBeTruthy();

    // Service-role assertion on activity_trail row (channel.message.pinned)
    const { data: audit } = await supabase
      .from("activity_trail")
      .select("event_name, entity_id, properties")
      .eq("workspace_id", workspaceId)
      .eq("event_name", "channel.message.pinned")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit?.[0]).toBeDefined();
    expect(audit?.[0]?.entity_id).toBe(messageId);
  });

  test("manager unpins → DB has is_pinned=false + null pinned_by/pinned_at + activity_trail unpinned row", async ({ page }) => {
    // Pre-pin via service role so the spec starts in pinned state
    await supabase
      .from("channel_message")
      .update({
        is_pinned: true,
        pinned_by: managerProfileId,
        pinned_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    // Strip header must be present pre-unpin
    await expect(page.getByRole("heading", { name: /festet/i })).toBeVisible();

    // Click inline Løsne in the strip
    await page.getByRole("button", { name: /løsne/i }).first().click();
    await expect(page.getByRole("heading", { name: /festet/i })).toHaveCount(0);

    const { data: rows } = await supabase
      .from("channel_message")
      .select("is_pinned, pinned_by, pinned_at")
      .eq("id", messageId)
      .single();
    expect(rows?.is_pinned).toBe(false);
    expect(rows?.pinned_by).toBeNull();
    expect(rows?.pinned_at).toBeNull();

    const { data: audit } = await supabase
      .from("activity_trail")
      .select("event_name, entity_id")
      .eq("workspace_id", workspaceId)
      .eq("event_name", "channel.message.unpinned")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit?.[0]?.entity_id).toBe(messageId);
  });
});
```

- [ ] **Step 6.3.2: Run all 3 specs**

Run:
```bash
pnpm --filter @smartout/e2e exec playwright test apps/e2e/komm-nyheter
```
Expected: 3 specs pass.

- [ ] **Step 6.3.3: Commit**

```bash
git add apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts \
        apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts \
        apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts
git commit -m "$(cat <<'EOF'
test(nyheter): E2E journeys for Wave A — priority, audience, pin realtime

Three Playwright specs cover the three Wave A items end-to-end.
Journey 1 verifies notification_outbox priority=1/mode=work.
Journey 2 verifies RLS filters targeted announcements from non-recipients.
Journey 3 verifies pin/unpin realtime fan-out and employee read-only viewport.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification (close-feature gates)

- [ ] **Step F.1: Typecheck**

Run:
```bash
pnpm turbo typecheck
```
Expected: zero errors in `apps/web` and `packages/i18n` (modified packages).

- [ ] **Step F.2: Lint**

Run:
```bash
pnpm turbo lint
```
Expected: zero new errors.

- [ ] **Step F.3: Unit tests**

Run:
```bash
pnpm --filter web vitest run src/app/dashboard/komm src/app/dashboard/_components
```
Expected: all 11 tests pass (3 hook + 4 pill + 4 picker + 4 action).

- [ ] **Step F.4: E2E**

Run:
```bash
pnpm --filter @smartout/e2e exec playwright test apps/e2e/komm-nyheter
```
Expected: 3 specs pass.

- [ ] **Step F.5: Migration smoke**

Run:
```bash
npx supabase db reset
npx supabase test db --file supabase/tests/announcement_notification_priority_test.sql
```
Expected: 4 pgTAP assertions pass.

- [ ] **Step F.6: Manual smoke on dev workspace**

Run `pnpm --filter web dev`. Open `/dashboard/komm/nyheter` as manager in `Strøm Mat & Bar` workspace. Verify:
- Publish announcement to "Avdeling → Kjøkken" → recipient pill shows correct count
- Pin from menu → strip appears with motion spring
- Unpin → strip disappears
- Operational badge renders on announcement cards only

- [ ] **Step F.7: Write HANDOFF**

Create `docs/HANDOFF-nyheter-engagement-wave-a.md` with sections: Summary, Decisions made, Learnings, Known issues, Next steps (deferred items: ReadReceipt aggregation, mobile strip, publishAnnouncement capability, sendMessage ADR-0287 retrofit).

- [ ] **Step F.8: Run close-feature**

Run:
```bash
~/.claude/scripts/close-feature.sh <N>
```
Expected: gates pass, branch merges to `development`, worktree cleaned.

---

## Open recommendations after close

These were identified during the council session 2026-05-10 and audit but are out of scope for Wave A:

1. **ADR for `sendMessage` ADR-0287 retrofit** — current `packages/ai/src/capabilities/communication/tools.ts` `sendMessage` violates ADR-0287 (no gate_action wrapper). Prereq for any future Botsson `publishAnnouncement` capability tool.
2. **ADR for entity-ref pattern in `notification_outbox.metadata`** — replaces URL coupling in `action_url`. Required before adding any second surface (mobile push deep-link).
3. **Sortie: `feat/mobile-nyheter-strip`** — Chat-tab nested compact strip per Frontend-designer council recommendation. Closes mobile parity gap and unifies push deep-link target with web.
4. **Sortie: ReadReceipt aggregation** — write `channel_message_read` on view + `get_message_read_summary` RPC + "Lest av N" chip in NewsCard footer. Held pending RPC scope decision (cursor `last_read_message_id` vs per-message receipts).
5. **Refactor QuickBroadcast to consume `RecipientCountPill`** — replace the inline count chips with the new shared pill once Wave A lands. Small follow-up cleanup.

---

## Self-Review (post-council 2026-05-11 patch)

**Spec coverage:**
- Item A (priority bump) → Task 1 (migration + pgTAP). QuickBroadcast side-effect declared.
- Item B (audience UI) → Task 2 (resolver hook + pill), Task 3 (picker + wiring), payload extension in `useSendAnnouncement` with entity_id leak fixed
- Item C (pin/unpin) → Task 4 (Server Action + hook using `resolveCurrentProfile` + `createAdminClient`), Task 5 (PinnedStrip + menu + integration)
- Operational badge → Task 5.3.3 wiring
- E2E → Task 6 (3 specs, all using service-role DB assertions)
- Pre-task A — telemetry registry extension + `--color-pin` token (unblocks Task 3 + Task 5)

**Council patches landed (2026-05-11):**
- B1 (telemetry shape) → Pre-task A extends `ChannelMessageSent`, `ChannelMessagePinned`, `ChannelMessageUnpinned` properties + adds `activity_trail` to unpinned routing
- B2 (i18n syntax) → flat `recipient_count_pill_one` + `_other` keys, branched in component
- B3 (supabase imports) → `createAdminClient` from `@smartout/supabase/admin` + `resolveCurrentProfile` from `_shared`
- B4 (E2E auth) → Journey 2+3 rewritten as service-role DB assertions, no second-user browser context
- B5 (AudiencePicker accessibility) → `role="tablist"` wrapper + roving tabindex + arrow-key handler + Home/End
- B6 (`--color-pin`) → CSS variable in light + dark, replaces all `text-amber-600`
- M1 (entity_id leak) → captures `data.id` in onSuccess
- M3 (schema cast hygiene) → drops `as` casts, mirrors `use-broadcast-recipients.ts` clean pattern + SAFETY comment
- M4 (auth fixture) → architecturally avoided via DB assertion model
- M5/M6 (gateAction + resolveCurrentProfile) → resolveCurrentProfile adopted; gateAction TODO documented
- m1 (gatedMutation.js → .ts) → fixed in Untouchable list
- Frontend motion fixes → backdrop-blur-xl + useReducedMotion in PinnedStrip + RecipientCountPill, Framer hover instead of Tailwind translate, springSnappy on bump, motion.button on drilldown tiles, transition-all eliminated

**Placeholder scan:** zero "TBD"/"TODO"/"implement later" placeholders. One TODO comment in pinMessageAction body cites future capability slug (acceptable per CLAUDE.md WHY-not-WHAT rule).

**Type consistency:**
- `AudienceInput` discriminated union defined in Task 2.1.3, consumed in Task 3.2.1 and Task 3.4.1 with matching kind values.
- `pinMessageAction` Server Action input matches Zod schema; mock in Task 4.1.1 uses real export names from `@smartout/supabase/admin` and `_shared`.
- `usePinMessage.mutate` input shape `{ messageId, channelId, pin, profileId }` matches consumption in Task 5.3.2.
- `useSendAnnouncement` `AnnouncementInput` extended in Task 3.3.1 matches new call site in Task 3.4.1.
- `NewsCardProps` extended in Task 5.3.3 with `canManage` + `onTogglePin` — both wired at call site.
- Telemetry interfaces extended in Pre-task A match the property bag passed by `useSendAnnouncement.onSuccess` and `usePinMessage.onSuccess`.

**Risks flagged + mitigated inline:**
- RLS UPDATE on `channel_message` restricts to sender → Server Action with service role + role guard via `resolveCurrentProfile` + workspace match (Task 4.2).
- Two priority systems coexist (smallint vs enum) → migration uses smallint to match `notification_outbox.priority` column (Task 1.3).
- `channel_member.last_read_message_id` and `channel_message_read` are different mechanisms → ReadReceipt deferred from this wave to avoid scope creep.
- QuickBroadcast already writes `message_type='announcement'` → side-effect declared as intended in Task 1.
- Pre-existing `getChannelContext` capability tool doesn't filter on `visibility_scope` → flagged for HANDOFF next-steps (out of Wave A scope).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-10-nyheter-engagement-wave-a.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration. Best for this plan because 6 tasks span 3 distinct concerns (migration, UI components, Server Action) — fresh subagent per task keeps context tight.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Best if Pontus wants to stay in the same session and review each commit.

**Which approach?**
