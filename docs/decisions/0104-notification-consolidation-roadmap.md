---
title: "ADR-0104: Notification Consolidation Roadmap"
id: ADR-0104
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0104: Notification Consolidation Roadmap

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

The original Governance/Training design introduced `reminder_policy` + `reminder_sent_log`. The codebase already has five notification-adjacent patterns: `notification`, `notification_outbox`, `notification_preference`, `channel_notification_policy`, and `contract_reminder`. Adding a sixth parallel pattern would deepen fragmentation.

## Decision Drivers

- Every new domain cannot carry its own `*_reminder` table — fragmentation compounds.
- MVP still needs a working reminder system for training policies.
- A roadmap must exist so later domains consolidate rather than re-fork.

## Considered Options

- **A.** Ship `reminder_policy` + `reminder_sent_log` as designed (6th pattern).
- **B.** Extend an existing notification table with a new "purpose" discriminator.
- **C.** Introduce `notification_policy` + `notification_sent_log` with a `domain` column, scoped to training for MVP, with an explicit consolidation roadmap for existing tables.

## Decision Outcome

Chosen option: **C**.

- Rename to `notification_policy` + `notification_sent_log`.
- Add `domain` column; MVP uses `domain = 'training'`.
- Consolidation roadmap:
  - **M+3:** migrate `contract_reminder` → `notification_policy` (`domain = 'contract'`).
  - **M+6:** evaluate `channel_notification_policy` for merge.
  - **M+12:** single `notification_policy` across all domains.

## Rules & Consequences enforced for Agents

- **Good, because** new domains extend via a `domain` value rather than a new table.
- **Good, because** the roadmap makes future consolidation cheap and explicit.
- **Bad, because** until M+12 two patterns coexist; agents must not treat `contract_reminder` as deprecated prematurely.
- **Agent Impact:** NEVER add `*_reminder` or `*_notification_policy` tables. Extend `notification_policy` with a new `domain` value. When touching reminders in any domain, check whether it is time to execute a roadmap step before forking.
