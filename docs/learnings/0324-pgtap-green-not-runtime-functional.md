---
title: "L-0324: pgTAP-green ≠ runtime-functional — migration-apply proves schema, not pipe wiring"
id: L-0324
status: accepted
created: 2026-05-20
updated: 2026-05-20
module: cascade
tags: [learning, ci, cascade, engine-event, invocation-edge, trust-gate]
---

# L-0324: pgTAP-green ≠ runtime-functional

## Context

ADR-0379 employee-activation cascade (PR #434) passed every CI check including pgTAP
(migrations apply + DB tests) and merged to development. A post-implementation council
(2026-05-20) found it **completely non-functional**: the docuseal webhook did
`void admin.from("engine_event").insert(...)` — a raw DB write — but **nothing invokes
engine-dispatch** on an engine_event insert:

- `engine-dispatch` is a POST-body server (`Deno.serve` + `req.json()`) — it does NOT
  scan the `engine_event` table.
- The only trigger on `engine_event` INSERT is the Komm channel projection (which doesn't
  even whitelist `contract.signed`).
- `heartbeat-dispatcher` cron only resumes `engine_state status='scheduled'`.

So the inserted event died at the channel projection. No `engine_state` created,
`gate_action` never called, `profile.status` never flipped, `profile.activated` never emitted.

## Learning

**A capability can pass every test and apply every migration cleanly while being completely
non-functional, because tests prove the *schema* and the gate's *internal* logic — never
the *invocation edge*: who calls the entrypoint with what payload.**

pgTAP applies migrations and asserts DB-level shape. It does NOT exercise the producer→
consumer HTTP/dispatch boundary. A raw `.insert()` into `engine_event` is NOT dispatch.

## Why

The reviewers who analyzed downstream segments (gate semantics, telemetry shape) returned
"no blocker" because they *assumed* the pipe fires. Only the reviewer who code-traced the
invocation edge (who calls engine-dispatch) found it unwired. The orchestrator's own
"runtime-unverified" caveat at merge was the tell — it was true.

## How to apply

- For ANY "event drives downstream mutation" claim, grep the actual invocation:
  `functions.invoke("engine-dispatch")` / `fetch .../functions/v1/engine-dispatch` / a
  `net.http_post` trigger ON THAT TABLE. A bare `.insert()` into `engine_event` is a
  dead-drop, not dispatch.
- Trust gate: "migrations apply" and "pgTAP green" do NOT satisfy a runtime-functional
  claim. Require an end-to-end trace test (sign contract → assert engine_state created →
  profile flipped → telemetry landed via `expectTelemetryEvent`).
- Sibling family: L-0177 (silent fallback), telemetry-registry-without-emit-wiring
  (registry entry ≠ emit call-site). Same shape: **declared intent without the wiring that
  realizes it.**

## References

- ADR-0379 (signature-as-C4-authorization — reverted to proposed)
- `apps/web/src/app/api/webhooks/docuseal/route.ts` (orphan insert → fixed to invoke)
- `supabase/functions/engine-dispatch/index.ts:183,192` (POST-body-only)
- `apps/web/src/app/api/engine-dispatch/route.ts` (correct invoke pattern)
- Council 2026-05-20 (REJECT, 7th L-0147 chair self-reversal)
