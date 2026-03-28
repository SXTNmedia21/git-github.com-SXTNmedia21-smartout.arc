---
title: "Live Ops Feed Hygiene"
id: LEARNING_0019
status: canonical
layer: learning
created: 2026-03-28
updated: 2026-03-28
tags: [operations, cockpit, telemetry, event-model]
---

# Learning-0019: Live Ops Feed Hygiene

## Context

During council review of Hospitality Operations Cockpit V1, we needed to include both human and agent-origin events on one first-screen activity feed for shift leadership.

## Discovery

Mixed event sources are useful only when normalized and filtered by operational relevance. Without a shared envelope, severity defaults, and dedup rules, the feed quickly becomes noisy and can misrepresent agent authority.

## Impact

Future cockpit/feed work must:

- normalize events into a common envelope before UI rendering,
- apply severity-first defaults and collapse low-signal agent chatter,
- label read-only agent insights separately from executed domain mutations,
- use dedup with correlation keys or bounded time buckets.

## References

- `docs/superpowers/specs/2026-03-28-hospitality-operations-cockpit-v1-design.md`
- `docs/decisions/0065-hospitality-operations-cockpit-v1-contract.md`
