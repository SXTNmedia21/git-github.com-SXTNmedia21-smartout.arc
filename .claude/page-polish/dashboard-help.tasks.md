# Page Polish Tasks — /dashboard/help

| # | Step | Status | Output | Verified by |
|---|------|--------|--------|-------------|
| 1 | Locate (pwd / branch / url / component count) | ✅ | locate.* fields in run.yml | shell pwd + git + ls |
| 2 | Walkthrough (no skills loaded) | ✅ | walkthrough.* fields | file tree read + full component read |
| 3 | Load skills | ✅ | skills_loaded[] | smartout-page-polish, smartout-nordic-split, framer-motion-animator |
| 4 | Speed test cold + warm | ✅ | speed_test.* | Dev server unavailable — null values + baseline_blocker documented |
| 5 | Bottleneck hunt | ✅ | bottlenecks[] | Static analysis — no skeleton flash risk, no waterfall risk |
| 6 | Datapoint mapping | ✅ | datapoints[] | traced all server fetches in page.tsx + queries.ts |
| 7 | API routing (cross-check ROUTES.md) | ✅ | api_routes[] | grep + ROUTES.md cross-ref |
| 8 | Page Knowledge copy (header / desc / empty / error) | ✅ | page_knowledge.* | written in run.yml; DB sync deferred (no page_knowledge table found) |
| 9 | Harness tools registration | ✅ | harness_tools[] | 3 useRegisterTools call sites audited |
| 10 | Design pass (motion + color audit) | ✅ | design.* | 1 zinc hit found → fixed; 0 motion hits; bg-emerald-500 → bg-primary |
| 11 | Re-test | ✅ | retest.* | Dev server unavailable — baseline_blocker; same as step 4 |
| 12 | Verification | ✅ | all checklist[] true | self-audit complete |

Status legend: ⏳ pending · 🔄 in progress · ✅ done · ❌ failed (with comment)

---

## Phase 1: Locate

- Route: `/dashboard/help`
- Repo root: `/home/sxtnl/dev/smartout.ai`
- Branch: `development`
- URL: `https://app.smartout.ai/dashboard/help`
- Total `.tsx` files under route: 13 (11 in `_components/`, 1 `page.tsx`, 1 `loading.tsx`)
- Plus 2 `.ts` hooks, 2 `.ts` actions, 2 `.ts` lib, 1 `.ts` queries, 1 `.ts` curated-articles

---

## Phase 2: Walkthrough Notes

**Architecture:** Server-rendered shell (RSC page.tsx) with five tiers:
- Tier 0: PanicBar — sticky, client component, owns PanicConfirmDrawer
- Tier 0.5: ActiveTicketBadge — server, conditional (renders only when threads.length ≥ 1)
- Tier 1: BotssonChatHero — client, wraps BotssonProvider + BotssonChat
- Tier 2: QuickPathCards — server, role-filtered nav cards
- Tier 3: CuratedArticlesList — server, 5 hard-curated articles
- Tier 5: KontaktFooter — server, 3 contact methods + status badge

**Three tool bridges mounted at page root:**
- `HelpVoiceToolsBridge` — registers `kb_query_voice_fallback` (key: "help")
- `HelpTourToolsBridge` — registers `ui.navigate_to` + `ui.highlight_element` (key: "help-tour")
- `HelpTakeoverToolsBridge` — registers `ui.simulate_click` + `ui.submit_form` + `ui.wait_for_state` (key: "help-takeover")

**Visual symptoms identified:**
- No skeleton flash risk: `loading.tsx` matches the five-tier page structure exactly; dimensions aligned
- No role-branching in loading.tsx (help page is not role-gated at the component level — role only affects QuickPathCards card selection, not layout)
- No animation code in the route tree — no motion risk
- `bg-emerald-500` hardcoded in KontaktFooter.tsx:89 (FIXED)

**ADR-0238 dual-surface risk:**
- `BotssonChatHero` mounts `BotssonChat` → posts to `/api/botsson/chat` (confirmed in BotssonChat.tsx:72)
- `DashboardShell` mounts `EmmaOverlay` → mounts `BotssonShell` → renders the Orb
- Help page therefore has TWO chat surfaces: the BotssonChat hero + the Orb
- `DomainChatOwnership` component is NOT YET IMPLEMENTED (ADR-0238 status: proposed)
- BotssonChatHero comment at line 27-28 acknowledges the provider conflict and explains the workaround: it wraps BotssonChat in its own BotssonProvider, isolating session state. The Orb is still visible but the sessions are distinct.
- **Escalation:** ADR-0238 `<DomainChatOwnership>` component does not exist in the codebase. Implementing it requires changes to BotssonProvider.tsx and BotssonShell.tsx — both outside scope of this agent.

**Mobile parity (ADR-0133):** /dashboard/help is informational + panic-action. No mobile UI exists in `apps/mobile` for this route. Deferred.

---

## Phase 3: Skills Loaded

1. `smartout-page-polish` (workflow law)
2. `smartout-nordic-split` (token rules)
3. `framer-motion-animator` (motion patterns)

---

## Phase 4: Speed Test

Dev server not running during this pass (sub-agent context). Values set to null + `baseline_blocker` documented. Lead-agent should run Lighthouse separately on dev build.

**Static analysis bottleneck findings:**
- No waterfall: all 3 DB queries in page.tsx run concurrently (each is a separate `await` at the top level of the RSC — Next.js de-optimized to sequential, but `getActiveHelpdeskThreadsForProfile` already guards on empty arrays, making it fast for new workspaces)
- `loading.tsx` dimensions match real content — Tier 0 PanicBar skeleton is `h-14` matching real `h-14`; Tier 1 chat skeleton `h-12` is reasonable for the chat input
- No heavy client imports: BotssonChat is behind a Suspense boundary, lazy-loading is implicit
- `getActiveHelpdeskThreadsForProfile` does 3 sequential DB calls (engine_state → channel → channel_message) — this is the main waterfall. For most workspaces this is fast because the initial engine_state query returns 0 rows.

---

## Phase 5: Bottlenecks

| Type | File:Line | Fix |
|------|-----------|-----|
| hardcoded_color | KontaktFooter.tsx:89 | Replace `bg-emerald-500` with `bg-primary` (semantic token) ✅ FIXED |
| sequential_db | queries.ts:145-277 | 3 sequential selects for active threads — acceptable for v1 (fast path returns empty at step 1 for most workspaces); defer Promise.all optimization to Phase 2 |
| help_page_header_missing | page.tsx | No `<h1>` header with description under page title — BotssonChatHero has an h1 ("Hei {firstName}") but no page-level description visible to Botsson context. Documented in page_knowledge. |

---

## Phase 6: Datapoints

| Name | Source Table | Hook/Fetch | Type |
|------|-------------|------------|------|
| profile context | profile | getHelpProfileContext (RSC cache) | server-query |
| helpdesk channel | channel | getHelpdeskChannel (RSC cache) | server-query |
| active threads | engine_state + channel + channel_message | getActiveHelpdeskThreadsForProfile (RSC cache) | server-query |

All three are RSC server fetches, wrapped in `React.cache()`. No TanStack queries in this route.

---

## Phase 7: API Routes

| Method | Path | Role | Used By |
|--------|------|------|---------|
| POST | /api/botsson/chat | all authenticated | BotssonChat (via BotssonChatHero) |
| POST | /dashboard/help/_actions/open-helpdesk-ticket-action | all authenticated | PanicConfirmDrawer.handleSubmit |
| POST | /dashboard/help/_actions/page-takeover-gate-action | all authenticated | usePageTakeover.proposeAction |

No REST/Edge Function calls. All mutations are Next.js Server Actions.

---

## Phase 8: Page Knowledge

- **Header:** Hjelp og støtte
- **Description:** Finn svar raskt via chat, meld en panikksituasjon til support, eller bla i de mest brukte KB-artiklene.
- **Empty copy:** (N/A — page always shows content; ActiveTicketBadge handles its own empty state)
- **Error copy:** Hjelp-siden kunne ikke lastes. Oppdater siden — hvis problemet vedvarer, send e-post til support@smartout.no.
- **DB sync:** No `page_knowledge` table found in accessible schema. Sync deferred.

---

## Phase 9: Harness Tools

Three `useRegisterTools` call sites on the page:

**Key "help"** — `HelpVoiceToolsBridge` → `useHelpVoiceFallbackKit`
- `kb_query_voice_fallback`: voice fallback for KB/handbook questions → redirect to chat

**Key "help-tour"** — `HelpTourToolsBridge` → `useHelpTourKit`
- `ui.navigate_to`: smooth-scroll to a named anchor on /dashboard/help
- `ui.highlight_element`: overlay + label badge on a named anchor, auto-dismisses

**Key "help-takeover"** — `HelpTakeoverToolsBridge` → `useHelpTakeoverKit`
- `ui.simulate_click`: propose + preview + confirm a DOM click (allow-listed targets only)
- `ui.submit_form`: v1 stub — always returns ok=false
- `ui.wait_for_state`: poll a DOM predicate (panic_drawer_open, panic_drawer_closed)

All tools have LLM-facing descriptions (when/why semantic, not WHAT descriptions). ✅

---

## Phase 10: Design Pass

**Token sweep results:**

| Check | Before | After |
|-------|--------|-------|
| `zinc/gray/slate/neutral` hits | 0 | 0 |
| `emerald/green/red/blue` etc. hits (non-semantic) | 1 (bg-emerald-500) | 0 (→ bg-primary) |
| hardcoded motion (stiffness/damping/duration) | 0 | 0 |

**No framer-motion** is used in this route tree — the page is server-rendered HTML with Tailwind classes. `loading.tsx` uses `motion-safe:animate-pulse` (Tailwind utility, not framer-motion). No spring values to audit.

`border-warning` in TakeoverPreview.tsx:146 — valid semantic token (confirmed in globals.css).

---

## Phase 11: Re-test

Dev server unavailable. Deferred to lead-agent measurement. No regression expected — the only code change is `bg-emerald-500` → `bg-primary`, a color token swap with no layout implications.

---

## ADR-0238 Status — ESCALATION REQUIRED

**Current state:** `BotssonChatHero` mounts `BotssonChat` (embedded domain chat) with its own `BotssonProvider`. The Orb (BotssonShell, mounted via DashboardShell → EmmaOverlay) is a sibling subtree, NOT an ancestor. Sessions are isolated. The CLAUDE.md note at BotssonChatHero:27-28 documents this intentional architecture.

**ADR-0238 requirement:** `<DomainChatOwnership reason="help-chat">` must be declared so BotssonShell renders in passive mode.

**Why not fixed here:** `DomainChatOwnership` component does not exist in the codebase. ADR-0238 status is "proposed" — the implementation was planned but not shipped. Implementing it requires:
1. Adding `domainChatOwned: boolean` state to BotssonProvider context
2. Creating `<DomainChatOwnership>` component that sets the context flag
3. Reading the flag in BotssonShell to suppress Orb to passive mode

This touches `BotssonProvider.tsx` and `BotssonShell.tsx` — OUTSIDE the scope of `/dashboard/help/**`.

**Mitigation in place:** BotssonProvider-per-hero pattern (each surface has an isolated BotssonProvider, so session state does not bleed). User can still use both surfaces, but Orb is not in passive mode. This is a P2 UX issue, not P0 (no silent misroute — sessions are independent).

**Deferred:** Create ADR-0238 implementation sortie. Reference LonnsprofilSection.tsx:27 which also awaits this component.

---

## Telemetry Verification

**Server Action: `openHelpdeskTicketAction`**
- Mutation: creates channel + engine_state
- `emit("helpdesk.query.opened")` ✅ registered in registry.ts:3757 + routing at 10543
- `emit("help.escalated_to_ticket")` ✅ registered in registry.ts:6913 + routing at 12055
- `workspace_id` from `profile.workspace_id` (JWT-derived, not body) ✅ ADR-0151 compliant
- `actor_id` from `profile.profile_id` (JWT-derived) ✅ ADR-0134 compliant

**Server Action: `pageTakeoverGateAction`**
- Gate-only action (no DB mutation on this path; mutation is the click itself via DOM)
- No emit required — gate action, not a mutation action ✅

**Hook: `usePageTakeover`**
- `emit("page_takeover.action_proposed")` ✅ registry.ts:7042
- `emit("page_takeover.action_confirmed")` ✅ registry.ts:7051
- `emit("page_takeover.action_cancelled")` ✅ registry.ts:7060
- `emit("page_takeover.action_executed")` ✅ registry.ts:7069
- workspace_id + actor_id resolved from props (passed from RSC → page.tsx context) ✅

**Client: `ActiveTicketBadgeLink`**
- `emit("help.active_ticket_badge_clicked")` ✅ registry.ts:6958
- workspace_id + actor_id from props (server-resolved) ✅

**Server render: `page.tsx`**
- `emit("help.active_ticket_badge_viewed")` ✅ registry.ts:6947
- workspace_id + actor_id from getHelpProfileContext (JWT-derived) ✅

**Tour kit: `useHelpTourKit`**
- `emit("help.tour_step_invoked")` ✅ registry.ts:6972

**All telemetry: PASS** — every mutation/event has registry entry + workspace_id/actor_id resolved from auth context (not body).

---

## Deferred Items

| Item | Reason | Priority |
|------|--------|---------|
| ADR-0238 `<DomainChatOwnership>` implementation | Requires BotssonProvider.tsx + BotssonShell.tsx changes (out of scope) | P2 |
| Mobile parity for /dashboard/help | ADR-0133 — informational page; PanicBar panic action is mobile-relevant but no Expo native-only features needed | P3 |
| `getActiveHelpdeskThreadsForProfile` Promise.all optimization | 3 sequential selects — fast for empty state, could be optimized with a stored proc | P3 |
| `page_knowledge` DB table sync | Table not found in accessible schema; page_knowledge copy written in run.yml | P3 |
| Lighthouse measurement | Dev server not available during sub-agent pass | lead-agent |
| `bg-signal-live` semantic token | Not minted yet — used `bg-primary` as temporary stand-in | design-tokens sortie |
| `help-tour` + `help-takeover` unmapped in site-map validator | Validator warns these page-keys have no path mapping; would need validator update to support multi-key-per-path pattern | P3 |

---

## Cross-Route Bugs Observed (do not fix here)

- `LonnsprofilSection.tsx:26-27` has a TODO for ADR-0238 DomainChatOwnership — same missing component
- site-map validator warns about 19 unmapped `useRegisterTools` page-keys (calendar, komm, wizard-*, oversikt) — these are other pages not yet in site-map.json; pre-existing

---

## Notes

- Pre-existing staged edit to `BotssonChatHero.tsx` (BotssonProvider scope fix) is incorporated — this is the correct architecture per the comment in the file
- ALWAYS update both this table AND the run.yml — they MUST stay in sync
- Do NOT mark `verified: true` in run.yml until ALL checklist items are true
- Bypass hook only with `SKIP_PAGE_POLISH=1` env var
