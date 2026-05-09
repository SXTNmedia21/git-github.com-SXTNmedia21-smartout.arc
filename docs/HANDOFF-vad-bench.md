---
title: "HANDOFF: vad-bench — Pre-Sortie Gate (ADR-0282 R6)"
status: done
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
tags: [voice, vad, bench, adr-0282, pre-sortie-gate, handoff]
---

# HANDOFF: vad-bench

## What was built

A deterministic, CI-runnable benchmark for measuring OpenAI Realtime server-VAD turn-taking
performance against ADR-0282 R6 absolute targets. Hard-fails on any target miss.

**Pre-sortie gate for ADR-0282 E6** (Ultravox deletions) — E6 sortie MUST NOT open without
this bench passing with exit 0.

## Architecture

Two-phase per run:

1. **Record phase (`--record`):** drives OpenAI Realtime WebSocket API with 20 synthetic WAV
   fixtures using the exact `turnDetection` config from `agent.ts:114-123`. Captures
   `audio_end_ms` (buffer-relative) from `input_audio_buffer.speech_stopped` events.
   Writes `scripts/vad-bench/output/bench-results-<timestamp>.json`.

2. **Score phase (default):** reads latest bench-results JSON, computes P50/P95 latencies
   + false-end ratio, writes `bench-summary.md`, exits 0 on PASS / 1 on FAIL.

## Files created

| File | Purpose |
|------|---------|
| `scripts/vad-bench/types.ts` | Zod schemas + TARGETS constant (ADR-0282 R6 codified) |
| `scripts/vad-bench/percentile.ts` | Nearest-rank percentile (pessimistic — P95=901 must fail) |
| `scripts/vad-bench/false-end.ts` | isFalseEnd + falseEndRatio pure fns |
| `scripts/vad-bench/markdown.ts` | CI-attachable markdown formatter |
| `scripts/vad-bench/scorer.ts` | scoreBench orchestrator — pure data transformation |
| `scripts/vad-bench/recorder.ts` | OpenAI Realtime WebSocket recorder |
| `scripts/vad-bench.ts` | CLI entry (score/record modes) |
| `scripts/vad-bench/__tests__/percentile.test.ts` | 6 vitest cases |
| `scripts/vad-bench/__tests__/false-end.test.ts` | 7 vitest cases |
| `scripts/vad-bench/__tests__/markdown.test.ts` | 3 vitest cases |
| `scripts/vad-bench/__tests__/scorer.test.ts` | 5 vitest cases |
| `scripts/vad-bench/fixtures/README.md` | Fixture authoring rules + scenario catalog |
| `scripts/vad-bench/fixtures/0001-*.json` ... `0020-*.json` | 20 seed fixture JSON files |

## TDD coverage

4 modules, 21 vitest cases:
- `percentile`: 6 cases (empty, singleton, odd-length, 20-element, unsorted, clamped)
- `false-end`: 7 cases (boundary/exact, before-audio-end, mid-speech cut, empty, zero-ratio, half-ratio, all-ratio)
- `markdown`: 3 cases (passing run, failing run, total count)
- `scorer`: 5 cases (all-pass, P95-miss, false-end-miss, empty, orphan-recording)

## Targets codified (ADR-0282 R6)

```typescript
TARGETS = { P50_MS: 600, P95_MS: 900, FALSE_END_RATIO: 0.05 }
```

These are in `types.ts`. DO NOT tune targets to make tests pass — requires ADR amendment.

## Council R3 2026-05-08 decisions reflected

### Recorder coordinate-system contract

`evt.audio_end_ms` from `input_audio_buffer.speech_stopped` is **buffer-relative**
(same coordinate system as `fixture.audio_end_ts_ms`). The recorder NEVER falls back to
`Date.now() - startedAt` (wall-clock). If `audio_end_ms` is absent, recorder throws hard
per fixture. Code: `recorder.ts:93-101`.

### Fixture count: 20 minimum

Statistical rationale: P95 of 10 samples = index 9 (worst sample) — one outlier breaks
the bench. P95 of 20 samples = index 18 — stable tail. 20 fixtures committed.

### False-end-pressure scenarios: ≥4

Scenarios 17-20 designed to potentially trigger false VAD end-of-turn:
- `0017-trailing-uhm` — "uhm" 200ms after main utterance ends
- `0018-filler-word-mid` — "er" filler with 500ms gaps
- `0019-declarative-rising` — rising intonation on declarative
- `0020-breath-only-gap` — 700ms inhale mid-utterance

### Voice-ID orthogonality

vad-bench measures server VAD, NOT TTS output. `agent.ts:107` voice setting
(currently "verse", PO-lock "coral") does not affect VAD timing. This bench
does not touch agent.ts.

## Deviations from plan

1. **Scorer test P95-miss case adjusted**: plan draft assumed `i===19` single outlier
   would push P95 above 900ms. With nearest-rank formula `ceil(q*n)-1` and 20 elements,
   P95 = index 18. Single outlier at index 19 gives P95=500ms (passes). Fixed to use
   2 outliers (i>=18) so index 18 = 1000ms (fails). This is the correct behavior for
   the formula; the plan draft had a formula mismatch. The percentile formula itself is
   validated by 6 independent test cases including the canonical 20-element P95=1900 case.

2. **Recorder uses `ws` package (not browser WebSocket)**: Node.js 20 lacks built-in
   WebSocket. Added `ws` + `@types/ws` as devDependencies. `openai` also added as
   devDependency (was transitively available via `@livekit/agents-plugin-openai`).

3. **`false_end_pressure` field added to fixtureSchema**: optional field to label the
   4 pressure scenarios. Not in original plan types, added during fixture creation.

## First-run operator instructions

WAV files are NOT committed (binary artifacts). Operator must generate before first record run:

```bash
# Install: sudo apt-get install espeak-ng sox (Linux/WSL2)
cd services/voice-agent/scripts/vad-bench/fixtures/wav

# Example for fixture 0001 (repeat for all 20):
espeak-ng -v no -s 160 "Hei Botsson, hva er status på dagens vakter?" --stdout \
  | sox - -r 16000 -c 1 -b 16 -e signed-integer 0001-short-utterance.wav pad 0 2

# Then run:
op run --env-file=../../.env.template -- pnpm --filter @smartout/voice-agent vad-bench:record
pnpm --filter @smartout/voice-agent vad-bench
echo $?  # Must be 0 for PASS
```

## First-run verdict

**Operator must run** — not runnable without `OPENAI_API_KEY` + WAV files. This PR documents
the pre-gate requirement. Run outcome will be logged separately by operator before E6 opens.

## Sortie pre-flight protocol

Before any ADR-0282 E6 sortie (Ultravox deletions):

1. `pnpm --filter @smartout/voice-agent vad-bench:record` (requires OPENAI_API_KEY + WAVs)
2. `pnpm --filter @smartout/voice-agent vad-bench` — must exit 0
3. Attach `bench-summary.md` to E6 sortie PR description

## Known issues / debt

- **WAV files not committed**: binary artifacts (~100KB each, ~2MB total). Operator generates
  locally. Consider a `generate-fixtures.ts` TTS script for automation (deferred, out of scope).
- **No CI workflow YAML**: bench callable by hand. OPS-followup: add GitHub Actions job to run
  bench on PRs touching `agent.ts` turnDetection config.
- **session.updated handshake**: recorder sends `session.update` on open, then waits for
  `session.updated` before sending audio. If OpenAI Realtime API changes the handshake,
  this will need updating.

## Next steps

- Operator: generate WAVs, run record phase, verify exit 0
- OPS-followup: CI workflow YAML for bench on agent.ts changes
- E6 sortie opens ONLY after bench shows exit 0 on record+score run
