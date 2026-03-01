---
title: "Design — Landing Session Tracking"
status: approved
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: [design, analytics, tracking, sessions]
---

# Design — Landing Session Tracking

> Branch: `feat/landing-analytics` | Module: landing

## Goal

Full session tracking for the landing page: cookie-based visitor identification, scroll depth, click tracking, time on page, returning visitor detection. All data visible in platform-admin dashboard with session detail views and visitor identification.

## Decisions

| Decision               | Choice                                | Rationale                                            |
| ---------------------- | ------------------------------------- | ---------------------------------------------------- |
| Cookie consent         | Strictly necessary (no banner)        | Functional analytics cookie, no PII beyond IP        |
| Data storage           | Supabase only                         | Build on existing landing_event infra, single system |
| Click tracking depth   | All clicks with element info          | Full heatmap data: selector, text, href, position    |
| Dashboard level        | Sessions list + detail view           | Clickable sessions with full event timeline          |
| Visitor identification | Auto at signup + manual admin tagging | Connect anonymous visitors to known identities       |

---

## Architecture

### Data Flow

```
Visitor (landing page)
    │
    ├─ Cookie: smo_vid={uuid} (365 days, SameSite=Lax, path=/)
    ├─ sessionStorage: session_id (per tab, existing)
    │
    ├─ page_view         → POST /api/track (existing, enhanced)
    ├─ click             → POST /api/track (new, all clicks)
    ├─ scroll_depth      → POST /api/track (new, 25/50/75/100%)
    ├─ session_heartbeat → POST /api/track (new, every 30s)
    ├─ session_end       → navigator.sendBeacon /api/track (new, on unload)
    │
    └─ All events write to landing_event (existing table, extended)

Supabase
    ├─ landing_event     → Extended: visitor_id + new event types
    ├─ landing_visitor   → NEW: cookie-based visitor profile
    └─ landing_session   → NEW: aggregated session summary

Admin Dashboard (/platform-admin/landing)
    ├─ Events tab        → Existing (enhanced with new event types)
    ├─ Sessions tab      → NEW: session list with KPIs
    ├─ Session detail    → NEW: full timeline + visitor info
    └─ Visitor detail    → NEW: all sessions for one visitor
```

### Cookie Strategy

- **Name:** `smo_vid` (smartout visitor ID)
- **Value:** UUIDv4, generated client-side
- **Lifetime:** 365 days, refreshed on every visit
- **Scope:** Landing domain only, `SameSite=Lax`, `path=/`
- **Not httpOnly:** must be readable by client JS for event tagging
- **Classification:** Strictly necessary (functional analytics)

The cookie persists across browser sessions, enabling returning visitor detection. The existing `sessionStorage` session_id continues to group events within a single tab session.

---

## Database Schema

### New table: `landing_visitor`

```sql
CREATE TABLE public.landing_visitor (
  id                uuid PRIMARY KEY,           -- = smo_vid cookie value
  first_seen        timestamptz NOT NULL DEFAULT now(),
  last_seen         timestamptz NOT NULL DEFAULT now(),
  visit_count       int NOT NULL DEFAULT 1,
  first_referrer    text,
  first_variant     text,
  ip_addresses      text[] NOT NULL DEFAULT '{}',
  user_agents       text[] NOT NULL DEFAULT '{}',
  -- Identification
  user_identity_id  uuid REFERENCES public.user_identity(id),  -- set at signup
  manual_label      text,                       -- admin tag ("Johan, Restaurang X")
  manual_notes      text,                       -- admin freetext
  tagged_by         uuid REFERENCES public.user_identity(id),
  tagged_at         timestamptz,
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- No RLS (platform-admin table, service role access only)
CREATE INDEX idx_landing_visitor_last_seen ON landing_visitor(last_seen DESC);
CREATE INDEX idx_landing_visitor_identity ON landing_visitor(user_identity_id) WHERE user_identity_id IS NOT NULL;
```

### New table: `landing_session`

```sql
CREATE TABLE public.landing_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        uuid NOT NULL REFERENCES public.landing_visitor(id),
  session_id        text NOT NULL,              -- browser sessionStorage ID
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,                -- set by session_end or last heartbeat
  duration_seconds  int,                        -- computed: ended_at - started_at
  max_scroll_depth  int DEFAULT 0,              -- highest scroll % (0-100)
  page_count        int DEFAULT 0,              -- page_view events in session
  click_count       int DEFAULT 0,              -- click events in session
  cta_click_count   int DEFAULT 0,              -- cta_click events in session
  variant           text,                       -- landing variant
  referrer          text,                       -- entry referrer
  ip_address        inet,
  user_agent        text,
  device_type       text,                       -- 'desktop' | 'mobile' | 'tablet'
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- No RLS (platform-admin table)
CREATE INDEX idx_landing_session_visitor ON landing_session(visitor_id);
CREATE INDEX idx_landing_session_started ON landing_session(started_at DESC);
CREATE UNIQUE INDEX idx_landing_session_sid ON landing_session(session_id);
```

### Extended: `landing_event`

```sql
ALTER TABLE public.landing_event
  ADD COLUMN visitor_id uuid REFERENCES public.landing_visitor(id);

-- New event_types: 'scroll_depth', 'click', 'session_heartbeat', 'session_end'
-- details JSONB now also contains:
--   click:      { selector, text, href, tagName, x, y }
--   scroll:     { percent, maxPercent }
--   heartbeat:  { timeOnPage, scrollPercent }
--   session_end:{ timeOnPage, maxScroll, clickCount }

CREATE INDEX idx_landing_event_visitor ON landing_event(visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_landing_event_session ON landing_event(session_id) WHERE session_id IS NOT NULL;
```

---

## Client-Side Tracking

### Cookie Manager (new: `lib/visitor-cookie.ts`)

```
getOrCreateVisitorId(): string
  - Read smo_vid cookie
  - If missing: generate UUIDv4, set cookie (365d)
  - If present: refresh cookie expiry
  - Return visitor_id
```

### Enhanced useTracking hook

Extend existing `hooks/useTracking.ts`:

1. **usePageTracking()** — existing, add visitor_id to payload
2. **useScrollTracking()** — NEW: IntersectionObserver or scroll listener
   - Fire at 25%, 50%, 75%, 100% thresholds (each once per session)
   - Debounced, sessionStorage guards to avoid duplicates
3. **useClickTracking()** — NEW: document-level click listener
   - Capture: closest interactive element (a, button, [role=button])
   - Extract: tagName, innerText (truncated 100 chars), href, CSS path, click position
   - Debounce: max 1 event per 200ms
4. **useSessionHeartbeat()** — NEW: setInterval every 30s
   - Sends current timeOnPage + scrollPercent
   - Updates landing_session.ended_at server-side
5. **useSessionEnd()** — NEW: beforeunload + visibilitychange
   - navigator.sendBeacon with final session summary
   - Fallback: last heartbeat serves as session end

### Event Payloads

All events include: `{ event_type, session_id, visitor_id, variant }`

| Event             | Additional details                           |
| ----------------- | -------------------------------------------- |
| page_view         | referrer, pathname                           |
| click             | selector, text, href, tagName, x, y          |
| scroll_depth      | percent (25/50/75/100)                       |
| cta_click         | label (existing)                             |
| session_heartbeat | timeOnPage, scrollPercent                    |
| session_end       | timeOnPage, maxScroll, clickCount, pageCount |

---

## Server-Side (`/api/track`)

Enhance existing `app/api/track/route.ts`:

1. Accept new event types in Zod schema
2. On any event with visitor_id:
   - UPSERT `landing_visitor` (create if first visit, update last_seen + visit_count)
   - UPSERT `landing_session` (create on first event, update aggregates)
3. On `session_end`:
   - Finalize `landing_session.ended_at` and `duration_seconds`
4. On `click` with CTA detection:
   - Also increment `cta_click_count` on session
5. Device type detection: parse User-Agent server-side (simple regex, no library)

### Session Aggregation Logic

Session summary fields are updated incrementally:

- `page_count` += 1 on page_view
- `click_count` += 1 on click
- `cta_click_count` += 1 on cta_click
- `max_scroll_depth` = MAX(current, new percent)
- `ended_at` = updated on every event
- `duration_seconds` = EXTRACT(EPOCH FROM ended_at - started_at)

---

## Visitor Identification

### Auto-link at signup

When a user completes signup on the landing page:

1. Landing signup page reads `smo_vid` cookie
2. Passes `visitor_id` to signup API call (or stores in localStorage)
3. After `user_identity` is created (by `handle_new_user()` trigger):
   - Web app's post-signup flow writes `visitor_id` → `landing_visitor.user_identity_id`
   - Or: Edge Function/API route handles the linking

### Manual admin tagging

In the admin sessions dashboard:

- Click visitor row → visitor detail panel
- "Tag visitor" button opens dialog:
  - Label field (required): "Johan, Restaurang Nemo"
  - Notes field (optional): freetext
- Saves to `landing_visitor.manual_label`, `manual_notes`, `tagged_by`, `tagged_at`

---

## Admin Dashboard

### Tab Structure

`/platform-admin/landing` gets a tab switcher:

**Events tab** (existing, enhanced):

- Existing KPI cards + event table
- New event types shown with appropriate badges

**Sessions tab** (new):

- KPI cards:
  - Unique visitors today
  - Returning visitors (7d)
  - Avg session duration
  - Avg scroll depth
- Sessions table columns:
  - Visitor (truncated ID + badge: identified/tagged/anonymous/returning)
  - Variant
  - Duration (formatted: "2m 34s")
  - Scroll depth (% with visual bar)
  - Clicks
  - Pages
  - Referrer
  - Device
  - Time (relative)
- Click row → session detail

**Session detail** (slide-over panel or sub-page):

- Header: visitor info (ID, device, IP, new/returning, visit count)
- If identified: show name + email from user_identity
- If tagged: show label + notes
- Tag button (if not yet tagged)
- Timeline: chronological list of all events in session
  - Each event: timestamp, type badge, details (clicked element, scroll %, etc.)
- Scroll progress bar: visual 0-100% indicator
- Session summary: duration, pages visited, total clicks

---

## Out of Scope

- Scroll heatmap visualization (future)
- Time-series charts / conversion funnels (future)
- IP geolocation enrichment (future)
- A/B variant statistical significance (future)
- Cookie consent banner (not needed for strictly necessary)
- PostHog integration for landing (separate system)
- Real-time websocket updates on dashboard (manual refresh)

---

## File Changes

### New Files

| File                                                                         | Purpose                              |
| ---------------------------------------------------------------------------- | ------------------------------------ |
| `supabase/migrations/XXXXXXXX_landing_session_tracking.sql`                  | New tables + landing_event extension |
| `apps/landing/src/lib/visitor-cookie.ts`                                     | Cookie read/write/refresh            |
| `apps/landing/src/hooks/useScrollTracking.ts`                                | Scroll depth observer                |
| `apps/landing/src/hooks/useClickTracking.ts`                                 | Document-level click capture         |
| `apps/landing/src/hooks/useSessionLifecycle.ts`                              | Heartbeat + session end              |
| `apps/web/src/app/platform-admin/landing/_components/sessions-tab.tsx`       | Sessions list UI                     |
| `apps/web/src/app/platform-admin/landing/_components/session-detail.tsx`     | Session timeline detail              |
| `apps/web/src/app/platform-admin/landing/_components/session-columns.tsx`    | TanStack column defs                 |
| `apps/web/src/app/platform-admin/landing/_components/visitor-tag-dialog.tsx` | Manual tag dialog                    |
| `apps/web/src/app/platform-admin/landing/_components/landing-tabs.tsx`       | Tab switcher (events/sessions)       |

### Modified Files

| File                                                                              | Change                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------- |
| `apps/landing/src/hooks/useTracking.ts`                                           | Add visitor_id to all events              |
| `apps/landing/src/components/tracking.tsx`                                        | Use visitor cookie in PageTracker         |
| `apps/landing/src/app/api/track/route.ts`                                         | Handle new events, upsert visitor/session |
| `apps/web/src/app/platform-admin/landing/page.tsx`                                | Fetch session data, add tabs              |
| `apps/web/src/app/platform-admin/landing/_components/landing-activity-client.tsx` | Wrap in tab structure                     |
| `packages/supabase/src/database.types.ts`                                         | Regenerated after migration               |

---

## Acceptance Criteria

- [ ] Cookie `smo_vid` set on first landing visit, persists 365 days
- [ ] Returning visitors identified by cookie across sessions
- [ ] Scroll depth tracked at 25/50/75/100% thresholds
- [ ] All clicks captured with element info (selector, text, href, position)
- [ ] Session duration tracked via heartbeat + session_end beacon
- [ ] Admin sessions tab shows session list with KPIs
- [ ] Admin session detail shows full event timeline
- [ ] Admin can manually tag anonymous visitors
- [ ] Visitor auto-linked to user_identity at signup
- [ ] Existing tracking (page_view, cta_click, voice_session) continues working
- [ ] Tracking failures never break visitor experience (fire-and-forget)
