---
title: "Handoff — 2026-05-04 evening session"
status: in_progress
created: 2026-05-04
updated: 2026-05-04
module: meta
tags: [handoff, scrapling, google-places, mobile, deploy]
---

# Handoff — 2026-05-04 evening

> Context-flytt før mobile-restore campaign åpnes. Pause-state, ikke closure.

## What shipped

### Phase 7 — Botsson `business_intelligence` capability (4 commits on `feat/scrapling-google-places-api`, wt-6)

Godmode-only, chat-only, `toolAuthPattern: "direct_admin"`. 6 tools:

- `find_hospitality_businesses(city, types?, limit?)` — Google Places lead-gen
- `enrich_company_intelligence(company_name, city?, website_url?, org_number?)` — wraps `/enrich`
- `generate_company_copy(intelligence, rewrite_field?, rewrite_mode?, current_text?)` — wraps `/generate`
- `search_brreg(query, city?)` — fuzzy fuzzy company-search
- `lookup_brreg(org_number)` — exact BRREG lookup
- `scrape_website(url, mode?)` — wraps `/extract`

Files: 16 (16 ny + modifisert). Norwegian descriptions. 12 telemetry events. ADR-0270 drafted + registered. Typecheck verified green via `pnpm turbo typecheck` after `pnpm install` in wt-6.

### Phase 1 — env-wiring (1 commit on same branch)

- `.env.template` → `GOOGLE_PLACES_API_KEY="op://smartout_ai/Google-Places/api_key"`
- `infra/docker-compose.yml` → scrapling container env passthrough
- `infra/scripts/sync-env-to-droplet.sh` → prod manifest entry

### Droplet incident chain (resolved)

1. **scrapling /generate 502** — Mar-24-stale container kjørte retired `claude-3.5-sonnet` model (OpenRouter 404)
2. **Full pull + rebuild** — git stash preserved Tailscale n8n-bind on `docker-compose.prod.yml`, pull origin/main → 944cb501, stash pop konflikt-fri
3. **Build + recreate** — 64s build, all 6 services healthy, `/generate` 200 with `claude-sonnet-4.6`
4. **`BOTSSON_SERVICE_JWT` disabled** — Supabase access_token expires in 1h, broken-by-design pattern. Removed from droplet sync manifest. Voice-agent on droplet logs "BOTSSON_SERVICE_JWT mangler" until refactor.

### op-auth.json + secrets workflow

- File restructured to proper JSON array (2 profiles: `smartout-dev` → `smartout_ai` vault, `deploy` → `smartout_ai_prod` vault)
- `OP_SA_PROFILE` env-var pattern proposed but `.env.sh` not yet wired
- Deploy SA used explicitly for sync-env-to-droplet.sh (selecter via `jq`)

### Google Places verified

Test against Oslo restaurants vs Serper:

| Metric | Serper | Google Places |
|---|---|---|
| Phone | 0/20 | 18/20 |
| Email | 14/20 | 17/20 |
| Cuisine type | — | 20/20 |
| Price level | — | 15/20 |
| Rating + reviews | — | 20/20 |

Cost: $0.345 for 20 places (under estimat).

## What's open

### wt-6 sortie `feat/scrapling-google-places-api` — Phase 2-6 pending

- **Phase 2**: refactor `services/scrapling/intelligence.py:enrich_from_places` (Serper → Google with Serper fallback). Lines 472-538 + 1160-1265 are target. Code patterns already verified working in `services/scrapling/lead_research.py` (built in Phase 7).
- **Phase 3**: ADR-0270 status `proposed` → after Phase 2 verify, promote to `accepted`
- **Phase 4**: 4 unit tests (priceLevel map, types[] map, 429 fallback, 5 real-workspace integration)
- **Phase 5**: telemetry — `infra/scripts/google-places-cost-report.sh` + heartbeat job `google-places-quota-check`
- **Phase 6**: deploy to droplet (build + recreate scrapling), smoke-test 5 workspaces

### Mobile-restore campaign (NOT YET OPENED)

Pontus wanted CAMPAIGN not sortie. Context for next session:

**Current 6-tab state vs target 4-tab master-plan (per ADR-0133):**

| Current | Status | Action |
|---|---|---|
| `(home)` "Hjem" | viser som `(HOME)` raw | `href: null` (FAB-only) |
| `digest` "Digest" | drift fra master-plan | DELETE |
| `(shifts)` "Kalender" | works (Pontus says so) | retitle "Vakter"? avklar |
| `(komm)` "Min kø" | drift (helpdesk-campaign uten ADR) | DELETE |
| `(chat)` | works | KEEP |
| `(me)` "Min side" | works | rename "Min tid"? avklar |
| journey/[id]/guided | leaks to tab-bar | `href: null` |

**Specific bugs identified:**

1. App cold-starts on Calendar (Vakter), should land on Home (FAB-anchor)
2. `JOURNEY/[ID]/GUIDED` viser i bottom tab-bar (screenshot bekreftet 2026-05-04 16:55)
3. `(HOME)` renders raw segment-name istedenfor "Hjem" title
4. Calendar tab content broken (Pontus: "skal vise skjermen som var ved oppgaver")

**Root cause analysis:**

- `apps/mobile/app/(app)/journey/[id]/guided.tsx` exists som file men IKKE registrert med `href: null` i `<Tabs>` config (`apps/mobile/app/(app)/_layout.tsx:75-80`)
- Custom `tabBar={renderTabBar}` (BottomNav) rendrer raw segment når `href: null` ikke respektert eller ikke set
- `(home)/index.tsx` er Redirect-stub til `(home)/shift-hub.tsx` — phase-aware view med 4 states (no_shift, before_shift, during_shift, after_shift)

**Pontus' design intent (clarified 2026-05-04):**

- Home er ikke en sub-page i tab-bar — Home = anker, FAB = entry
- Home `shift-hub.tsx` har 4 phase-states: no_shift, before_shift, during_shift, after_shift
- Tabs that work: FAB, Chat, Vakter, Min tid
- Tabs that should be HIDDEN: Home (FAB-only), Journey Guard

**Open clarifications for next session:**

1. Calendar tab: `(shifts)` broken? eller skal det erstattes av Tasks/Oppgaver?
2. Min tid: rename av `(me)` til "Min tid", eller eksisterer separat skjerm?
3. Tab-bar component: hvilken fil er BottomNav i `apps/mobile/src/components/navigation/`?

### Outstanding sortier

| Sortie | Branch | Status |
|---|---|---|
| wt-1 | `feat/botsson-orb-voice-mount` | 0 journeys declared, last commit 2 days ago |
| wt-2 | `feat/innkalling-og-policies` | 1 journey, last commit 2 days ago |
| wt-3 | `feat/botsson-sdk` | 0 journeys, last commit 2 days ago |
| wt-4 | `feat/pwa-telemetry-build` | 1 journey, last commit 5h ago |
| wt-5 | `feat/billing-erik-seed` | 2 journeys, last commit 4h ago |
| **wt-6** | **`feat/scrapling-google-places-api`** | **3 journeys, Phase 1+7 done, Phase 2-6 open** |

### Outstanding from prior session

- `/join` Step3 fattige drafts will improve once Phase 2 (Serper → Google) ships in wt-6
- Voice-agent JWT-refaktor sortie pending (refresh-token / service_role / token-mint endpoint)
- Vercel-side `SCRAPLING_AUTH_TOKEN` parity-sjekk vs droplet (heartbeat-drift-check)

## How to pick up

### Path A — Continue wt-6 (scrapling-google-places-api)

```bash
cd ~/dev/smartout.ai-wt-6
tmux new -s smartout.ai-6 -n "wt-6:scrapling-google-places-api" -c $(pwd)
# Phase 2: refactor services/scrapling/intelligence.py:enrich_from_places
# Reference services/scrapling/lead_research.py for working Google Places patterns
```

### Path B — Open mobile-restore campaign

```bash
cd ~/dev/smartout.ai
~/.claude/scripts/new-campaign.sh mobile-restore-4tab-plan
# Creates ~/dev/smartout.ai-mobile-restore-4tab-plan with branch campaign/mobile-restore-4tab-plan
# (Note: master-plan called for "campaign/mobile" but that name conflicts with existing campaign/mobile)
```

Note: campaign `campaign/mobile` already exists per DASHBOARD (status: just now, 0 behind, 1 ahead). Investigate its scope before opening duplicate. Pontus may have intended to extend that one.

### Path C — Fix urgent mobile bugs first (quick-fix on development)

3-line fix to hide Home + Journey from tab-bar:

```ts
// apps/mobile/app/(app)/_layout.tsx:75
<Tabs.Screen name="(home)" options={{ title: "Hjem", href: null }} />
// Add new screen entry to suppress journey leak:
<Tabs.Screen name="journey/[id]/guided" options={{ href: null }} />
```

Plus delete `digest` + `(komm)` Tabs.Screen entries (or set `href: null`). Commit on development directly. ~10 min.

## Decisions made

1. Use prod-vault `smartout_ai_prod` for ALL deploy targets (Vercel + droplet) — sync-scripts confirmed compliant
2. Disable `BOTSSON_SERVICE_JWT` in droplet sync manifest — antimønster, separat sortie for refresh-token-pattern
3. Restructure `op-auth.json` to proper array — duplicate keys was bug
4. Open wt-6 sortie `scrapling-google-places-api` — replace Serper with Google Places API v1
5. Phase 7 (capability surface) shipped before Phase 2-6 — Pontus needed lead-list tool ad-hoc for sales-research
6. Defer mobile-restore-4tab-plan to dedicated campaign (NOT sortie)

## Learnings

- **Stale container = silent prod-bug**: scrapling on droplet was 6 weeks behind code. Mar-24 image had retired OpenRouter model. No alarm fired because /enrich worked, only /generate failed. Heartbeat drift-check covers env-var parity but not container-vs-code parity. Add image-age check.
- **Serper Places sparse for NO**: Norwegian restaurants return only address+phone+website+lat/lon, never category/rating/priceLevel. Verified across SMB (Dattebayo Bø) + chain (Olivia Aker Brygge). Architecture decision: switch to Google Places API v1, keep Serper as fallback only.
- **Supabase access_token in long-lived vault = antimønster**: Tokens expire ~1h, vault is long-lived. Pattern brytes hver time. Refresh-token in vault + boot-side refresh = correct pattern.
- **expo-router auto-tab leakage**: Any `.tsx` file under tab-layout that's not explicitly declared with `href: null` becomes a visible tab. `journey/[id]/guided.tsx` leaked because no Tabs.Screen entry suppressed it.
- **end-session DASHBOARD-status drift**: end-session.sh edits DASHBOARD.md `updated:` field. Prior session set 2026-05-06; today's reset to 2026-05-04. Cosmetic but tracks "last touched" not "last reconciled".

## What I'd want next session to know

- wt-6 has install in node_modules already — typecheck works without additional pnpm install
- Phase 2 work in `intelligence.py` should reuse `lead_research.py` patterns (Phase 7 lift). Both call same Google Places endpoints.
- Mobile-restore campaign needs decision: extend existing `campaign/mobile` or open `campaign/mobile-restore-4tab-plan`. Check DASHBOARD anomaly section for `campaign/mobile` scope.
- BottomNav component location not verified this session — grep for it next time before tab-config-changes.
