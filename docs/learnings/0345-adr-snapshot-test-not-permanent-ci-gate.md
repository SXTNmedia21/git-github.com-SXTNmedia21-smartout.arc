---
title: L-0345 ADR with one-off snapshot test ≠ permanent CI gate
id: L-0345
status: canonical
updated: 2026-05-24
created: 2026-05-24
module: meta
tags: [adr, ci-gate, regression, council, snapshot-test]
related: [L-0257, L-0297]
---

# L-0345 — ADR with one-off snapshot test ≠ permanent CI gate

## What happened

ADR-0238 (BotssonProvider surface ownership) accepted 2026-05-17 with verification: Solution C shipped + `apps/e2e/tests/domain-chat-ownership/botsson-provider-scope.spec.ts` regression-guard. **No CI gate watched this spec.**

Journey-sweep 2026-05-23/24 BUG-15 reported "7/8 fail" on domain-chat-ownership suite. Chair Phase 3 suspected ADR-0238 regression. **Real cause:** 1 page-crash (OPS-1 OOM cliff) + 6 ERR_NETWORK_CHANGED cascade after web died. The spec itself (line 32) PASSED 9.4s clean. Solution C intact.

**The chair Phase 3 misread happened BECAUSE there was no continuous-verification signal.** A single one-off ad-hoc Playwright run on a chaotic test environment produced a false "regression" framing. If the spec had been promoted to a CI smoke gate, chair would have known it was green within hours of the sweep.

## Why it matters

Accepted ADRs accumulate "promise" but degrade silently when their acceptance criterion is a snapshot run. Future chairs see surface degradation and either:
- Assume regression (false positive — opens unnecessary council, wastes time)
- Dismiss as flake (false negative — misses real regression)

Both failure modes happen because there is no live signal.

## How to apply

**ADR acceptance protocol must declare:**
1. The Playwright/vitest spec that verified the ADR at acceptance time, OR
2. The grep/script gate that verifies the contract continuously, OR
3. **Explicit "no continuous-verification — re-verify manually on related changes" with a watch trigger**

When promoting an ADR from `proposed` → `accepted`, the closing sortie MUST EITHER:
- Add the acceptance spec to a CI smoke gate that runs on every PR, OR
- Document a structural reason (e.g. cost, flakiness) why it cannot be permanent, AND specify the manual re-verification cadence

**For ADR-0238 specifically:** promote `botsson-provider-scope.spec.ts` to the Playwright smoke gate (per chair Phase 5 recommendation in journey-sweep council 2026-05-24).

## Sibling patterns

- [[L-0257]] — phantom-contract accumulator: ADR promises code that was never built
- [[L-0297]] — ADR-to-enforcement-code receipt: ADR claims enforcement, no artifact exists
- This learning is the third axis: ADR built + verified at acceptance, but verification eroded after.

## Precedent count

1st codified occurrence. Three sibling patterns make this an ADR-grade class. Recommend ADR amendment to ADR-0238 documenting the smoke-gate promotion + a process ADR mandating "snapshot-acceptance + watch declaration" for all future ADR closures.
