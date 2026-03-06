# Voice Problem Handoff

## Current status

Voice is still unreliable to start from the dashboard voice widget.

## Confirmed symptoms

- User clicks `Start chat`.
- Sometimes request succeeds, sometimes fails.
- When it fails, it is not a UI-only issue; backend returns real errors.

## Hard evidence found

From runtime logs in the active dev terminal and web log:

- `shift-assistant` mission is missing in Stage Engine:
  - `Mission "shift-assistant" not found`
  - then fallback to `mr-botsson`
- Fallback call to Ultravox intermittently fails with provider throttle:
  - `ULTRAVOX_CREATE_CALL_FAILED`
  - `details: {"detail":"Too many concurrent calls."}`
  - `upstream_status: 429`

So there are two backend-side voice blockers:

1. Missing `shift-assistant` mission in Stage Engine DB/session source.
2. Ultravox concurrent call throttling (`429`).

## What was already done on frontend

In `apps/web/src/components/voice-assistant.tsx`:

- Added connect watchdog timeout + cleanup.
- Added clearer failure handling when disconnected before ready.
- Added explicit retry-friendly error state.

This improves UX/failure recovery, but does not fix backend `404` / `429` causes.

## Voice-only root cause summary

Primary root cause is backend voice orchestration instability:

- Wrong mission resolution (`shift-assistant` not found).
- Provider quota/limit breaches (`429 Too many concurrent calls`).

## Recommended next actions (voice-only)

1. Restore/register `shift-assistant` in Stage Engine mission store so no fallback is needed.
2. Handle Ultravox `429` with retry/backoff in the create-call path (Stage Engine adapter first, then web proxy if needed).
3. Add a temporary single active call guard per user/session in create-call path to reduce parallel call spikes.
4. Keep frontend watchdog as-is (good safety net).

## Files relevant to voice issue

- `apps/web/src/components/voice-assistant.tsx`
- `apps/web/src/app/api/wizard/start/route.ts`
- `services/stage-engine/src/routes/adapters/ultravox.ts`
- `packages/ai/src/missions/registry.ts`
- Runtime evidence logs: `.dev-web.log` and active terminal output showing `404` mission + `429` provider errors.
