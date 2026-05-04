---
title: "HANDOFF — scrapling-google-places-api"
feature: scrapling-google-places-api
status: ready_to_close
updated: 2026-05-04
created: 2026-05-04
module: onboarding
tags: [handoff, scrapling, google-places, onboarding, business-intelligence]
---

# HANDOFF — scrapling-google-places-api

> Branch: `feat/scrapling-google-places-api` | Worktree: `~/dev/smartout.ai-wt-6` | Base: `development`

## Summary

Replaced Serper Places (sparse, null-payload) with Google Places API v1 inside `services/scrapling/intelligence.py:enrich_from_places`. `/join` Step3 "Generer utkast" now sources `cuisine_types`, `price_category`, `menu_description` from authoritative Google data (rich `types[]`, `priceLevel` enum, `editorialSummary`) instead of falling back to web_search/scrape inference. Quota-exhaustion (429/5xx) falls through to the existing Serper branch, so the wizard never blocks. Adds end-to-end cost telemetry: `[places.api_call]` structured log → `/places-cost` aggregation endpoint → `infra/scripts/google-places-cost-report.sh` → heartbeat job `google-places-quota-check` (Telegram alert at 80% of the $200/mo Maps Platform free tier).

Also extends the scrapling pipeline with a godmode-only `business_intelligence` Botsson capability (Phase 7, ADR-0270): 6 tools proxied to `services/scrapling` for prospect-research, BRREG/Places lookup, website-scrape, and copywriting from `/platform-admin/*` surfaces. All chat-only (ADR-0078), all read-only or suggest-tier, zero Smartout DB writes (ADR-0173).

## Decisions

All registered in `docs/decisions/0000-decision-log.md`:

- **ADR-0270** (proposed) — Business Intelligence capability, godmode-only scrapling toolkit. 6 tools, chat-only, direct_admin authority. New `/hospitality-search` endpoint using Google Places v1 + email-scrape pipeline. Cost-cap via `/places-cost` + heartbeat alert at 80% free tier.

## What was built (by phase)

| Phase | Commit | Δ |
|---|---|---|
| 1 — env wiring | ca6139dda | `.env.template`, `infra/docker-compose.yml`, `infra/scripts/sync-env-to-droplet.sh` |
| 2 — Google-first enrich_from_places | d98c72b91 | +258 lines in `services/scrapling/intelligence.py`: `_google_places_enrich`, `_parse_google_places_details`, `_GooglePlacesQuotaError`, 4 mapping constants |
| 4 — Unit tests | a94cee6b6 | 29 tests in `services/scrapling/tests/test_google_places.py`, all green in container |
| 5 — Cost-cap telemetry | c5a8a9e6e | `_log_places_call` helper, `GET /places-cost?days=N` endpoint, `infra/scripts/google-places-cost-report.sh`, heartbeat handler `~/dev/second-brain-v2/ops/scripts/google-places-quota-check.sh`, `HEARTBEAT.md` job entry |
| Dockerfile fix | b11df9a4d | COPY lead_research.py — was missing, container failed to boot |
| 7 — BI capability | adf825841 db6d4cc3f ca133396a | 6 tools (find_hospitality_businesses, enrich_company_intelligence, generate_company_copy, search_brreg, lookup_brreg, scrape_website), 12 telemetry events, ADR-0270 |

Vault commit (sibling): `d205d20` adds `google-places-quota-check [cooldown: 24h]` to HEARTBEAT.md + the handler script.

## Architecture (as built)

```
/join Step3 "Generer utkast"
  → /api/workspace-intelligence  (Vercel Route Handler)
  → SCRAPLING_SERVICE_URL       (= http://localhost:8000 dev / scrape.smartout.ai prod)
  → POST /enrich
  → handle_enrich(req)
  → phase3_tasks: enrich_from_places(name, city)
       │
       ├─ if GOOGLE_PLACES_API_KEY:
       │     _google_places_enrich
       │       ├─ POST  places:searchText      → log [places.api_call] cost=$0.005
       │       └─ GET   places/{id}            → log [places.api_call] cost=$0.017
       │     _parse_google_places_details      → maps types/priceLevel/editorialSummary
       │     on 429/5xx → _GooglePlacesQuotaError → fall through ↓
       │
       └─ Serper branch (unchanged from before)
            POST google.serper.dev/places      → log [places.api_call] provider=serper

GET /places-cost?days=N (Bearer-auth)
  → grep [places.api_call] in scrapling.log + rotated
  → return JSON with google.calls, cost_usd, free_tier_pct, alert_active

Heartbeat 24h cooldown:
  google-places-quota-check.sh
    → op run -- google-places-cost-report.sh 30
    → curl scrape.smartout.ai/places-cost
    → exit 1 + Telegram alert when alert_active=true
```

## Acceptance status

- [x] Typecheck: `pnpm turbo typecheck` green (verified pre-push, 46/46 cached green)
- [x] All 3 journeys marked `status: verified` based on unit + local-smoke evidence
- [x] Decision log updated (ADR-0270 registered, status: proposed)
- [x] Unit tests: 29/29 green in scrapling container
- [x] Local smoke against Strøm Mat & Bar — Google call returned rating 4.2, 725 reviews, primaryType=restaurant. Cost $0.022 logged via `/places-cost`.
- [x] Plan tasks Phase 1-5 + 7 all checked
- [ ] Phase 6 manual smoke against 5 prod workspaces (deferred — see follow-up below)

## Learnings

1. **Dockerfile gap survives CI.** `lead_research.py` was added in Phase 7 commit but the Dockerfile only copied `main.py + intelligence.py + dashboard.html`. Local rebuild surfaced it as `ModuleNotFoundError: No module named 'lead_research'` — production deploy would have hit the same. Always grep Dockerfile after adding new top-level Python modules.

2. **Cost-cap before deploy is non-negotiable.** Phase 5 cost telemetry shipped *before* Phase 6 droplet-deploy intentionally. $200/mo free tier sounds generous, but a single onboarding spike (1 call/min sustained) would burn it in 7 days. Heartbeat-job + `/places-cost` endpoint is the safety net before the first prod call.

3. **Provider field beats inferring from sources.** Earlier draft tagged `sources.places.category` but no `provider`. Reading the same JSON 3 weeks later you couldn't tell if the data came from Google or Serper without grepping logs. Explicit `provider: "google" | "serper"` makes the JSON self-describing.

4. **`provider="serper", cost=0.0` is intentional.** Serper bills per-credit, not per-USD per-call. Logging cost=0 for Serper while logging real USD for Google means `/places-cost` gives a USD-accurate Google number without polluting it with Serper's internal credit accounting. Reconcile Serper monthly via their own dashboard.

5. **Pre-existing TS errors hide branch errors.** `pnpm --filter web typecheck` from cold cache showed 30+ "module not found" errors that had nothing to do with this branch — they were stale build artifacts in `packages/ai/dist`. `pnpm turbo build --filter=web^...` first, then typecheck = clean signal. Otherwise you can't tell which errors are yours.

## Known issues / debt

- **Phase 6 prod-smoke pending (operator action).** Vault items `Google-Places/api_key` exist in both `smartout_ai` (dev key) and `smartout_ai_prod` (prod key) — verified 2026-05-04. Droplet env synced via `./infra/scripts/sync-env-to-droplet.sh --remote`. **What's missing**: scrapling container on droplet still runs old code (no `lead_research.py`, no `/places-cost`, no Google-first branch). Solution = ADR-0265 standard pipeline: this PR merges to `development`, then `op run -- ./infra/scripts/promote-preview.sh` brings preview, then PR `preview → main`, then main-deploy GHA rebuilds the container with the Dockerfile-fix from `b11df9a4d`. **Do not** ad-hoc SSH the droplet — Phase 6 is gated on standard pipeline per ADR-0265.

- **No Playwright E2E spec.** `apps/e2e/tests/onboarding/wizard-rich-draft.spec.ts` deferred. Unit tests + local smoke cover the regression risk for now (29/29 green covers parsing, fallback dispatch, 4-bucket priceLevel mapping, dedup, edge cases). Follow-up sortie should add the spec when wizard E2E infra is back online.

- **`category_concept_map` + `category_cuisine_map` in Serper-branch are stale.** Now superseded by `GOOGLE_TYPE_CUISINE_MAP` (26 keys) + `GOOGLE_TYPE_CONCEPT_MAP` (15 keys) on the Google side. The Serper-side maps still serve the fallback path with their original 10 keywords each — kept as-is to avoid scope creep. If/when Serper is fully retired, delete those maps.

- **Editorial summary dependency.** `editorialSummary.text ≥ 30 chars` seeds `menu_description`. Many SMB restaurants in Norway don't have `editorialSummary` populated by Google — those will fall back to LLM inference from `concept_clues + web_mentions`. Document in customer-onboarding playbook so first-line knows the spread.

- **`datetime.utcnow()` deprecation warning** — surfaces in test output (`DeprecationWarning: datetime.datetime.utcnow() is deprecated`). Pre-existing in intelligence.py + lead_research.py. Out of scope for this sortie. Tracked as low-priority infra cleanup.

## Follow-up sorties

1. **Phase 6 prod-smoke** — after this PR merges to development → preview → main → GHA deploys droplet, run:
    - `op run --env-file=.env.template -- ./infra/scripts/google-places-cost-report.sh 1` against `scrape.smartout.ai`
    - `/join` Step3 against 5 prod workspaces (Strøm, Bårdshaug, Yogurt, Olivia, Dattebayo) — capture before/after diff of `cuisine_types`, `price_category`, `menu_description`
    - Verify heartbeat job fires within 24h
    - Mark Phase 6 acceptance criteria in plan complete

2. **Playwright E2E specs** — `apps/e2e/tests/onboarding/wizard-rich-draft.spec.ts` + `serper-fallback.spec.ts`. Mock Google response, mock 429, verify Step3 form-state.

3. **ADR-0270 → accepted** — currently `proposed`. After Phase 6 prod-smoke confirms cost-cap works as designed.

4. **`datetime.utcnow()` → `datetime.now(UTC)`** — sweep across `intelligence.py` + `lead_research.py`. Low-priority, separate sortie.

5. **Telegram alert E2E test** — temporarily set `alert_threshold_pct=0.01`, trigger 1 enrich, confirm Telegram + activity-log entry. Restore threshold.

## Next steps for closer

1. `git push` — already pushed (verified at HEAD `b11df9a4d`)
2. `gh pr create --base development --head feat/scrapling-google-places-api`
3. Run `~/.claude/scripts/close-feature.sh <N>` after PR merge
4. Open follow-up sortie #1 (Phase 6 prod-smoke) once development → preview → main pipeline lands the code on droplet
