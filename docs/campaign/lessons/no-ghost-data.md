---
topic: no-ghost-data
status: active
updated: 2026-05-31T18:30:00Z
created: 2026-05-31T18:30:00Z
supersedes:
---

# Decision lesson — no-ghost-data

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

**NEVER ship ghost data.** No UI, dashboard, mockup, report, or demo may display synthetic,
fabricated, hardcoded-sample, or `Math.random()`-generated data presented as if it were real.
Wire to the real source (DB / API / file feed) from the first version — even if it returns little
or nothing. Where no real source exists yet, render an **honest empty/loading/not-connected
state**, never synthetic filler. A little real data beats a lot of fake data, always. This is a
hard project rule, not a preference. Pairs with [[live-db-connection-before-db-claims]] (read real
values, not estimates) and [[live-dashboard-verify-source-emits]] (a still dashboard is usually a
dead producer, fix the source — don't fake the feed).

## Why

A control center built for SmartOut shipped with a `Math.random()` feed over `const FEED_TEMPLATES`
plus hardcoded metrics (12,482 events, $186.40) — it _looked_ alive but every datum was invented.
Pontus's reaction was absolute: "Jag hatar ghost data. Det är det värsta jag vet. Det vill jag
aldrig se igen." Ghost data destroys trust in the entire instrument: fake activity is
indistinguishable at a glance from a real system that's broken, so every number becomes suspect.
A dashboard's only job is to show reality; the moment it shows fiction it is worse than useless.
Real-or-empty is the only acceptable contract.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T18:30:00Z — initial: SmartOut control-center first-rocks used Math.random + baked sample metrics; Pontus: never ghost data again, document everywhere. Rule: wire to real source from v1, honest empty state when no source, little-real > much-fake. Documented in cross-session memory + this lesson + frontend-designer agent hard rules.
