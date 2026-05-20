---
title: "Journey — Voice latency regression check post-upgrade"
feature: voice-gpt-realtime-upgrade
journey: latency-regression
status: draft
verified_at: null
e2e_test: null
created: 2026-05-19
updated: 2026-05-19
module: ai
tags: [journey, voice, vad-bench, regression]
---

# Journey: Voice latency regression check post-upgrade

**Role:** developer (sortie operator)

**Precondition:**
- `services/voice-agent` runs locally with LiveKit room joinable
- `vad-bench` script + recorded fixtures available under `services/voice-agent/scripts/vad-bench/`
- Baseline captured BEFORE any code change (T0.2) and stored in `docs/learnings/voice-gpt-realtime-baseline.md`

## Happy Path

1. Operator runs `pnpm --filter @smartout/voice-agent vad-bench` 3 times on `gpt-realtime` post-upgrade → System collects per-turn latency (first-speech, end-of-turn, full-response) → Operator computes p50 + p95 across all turns
2. Operator compares post-upgrade p50/p95 against baseline → Delta computed per percentile
3. Operator records deltas in `docs/learnings/voice-gpt-realtime-baseline.md` + this journey verification table → Updates `status: verified` if all 3 metrics within ±10%

**Postcondition:**
- p50 first-speech, p50 end-of-turn, p95 end-of-turn all within ±10% of baseline
- Delta documented + linked from PLAN T3.3
- `status: verified` set in this journey frontmatter

## Error Paths

- **Scenario:** post-upgrade p95 > baseline + 10% → escalate to journey 2 listening test; consider tuning `silence_duration_ms` or rolling back `model:` to plugin default
- **Scenario:** vad-bench script broken by recorder.ts model-string update → fix in T1.3, re-run baseline if recorder fix changes recording semantics
- **Scenario:** insufficient turn samples (< 30 per run) → re-run with longer fixture; do not trust deltas computed on <30 turns

## Verification

- [ ] Implementation matches the steps above
- [ ] vad-bench post-upgrade run completed 3× and percentile deltas recorded
- [ ] Manually inspected delta table — all 3 metrics within ±10%

**Mark `status: verified` in frontmatter when all three boxes are checked.**
