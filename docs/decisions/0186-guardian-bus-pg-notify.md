---
id: ADR-0186
title: "Guardian event delivery via pg LISTEN/NOTIFY"
status: accepted
date: 2026-04-22
created: 2026-04-22
updated: 2026-04-22
module: MODULE_BOTSSON
tags: [adr, stage-engine, guardian, observability, pg-notify, horizontal-scaling, campaign-a6]
supersedes: null
amends: null
---

# ADR-0186 — Guardian event delivery via pg LISTEN/NOTIFY

## Context and Problem Statement

`services/stage-engine/src/core/guardian-bus.ts` held a per-process `Set<ClientInfo>` and broadcast guardian events synchronously to any in-memory WebSocket subscriber. This coupled event delivery to the process that performed the write — a second stage-engine instance, a worker, or a queue consumer could never deliver a guardian event to a WebSocket client on another instance.

BOTSSON-SYSTEM-MAP flagged the bus as 🔴 ("in-process — ingen cross-process lyttere. Skal erstattes med pg_notify (Phase A6)"). Council 2026-04-16 traced the same in-process SPOF via Learning 0035.

Meanwhile, an existing pattern works end-to-end in the same service: `telegram-bridge.ts` uses a DB trigger + `pg_notify` + stage-engine `LISTEN` loop to relay channel messages. Reusing that pattern is safer than inventing a new transport.

## Decision Drivers

- **Horizontal scaling** — multiple stage-engine instances, Docker re-deploys that briefly run old+new in parallel, future worker processes.
- **Audit parity** — one write path (`guardian_log` INSERT) should feed both audit and live UI, not two paths that can drift.
- **Operational cost** — must not require new infrastructure (Redis pub/sub, dedicated bus service). Postgres is already the source of truth.
- **Preserve call-site API** — `emitGuardianEvent(...)` is called from 20+ sites; renaming or re-shaping it would balloon the blast radius.

## Considered Options

1. **Keep in-process `Set`** — status quo. Zero cost today, but breaks the moment horizontal scaling is attempted; also leaks events on Docker rollouts.
2. **Redis pub/sub** — battle-tested fan-out, but adds an external dependency the droplet does not run today, and duplicates what Postgres already offers.
3. **Postgres `LISTEN/NOTIFY` on `guardian_log`** — AFTER INSERT trigger fires `pg_notify('guardian_events', ...)`, every stage-engine instance's `LISTEN` loop receives the payload and fans out to its own WS clients.
4. **Realtime (Supabase)** — Realtime channel subscription on the `guardian_log` table. Reliable for browser-side subscribers but adds a network hop we do not need for a service-to-service event bus and silently disconnects on long-lived sessions (Learning 0025).

## Decision Outcome

Chosen option: **"Postgres `LISTEN/NOTIFY` on `guardian_log`"** (option 3).

Migration `20260422120000_guardian_log_pg_notify.sql` installs a trigger that fires `pg_notify('guardian_events', <json>)` on every INSERT. New module `services/stage-engine/src/core/pg-notify-bus.ts` owns the consumer side (LISTEN + in-process fan-out). `guardian-bus.ts` becomes a thin façade that re-exports client lifecycle from `pg-notify-bus.ts` and writes events to `guardian_log` synchronously — the trigger does the broadcast.

API surface is unchanged: `emitGuardianEvent()`, `addClient()`, `removeClient()`, `subscribeSession()`, `unsubscribeSession()`, `sendSessionList()` keep their original signatures. No call-site edits required.

## Rules & Consequences

- **Good, because** stage-engine is now horizontally scalable from an event-delivery perspective. Every instance receives every event, regardless of which instance performed the INSERT.
- **Good, because** there is now a single write path — `guardian_log` INSERT. Audit table and live WS feed can never drift apart; they are the same write.
- **Good, because** it reuses a pattern already running in production (`telegram_bridge`). Operators recognise the shape.
- **Good, because** no new infra. `pg_notify` is built into Postgres 17; `pg` is already a stage-engine dependency.
- **Bad, because** `pg_notify` payloads cap at 8 KB. A guardian event with a very large `data` JSONB could be truncated or dropped silently. Mitigation: the existing callers emit compact summaries; large diagnostic blobs belong in the session recorder (ADR-0184), not guardian_log.
- **Bad, because** each stage-engine instance now holds one additional pg client connection. Low cost; acceptable.
- **Neutral:** Learning 0025 (in-process event-bus SPOF) is now resolved for the guardian path. The broader "WebSocket routes need sticky sessions on Vercel" note in L-0025 remains out of scope for this ADR.
- **Agent Impact:** capabilities and core modules keep importing `emitGuardianEvent` from `./guardian-bus.js`. No behavioural change at the call site. When writing new event producers, continue to call `emitGuardianEvent()` — do not bypass it to write `guardian_log` directly, because the trigger is what fans the event out.

## Acceptance Checklist

- [x] Migration applied (`20260422120000_guardian_log_pg_notify.sql`)
- [x] `pg-notify-bus.ts` + unit tests (7 tests, broadcast filtering matrix)
- [x] `guardian-bus.ts` rewired as façade, no in-process `Set`
- [x] `startPgNotifyBus()` mounted in `index.ts` at startup
- [x] `stopPgNotifyBus()` called from graceful shutdown
- [x] Typecheck clean
- [x] Full stage-engine test suite green (72/72)
- [ ] System map L3 Guardian Bus row flipped 🔴 → 🟢 (next commit)

## Related

- Resolves part of Learning 0035 (in-process event bus SPOF)
- Mirrors pattern: `services/stage-engine/src/index.ts` `setupPgNotifyListener()` (telegram-bridge)
- Part of: Campaign Botsson Arena, Phase A6 (observability foundation)
- Sibling ADR: ADR-0116 (runtime telemetry standard — the emit() contract)

---

> Registered in `docs/decisions/0000-decision-log.md`.
