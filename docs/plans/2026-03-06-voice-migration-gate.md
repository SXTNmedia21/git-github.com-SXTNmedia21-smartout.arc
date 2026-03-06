# Voice Migration Decision Gate

## Purpose

Define measurable thresholds that decide whether we keep the current Ultravox path or run a LiveKit migration spike.

## Scope

- Current production path: web `voice-assistant` + `/api/wizard/start` + Stage Engine Ultravox adapter.
- Decision here does not change transport immediately; it defines when migration work is justified.

## Stability Window

- Evaluate over rolling 7-day and 14-day windows.
- Ignore local/dev sessions. Use staging + production only.
- Minimum sample size before gating: 200 session start attempts.

## Thresholds

### Keep current transport (no migration spike)

All conditions must hold:

- Session start success rate >= 98.5% (start requested -> join call invoked).
- Connected readiness success rate >= 97.5% (join call invoked -> connected ready event).
- Median time-to-connected <= 3.0 seconds.
- P95 time-to-connected <= 8.0 seconds.
- Provider-specific hard failures (Ultravox create call failed) <= 1.0% of attempts.

### Trigger migration spike (LiveKit Cloud vs self-hosted)

Trigger if one or more conditions hold for two consecutive windows:

- Session start success rate < 97.0%.
- Connected readiness success rate < 95.0%.
- Median time-to-connected > 4.0 seconds.
- P95 time-to-connected > 10.0 seconds.
- Provider-specific hard failures > 2.5%.
- User-visible fallback path activated > 5.0% of attempts.

## Spike Deliverables (if triggered)

- 1 week technical spike comparing:
  - LiveKit Cloud
  - Self-hosted LiveKit
- Compare:
  - Integration effort (web + stage-engine)
  - Ops burden and incident recovery
  - End-user quality and latency
  - Monthly cost at current + projected usage
- Keep Stage Engine tool contract unchanged to reduce refactor risk.

## Decision Rule

- If LiveKit Cloud wins on reliability and time-to-market: choose Cloud first.
- If self-hosted wins on total cost but increases risk, require explicit owner approval before adopting.
- If neither clearly outperforms stabilized Ultravox baseline, remain on current path.
