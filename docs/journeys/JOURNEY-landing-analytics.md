---
title: "User Journeys — Landing Analytics"
status: done
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: [journeys, analytics, tracking]
---

# User Journeys — Landing Analytics

---

## Journey: Visitor — First Visit (Anonymous)

**Precondition:** Visitor has never been to smartout.ai before. No `smo_vid` cookie exists.

1. Visitor opens smartout.ai landing page → System generates UUIDv4, sets `smo_vid` cookie (365 days) and `session_id` in sessionStorage → Visitor sees the landing page normally (no consent banner, no visible tracking)
2. System fires `page_view` event to `/api/track` with visitor_id, session_id, variant, referrer, pathname → Server creates `landing_visitor` row (first_seen, first_referrer, first_variant) and `landing_session` row → Event stored in `landing_event`
3. Visitor scrolls down the page → System fires `scroll_depth` at 25%, 50%, 75%, 100% thresholds (each once) → Session `max_scroll_depth` updated incrementally
4. Visitor clicks elements (links, buttons, navigation) → System captures each click with selector, text, href, tagName, x, y → Session `click_count` incremented
5. Every 30 seconds → System sends `session_heartbeat` with timeOnPage and scrollPercent → Session `ended_at` and `duration_seconds` updated
6. Visitor closes tab or navigates away → System sends `session_end` via sendBeacon with final stats → Session finalized with total duration, maxScroll, clickCount

**Postcondition:** `landing_visitor` exists with visit_count=1. `landing_session` exists with full metrics. All events stored in `landing_event`.

**Error paths:**

- Cookies blocked (private mode): `smo_vid` not set, visitor_id is undefined. Events still fire without visitor_id. No visitor/session rows created, but `landing_event` entries still stored.
- sessionStorage blocked: session_id fallback fails. Events fire without session_id.
- `/api/track` unreachable: All tracking is fire-and-forget. Visitor experience unaffected.
- sendBeacon fails on unload: Last heartbeat serves as session end (ended_at still populated).

---

## Journey: Visitor — Returning Visit

**Precondition:** Visitor has `smo_vid` cookie from a previous visit. Opens a new browser session.

1. Visitor opens smartout.ai → System reads existing `smo_vid` cookie, refreshes expiry to 365 days → New `session_id` generated in sessionStorage
2. System fires `page_view` → Server finds existing `landing_visitor` by id, updates `last_seen` → Creates new `landing_session` row, increments `visit_count` on visitor
3. All scroll/click/heartbeat/end tracking works identically to first visit
4. In admin dashboard → This visitor shows "returning" badge with visit_count > 1

**Postcondition:** `landing_visitor.visit_count` incremented. New `landing_session` row linked to same visitor_id.

**Error paths:**

- Cookie expired (>365 days): Treated as new visitor. New smo_vid generated.
- Cookie cleared by user: Same as expired — new visitor identity.

---

## Journey: Visitor — Clicks CTA and Signs Up

**Precondition:** Visitor is on the landing page (anonymous or returning).

1. Visitor clicks "Kom i gang" CTA → System fires `cta_click` event with label "Kom i gang" AND `click` event with element details → Session `cta_click_count` incremented
2. Visitor lands on `/signup` page → `SignupVisitorLinker` component reads `smo_vid` cookie and stores it in localStorage as `smo_landing_visitor_id` → `PageTracker` fires page_view
3. Visitor clicks through to web app onboarding (external redirect) → `session_end` fires via sendBeacon

**Postcondition:** Visitor's cookie value is in localStorage, ready for the web app to link to `user_identity` after account creation. Session finalized.

**Error paths:**

- Visitor has no smo_vid cookie: SignupVisitorLinker does nothing. No linking possible.
- localStorage blocked: Visitor ID not persisted. Auto-linking skipped silently.

---

## Journey: Platform Admin — View Session Analytics

**Precondition:** Admin is logged in with godmode access. At least one landing visitor has generated events.

1. Admin navigates to `/platform-admin/landing` → Server fetches session data with visitor joins, event counts, KPIs in parallel → Admin sees tabbed view defaulting to "Sessions" tab
2. Admin sees 4 KPI cards: Unique visitors today, Returning visitors (7d), Avg. duration today, Avg. scroll depth → All computed server-side from `landing_session` + `landing_visitor`
3. Admin sees sessions table with columns: Visitor (ID + badge), Variant, Duration, Scroll (visual bar), Clicks, Pages, Device icon, Time (relative) → Sessions ordered by most recent
4. Visitor column shows status badges:
   - "identified" (green): linked to user_identity (name/email shown)
   - "tagged" (amber): manually tagged by admin (label shown)
   - "returning" (blue): visit_count > 1 (truncated ID shown)
   - "anonymous" (gray): single visit, no identity (truncated ID shown)
5. Admin clicks "Events" tab → Sees original event feed with new event types (click, scroll_depth, session_heartbeat, session_end) with color-coded badges

**Postcondition:** Admin has overview of all landing visitor activity.

**Error paths:**

- No sessions exist: Empty table with "No results." message. KPIs show 0.
- Non-admin accesses page: Redirected to `/dashboard`.

---

## Journey: Platform Admin — Inspect Session Detail

**Precondition:** Admin is on the Sessions tab with at least one session visible.

1. Admin clicks a session row → Sheet panel slides in from right (480px) → System fetches all events for this session_id via `GET /api/admin/session-events`
2. Admin sees Visitor Info card: truncated ID, visit count, device type, IP address → If identified: name + email from user_identity shown → If tagged: manual label shown
3. Admin sees Session Summary: Duration (M:SS), Scroll depth (%), Clicks (count), plus visual scroll progress bar
4. Admin sees Event Timeline: chronological list of all events → Each event shows: icon, type badge (color-coded), timestamp, detail text → Click events show element text + tag, scroll events show percentage, heartbeat shows time on page
5. Admin closes sheet by clicking outside or pressing X

**Postcondition:** Admin has full visibility into a single visitor's session behavior.

**Error paths:**

- Session has no events (edge case): "No events found" shown in timeline.
- API call fails: "Loading events..." shown, then empty state.

---

## Journey: Platform Admin — Tag Anonymous Visitor

**Precondition:** Admin is viewing a session detail for an anonymous visitor (no user_identity linked).

1. Admin sees "Tag Visitor" button below visitor info card → Clicks it → Dialog opens with Label input and Notes textarea
2. Admin types label: "Johan, Restaurang Nemo" → Optionally adds notes: "Contacted us via phone, interested in HACCP module" → Clicks "Save Tag"
3. System POSTs to `/api/admin/tag-visitor` with visitor_id, label, notes → Server validates (label required, max 200 chars), updates `landing_visitor`: sets manual_label, manual_notes, tagged_by (admin ID), tagged_at → Returns success
4. Dialog closes → Visitor now shows amber "tagged" badge in sessions table → Label visible in session detail

**Postcondition:** `landing_visitor` has manual_label, manual_notes, tagged_by, tagged_at set. Visitor identifiable across all their sessions.

**Error paths:**

- Empty label: Save button disabled. Cannot submit.
- API fails: Dialog stays open. Admin can retry.
- Visitor already tagged: Button shows "Edit Tag" instead. Same flow, overwrites previous tag.
- Visitor already identified (has user_identity): Tag button not shown (identity takes precedence).

---

## Journey: Platform Admin — Edit Existing Tag

**Precondition:** Admin views a session detail for a previously tagged visitor.

1. Admin sees "Edit Tag" button → Clicks it → Dialog opens pre-filled with current label and notes
2. Admin modifies the fields → Clicks "Save Tag" → Server updates landing_visitor
3. Dialog closes → Updated label shown in session detail and sessions table

**Postcondition:** Tag updated with new values. tagged_by and tagged_at reflect the latest edit.

**Error paths:** Same as tagging flow above.
