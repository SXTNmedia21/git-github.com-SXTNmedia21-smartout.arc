---
title: "Journey — Google Places quota + cost observability"
feature: scrapling-google-places-api
journey: quota-observability
status: verified
verified_at: 2026-05-04
e2e_test: services/scrapling/tests/test_google_places.py
created: 2026-05-04
updated: 2026-05-04
module: onboarding
tags: [journey, scrapling, telemetry, heartbeat, cost]
---

# Journey: Google Places quota + cost observability

**Role:** Pontus (operator); Smartout finance (downstream)

**Precondition:**
- Google Places integration deployed to droplet
- `infra-scrapling-1` writing logs to `/data/scrapling.log` (RotatingFileHandler 10MB×5)
- Heartbeat skill operational, `~/dev/second-brain-v2/HEARTBEAT.md` configured

## Happy Path

1. Each `enrich_from_places` call logs structured event: `places.api_call provider=google place_id=ChIJ... status=200 cost_estimate=0.022`
2. Daily 09:00 CEST heartbeat job `google-places-quota-check` (cooldown 24h) runs `infra/scripts/google-places-cost-report.sh`
3. Script SSH'es to droplet, greps `places.api_call` events from last 24h, aggregates: total_calls, calls_by_provider (google/serper), total_cost_estimate, daily_running_total
4. Output written to `~/dev/second-brain-v2/ops/reports/YYYY-MM-DD-google-places-cost.md`
5. If `daily_running_total > $5.50` (~80% of $200/mo / 30 days = $6.67/day budget) → Telegram alert via `~/.claude/scripts/heartbeat-notify.sh telegram "Google Places at 80%: $X.XX/day"`
6. If `total_calls > 1000/day` → Telegram alert (volume signal)
7. Pontus sees alert in Telegram + report in Obsidian → can opt to lower wizard volume, raise budget, or increase fallback-to-Serper ratio

**Postcondition:**
- Pontus has visibility into daily Google Places cost without needing to log into Google Cloud Console
- Report log is append-only audit trail for finance reviews
- Free-tier exhaustion never surprises (alert fires at 80%)

## Error Paths

- **Droplet unreachable from heartbeat host** → script logs `ssh-failed` to activity-log, alerts via Telegram. Alert ALSO fires if 2 consecutive runs fail (catches sustained connectivity issues).
- **No `places.api_call` events found** (scrapling not logging structured events) → script reports `0 calls` which is itself a signal — operator investigates whether logging is broken or onboarding is paused.
- **Google billing alert from Google Cloud Console fires before our 80% alert** → expected fallback. Our alert is the early-warning, Google's is the hard cap. Both should be enabled.
- **Cost-estimate calculation drifts from actual Google billing** (rate changes) → reconcile monthly, update `cost_estimate` constants in scrapling logger.

## Verification

- [x] Implementation matches the steps above (commit c5a8a9e6 — `_log_places_call` + `/places-cost` endpoint + cost-report script)
- [x] Heartbeat job registered in `~/dev/second-brain-v2/HEARTBEAT.md` with 24h cooldown (vault commit d205d20)
- [x] `/places-cost` endpoint verified locally: returned `{google: {calls: 2, cost_usd: 0.022, by_endpoint: {search: 1, details: 1}}, free_tier_pct: 0.01, alert_active: false}` after 1 real Strøm Mat & Bar enrich
- [x] `infra/scripts/google-places-cost-report.sh` syntax-verified (`bash -n`); curls `/places-cost` with Bearer + parses JSON via jq
- [ ] Live droplet smoke of cost-report-script (Phase 6 — runs against scrape.smartout.ai once container deployed)
- [ ] Telegram alert verified by setting threshold to $0.01 + triggering enrich (Phase 6 follow-up)
- [ ] First 7-day real-volume report (Phase 6 +7d)

**Verified on local + unit. Live droplet validation deferred to Phase 6 follow-up.**
