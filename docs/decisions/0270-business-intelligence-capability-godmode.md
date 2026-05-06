---
title: "ADR-0270 — Business Intelligence capability: godmode-only scrapling toolkit"
id: ADR-0270
status: proposed
date: 2026-05-04
updated: 2026-05-04
module: onboarding
tags: [capability, business-intelligence, scrapling, godmode, lead-research]
---

# ADR-0270 — Business Intelligence capability: godmode-only scrapling toolkit

## Context

Phase 7 of the scrapling Google Places integration sortie (`feat/scrapling-google-places-api`).

Pontus needs a super-user / godmode toolkit that Botsson can call on `/platform-admin/*` routes for:
- Prospect research: find all hospitality businesses in a Norwegian city with contact info
- Onboarding-helper: bootstrap workspace intelligence from BRREG + Places + website-scrape
- Copy generation: produce or rewrite Norwegian workspace description text

All 6 tools are proxies to scrapling microservice (`scrape.smartout.ai`). The capability lives in `packages/ai/src/capabilities/business-intelligence/`.

Precedent: `journey-authoring` capability — same `toolAuthPattern: "direct_admin"` and `defaultAuthority: "read_only"`.

## Decision

### Why godmode-only

Lead-data is a sales-surface, not a product surface. Business intelligence aggregation (B2B contact lists) is sensitive in the GDPR context even when limited to publicly-listed business data — bulk aggregation creates a dataset that may require Art 6 legal basis beyond legitimate interest if stored. Restricting to godmode-users (Pontus + platform-admins) limits the blast radius and ensures the data is used for product-building, not exposed to workspace customers.

The gate is at the BFF layer (`toolAuthPattern: "direct_admin"`) — stage-engine resolves super-admin context before dispatch. No `engine_authority_config` seed migration is needed; the godmode gate supersedes the authority tier for this capability.

### 6-tool boundary (ADR-0173 compliance)

All 6 tools are read-only proxies to scrapling. They do NOT write to any Smartout DB table. This preserves ADR-0173 frozen-4 boundaries — the capability has a well-defined perimeter (scrapling service) and no side effects on the Smartout data model.

Output is ephemeral — returned to chat for human review only. No PII storage from these tools.

### Channel restriction (ADR-0078)

All 6 tools are chat-only. Rationale:
- Lead-data aggregation output can contain email/phone — GDPR-sensitive even for business addresses.
- LLM-generated copy (generate_company_copy) requires precise multi-turn review; voice is insufficient.
- Consistent with pattern for all "content-creation" and "data-aggregation" capabilities.

### Authority posture

```
read_only  → search_brreg, lookup_brreg, scrape_website, enrich_company_intelligence
suggest    → find_hospitality_businesses, generate_company_copy
```

`find_hospitality_businesses` is `suggestTool` because:
- It costs real money (~$0.02 per result × up to 60 = $1.20/call)
- It aggregates B2B contact lists — the `suggest` gate ensures a human is in the loop

`generate_company_copy` is `suggestTool` because:
- LLM-creative output is a form of mutation (writes to wizard state downstream)
- Downstream effects require human confirmation before side effects propagate

The other 4 tools are pure read-only lookups with negligible cost.

### Cost-cap policy

- `find_hospitality_businesses`: telemetry emits `business_intelligence.find_hospitality_businesses.cost` with `estimated_cost_usd` per call → `engine_event` destination enables future heartbeat alerting.
- Daily cost aggregation: Phase 8 follow-up — heartbeat job reading `engine_event` for `business_intelligence.*.cost` events.
- Hard limit: not enforced in Phase 7. BFF caller can add rate-limiting per actor per 24h in Phase 8.

## New endpoint: `/hospitality-search`

Implemented in `services/scrapling/lead_research.py` + registered in `main.py`.

Pipeline:
1. `POST places.googleapis.com/v1/places:searchText` — 1 call ($0.005), paginates to 60 results
2. `GET places.googleapis.com/v1/places/{id}` per result — N calls ($0.017 each), fieldmask: `id,displayName,formattedAddress,internationalPhoneNumber,websiteUri,primaryType,types,rating,userRatingCount,priceLevel,editorialSummary`
3. Email-scrape per `websiteUri` (best-effort, 8s timeout, placeholder-filtered)

Requires `GOOGLE_PLACES_API_KEY` env var (same vault as Phase 1-6 work, 1Password `smartout_ai`).

## Open gaps / known limitations

- Cost hard-cap not implemented (Phase 8)
- Daily aggregation heartbeat job not implemented (Phase 8)
- No authority seed migration — godmode gate at BFF is sufficient today; when broader C4 authority tier support is needed, add `engine_authority_config` seed
- `GOOGLE_PLACES_API_KEY` must be present on droplet (sync-env-to-droplet.sh — done in Phase 6 if not already)

## Binding ADRs

- ADR-0078: chat-only (all tools)
- ADR-0134: actor_id + workspace_id non-null before any emit()
- ADR-0173: no Smartout DB writes from capability tools
- ADR-0191: toolAuthPattern="direct_admin"
- ADR-0270: this ADR — cost-cap policy, GDPR posture, authority tiers
