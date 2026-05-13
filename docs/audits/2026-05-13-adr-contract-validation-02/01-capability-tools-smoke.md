---
title: Capability Tools Smoke Audit — Post Wave-1
status: done
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, smoke, capability-tools]
---

# Capability Tools Smoke Audit (slice 01 of 3)

Re-run of `/audit smoke` after wave-1 closures landed. Surface scope:
`packages/ai/src/capabilities/**/{index,tools}.ts`. ADR set: 0151, 0163,
0173, 0186, 0204, 0238, 0240, 0287, 0301.

## Wave-1 closure verification (F-CL-11 verdict)

**VERDICT: CLOSED — verified at source.**

Evidence:

- `packages/ai/src/capabilities/legal/index.ts:62` reads
  `allowedChannels: ["chat", "system"]` — `"voice"` is gone.
- Commit `47bffe635` (2026-05-13 20:48 +0200) titled
  `fix(audit-2026-05-13): cut voice from legal capability (F-CL-11 CRITICAL)`.
  Diff: `+10 / -5` on a single file, scope-correct.
- Inline rationale at L60-61 cites ADR-0163 §rule 4 and notes Layer 3
  body guards are retained as defence-in-depth — matches the
  layered-channel-guard contract.
- Layer 3 test assertion intact:
  `packages/ai/src/capabilities/legal/__tests__/tools.test.ts:86-87`
  `it("blocks voice channel (ADR-0078 Layer 3 guard)") { ... channel: "voice" }`.
  Test surface unchanged by the fix; Layer 3 still rejects voice if it
  ever leaks past Layer 2. Three-layer guard model preserved.

F-CL-11 is genuinely closed at code level, with test coverage retained.

## New findings

**NEW CRITICAL: 0. NEW HIGH: 0.**

Method: enumerated capabilities (33 directories under
`packages/ai/src/capabilities/`), spot-checked the five with recent
mutations on the surface (commits in last ~30 days touching
`capabilities/**`): `task` (new, ADR-0298 Sortie 3), `communication`
(callGateAction retrofit `3dc9a4c26`, audience-resolver split
`595db8bbe`), `personal` (telemetry entity_type fix `c2c42f1aa`),
`schedule` (admin tools registration `faca4436a`, authority gate tests
`62d8392a8`), and `legal` (the F-CL-11 fix itself).

Per-capability evidence:

| Capability | Mutation pattern | Gate-before-write | Channel decl | Verdict |
|---|---|---|---|---|
| task | RPC + `.insert`/`.update` ×18 | `gateTaskAction` at L298, L392, L559, L657, L859 — every write fenced | chat+voice (read tools); chat-only write tools enforced in body L25-29 | CLEAN |
| communication | `.insert` (audience + announcement) | `callGateAction` retrofit (commit `3dc9a4c26`) | chat+voice+sms+email by design | CLEAN |
| personal | `.insert` ×8 | `callGateAction` at L85, L161, L239, L418 — all four write tools | chat+voice | baseline ADR-0204 backlog still applies (see below) |
| schedule | `.update`/`.insert` via tools | `callGateAction` per tool | chat+voice | CLEAN |
| legal | classify_amendment (system-only write) | gate fenced; body guards retained | chat+system (F-CL-11 closed) | CLEAN |

No new docstring-vs-body drift detected on the sample. Task header
docstring at L1-43 accurately enumerates the gate calls actually present
in the body (verified L17 claim against L298/L392/L559/L657/L859).
Personal header at L41 ("all mutations call gate_action") matches body
at L85/L161/L239/L418.

No new cross-namespace writes introduced. No new direct mutations
without gate. No new forgeable-identity surfaces (body-supplied
`workspace_id` / `profile_id` — none found in sampled tools; schemas use
`.strict()` per L-0237 in the task header).

## Baseline MEDIUM/LOW unchanged check

- **personal/tools.ts ADR-0204 backlog** — still MEDIUM. Pattern is
  `callGateAction` then direct `.insert` without wrapping the mutation
  in `gatedMutation`. No upgrade: gate IS called, mutation is logged
  via `emit()`, the gap is observability/replay (ADR-0204), not
  authority (ADR-0287).
- **journey-authoring/tools.ts cross-namespace writes** — still MEDIUM.
  Lines 484 (journey insert), 510 (journey_version insert), 525
  (journey delete on rollback), 537 (wizard_session update) all wrapped
  in a single `gatedMutation` call (L283-285 docstring confirms; body
  L468 `action: "update"` gate evaluation). Cross-namespace pattern
  (ADR-0240) acknowledged in design; ADR-0173 frozen-4 boundary
  decision still pending — status unchanged.

Both baseline MEDIUMs unchanged in shape and severity. Neither escalates
on this re-scan.

## Summary

**PASS.**

- F-CL-11 verified closed at source with test retention.
- 0 NEW CRITICAL, 0 NEW HIGH on capability-tools surface.
- 2 baseline MEDIUMs (personal ADR-0204 backlog; journey-authoring
  ADR-0240 cross-namespace) unchanged.
- 1 baseline observation: task capability (ADR-0298 Sortie 3, shipped
  `3441556d7` + `8ebd31a8f` + `c3bf46610`) is the largest new mutation
  surface since the previous audit; gate coverage is complete and
  channel policy is enforced both at the capability declaration (L67
  `chat+voice` for read) and inside each chat-only write body
  (L25-29 docstring contract → body checks). No findings.

Surface is safe for promotion. Wave-1 closure on F-CL-11 sticks.
