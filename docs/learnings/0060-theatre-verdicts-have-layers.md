---
title: "'Theatre' verdicts have layers — transport, telemetry, design presence"
id: LEARNING_0060
status: canonical
layer: learning
created: 2026-04-19
updated: 2026-04-19
tags: [council, process, verdict-resolution, mobile-strategy]
---

# Learning-0060: "Theatre" verdicts have layers — resolve each independently

## Context

Mobile Strategy Council (2026-04-17) verdicted: "Botsson on mobile is theatre — voice never connects, chat never reaches stage-engine. Telemetry corrupted in 6 mutation sites." System Health Audit (2026-04-18 / 2026-04-19) traced the code and found:

- **Transport** — mobile chat now routes via `/api/emma/chat` BFF to stage-engine (commits `6b39d877` + `f9d0f6b8` + `5a5aca9c` landed 2026-04-18, specifically remediating the prior council's findings). Verified at `apps/mobile/src/lib/web-api.ts:40-42` and `apps/web/src/app/api/emma/chat/route.ts:61-114`. RESOLVED.
- **Telemetry** — 2 mobile mutations still emit with `workspace_id: null, actor_id: ""` (use-cancel-absence.ts:69-70, use-confirm-hours.ts:40-41). Still broken. (Mobile Strategy Council's "6 sites" claim was stale — Supervisor confirmed 4 already fixed.)
- **Design presence** — mobile Botsson has no Nordic Split idle/listening/thinking/speaking states. Functionally wired, aesthetically absent. Still broken at the design layer.

Phase 5 synthesis by System Steward classified this as "partial overlap, different layers" and amended (not retracted) the prior verdict.

## Discovery

"Theatre" is a rhetorically strong single-word verdict that masks layered failure modes. When a council issues a "theatre" verdict, downstream councils must:

1. **Decompose into layers** — transport (does the call arrive?), telemetry (does the event record?), presence (does the user see evidence?).
2. **Resolve each layer independently** — one layer being fixed does not fix the others.
3. **Amend, don't retract** — if one layer is fixed but others aren't, the original verdict is partially correct. Retraction would orphan the unresolved layers.

Without this decomposition, downstream councils risk either (a) assuming the whole thing is still broken because one layer is, or (b) assuming the whole thing is fixed because one layer is. Both lead to misallocated remediation effort.

## Impact

- **Council synthesis rule:** For any verdict using strong rhetorical language ("theatre", "broken", "dead", "empty"), Phase 5 synthesis must decompose into independently-resolvable layers before classifying "hold/amend/retract".
- **Verdict storage:** Prior-verdict checks in Phase 1 should include the layer decomposition so subsequent councils inherit the right granularity.
- **Remediation planning:** Plans responding to "theatre"-style verdicts must explicitly claim which layer they address. "Botsson on mobile works now" is false if it means only transport.

## References

- Council: 2026-04-17 Mobile Strategy Brainstorm (COUNCIL-LOG.md)
- Council: 2026-04-18 / 2026-04-19 System Health Audit (COUNCIL-LOG.md)
- Commits that resolved transport layer: `6b39d877`, `f9d0f6b8`, `5a5aca9c` (2026-04-18)
- L-0044 (parity-graveyards), L-0046 (no-theatre-providers) — related

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
