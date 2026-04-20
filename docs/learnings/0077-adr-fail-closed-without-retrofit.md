---
title: "ADR fail-closed enforcement on shared registry without consumer audit = init-time break"
id: L-0077
status: accepted
layer: learning
module: meta
created: 2026-04-20
updated: 2026-04-20
tags: [learnings, adr, registry, fail-closed, trust-gate, pii]
---

# Learning-0077: ADR that tightens shared-registry enforcement must include a per-consumer retrofit plan

## What Happened

ADR-0163 (amendment to ADR-0078) mandated that `allowedChannels` be non-optional on every `CapabilityDefinition`, with `packages/ai/src/capabilities/registry.ts` init-time assertion throwing when a capability fails to declare. Council 2026-04-20 code-trace found four existing capabilities lacking the declaration: `profile`, `communication`, `governance`, `training`.

If ADR-0163 had been flipped from `proposed` to `accepted` without retrofitting those four, the next `pnpm dev` or production deploy would have thrown at module load → stage-engine boot failure → ALL agent tools down.

The ADR declared enforcement before auditing consumers.

## What We Learned

**Any ADR that adds a required field to a shared runtime registry is a fail-closed contract change. It must include a per-consumer retrofit plan before it can be `accepted`.**

The pattern is:

1. Define the new rule.
2. Enumerate every existing consumer that would fail the rule.
3. Specify the exact declaration each consumer must add.
4. Either (a) land the retrofit in the same PR as the ADR (atomic), or (b) keep the ADR `proposed` until the retrofit PR ships, then flip to `accepted`.

What does NOT count as a retrofit plan: a sentence in "Open Questions" saying "`communication` must be updated" without enumeration of the full consumer list.

## How to Apply

- **At ADR authoring time:** if the ADR changes a shared registry init-contract (mandatory fields, stricter validation, new throws), the author MUST run one code-trace of every existing consumer and enumerate each in a table with required declarations.
- **At ADR acceptance time (gating council):** chair refuses to flip status to `accepted` without the consumer-audit table + retrofit PR link. Acceptance is the enforcement point — not the merge of the ADR file itself.
- **At boot time:** stage-engine + similar shared-registry consumers should fail with a *telemetric* error pointing at the ADR, not a silent throw. When the retrofit is partial, the error must name each still-missing consumer by name. Easier to remediate.
- **In trust gate questions:** add a layer — *"If this ADR is accepted as-written, does the runtime still boot?"*

## Related

- ADR-0163 (the instance)
- ADR-0078 (the predecessor this amends)
- L-0042 (migration-timestamp dependency audit — similar pattern at schema layer)
- L-0066 (default-allow capability authority = CVE-class trap — adjacent, about enforcement defaults)
